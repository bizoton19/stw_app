import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DB_SCHEMA, ensureSchema, getPool, withTransaction } from "./db";
import { dollarsToCents } from "./money";
import { SAMPLE_PARSE } from "./sample-tab";
import { computeTotals, leftoverAssignments, remainingForItem, remainingMap, latestClaimerForItem } from "./totals";
import { findVenueDayConflict, isValidatedVenue } from "./venue-day";
import type {
  Claim,
  Fee,
  HostInfo,
  Item,
  LiveEvent,
  ParseResult,
  ParseReviewChoice,
  PublicReceipt,
  Receipt,
} from "./types";
import { parseReceiptImage, type ParseMeta, type ReceiptImage } from "./parse-receipt";
import { putReceiptImage } from "./receipt-image";

type InternalClaim = Claim & { ownerToken: string; autoLeftover?: boolean };

type InternalReceipt = Omit<Receipt, "claims"> & {
  hostToken: string;
  claims: InternalClaim[];
};

type Listener = (event: LiveEvent) => void;

type ListenerState = {
  listeners: Map<string, Set<Listener>>;
};

const globalForListeners = globalThis as typeof globalThis & {
  __splitTheWinePgListeners?: ListenerState;
};

function listeners(): ListenerState {
  if (!globalForListeners.__splitTheWinePgListeners) {
    globalForListeners.__splitTheWinePgListeners = { listeners: new Map() };
  }
  return globalForListeners.__splitTheWinePgListeners;
}

function demoEnabled() {
  if (process.env.ALLOW_DEMO === "1" || process.env.ALLOW_DEMO === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function shortId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10);
}

function now(): string {
  return new Date().toISOString();
}

function itemsFromParse(parsed: ParseResult): Item[] {
  return parsed.items.map((item) => ({
    id: `it_${shortId()}`,
    name: item.name,
    qty: item.qty,
    totalCents: dollarsToCents(item.total),
    kind: item.kind === "food" || item.kind === "drink" ? item.kind : null,
  }));
}

function feesFromParse(parsed: ParseResult): Fee[] {
  return parsed.fees.map((fee) => ({
    id: `fe_${shortId()}`,
    name: fee.name,
    amountCents: dollarsToCents(fee.amount),
  }));
}

function toPublic(receipt: InternalReceipt): PublicReceipt {
  const claims: Claim[] = receipt.claims.map(({ ownerToken, autoLeftover, ...claim }) => {
    void ownerToken;
    void autoLeftover;
    return claim;
  });
  const publicReceipt: Receipt = {
    id: receipt.id,
    status: receipt.status,
    restaurant: receipt.restaurant,
    venue: receipt.venue ?? null,
    receiptDate: receipt.receiptDate ?? null,
    items: receipt.items,
    fees: receipt.fees,
    claims,
    hostInfo: receipt.hostInfo,
    createdAt: receipt.createdAt,
    imageName: receipt.imageName,
    hasImage: receipt.hasImage,
    parseFlag: receipt.parseFlag,
    parseReview: receipt.parseReview,
    parseReviewAt: receipt.parseReviewAt,
  };
  return { ...publicReceipt, remaining: remainingMap(publicReceipt) };
}

function emit(receipt: InternalReceipt, type: LiveEvent["type"]) {
  const event: LiveEvent = { type, receipt: toPublic(receipt) };
  for (const listener of listeners().listeners.get(receipt.id) ?? []) {
    listener(event);
  }
}

function bodyOf(receipt: InternalReceipt) {
  const { hostToken: _hostToken, ...rest } = receipt;
  void _hostToken;
  return rest;
}

async function upsertReceipt(client: PoolClient, receipt: InternalReceipt) {
  await client.query(
    `INSERT INTO ${DB_SCHEMA}.receipts (id, host_token, body, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::timestamptz, now())
     ON CONFLICT (id) DO UPDATE SET
       host_token = EXCLUDED.host_token,
       body = EXCLUDED.body,
       updated_at = now()`,
    [receipt.id, receipt.hostToken, JSON.stringify(bodyOf(receipt)), receipt.createdAt],
  );
  await client.query(`DELETE FROM ${DB_SCHEMA}.claim_lookup WHERE receipt_id = $1`, [receipt.id]);
  for (const claim of receipt.claims) {
    await client.query(
      `INSERT INTO ${DB_SCHEMA}.claim_lookup (claim_id, receipt_id) VALUES ($1, $2)`,
      [claim.id, receipt.id],
    );
  }
}

async function selectReceipt(
  client: PoolClient,
  id: string,
  { forUpdate = false }: { forUpdate?: boolean } = {},
): Promise<InternalReceipt | null> {
  const sql = `SELECT id, host_token, body FROM ${DB_SCHEMA}.receipts WHERE id = $1${
    forUpdate ? " FOR UPDATE" : ""
  }`;
  const { rows } = await client.query<{ id: string; host_token: string; body: Omit<InternalReceipt, "hostToken"> }>(
    sql,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row.body, id: row.id, hostToken: row.host_token };
}

async function requireReceipt(
  client: PoolClient,
  id: string,
  opts?: { forUpdate?: boolean },
): Promise<InternalReceipt> {
  const receipt = await selectReceipt(client, id, opts);
  if (!receipt) {
    throw Object.assign(new Error("not_found"), { code: "not_found" });
  }
  return receipt;
}

function assertHostToken(receipt: InternalReceipt, token: string | null): InternalReceipt {
  if (!token || token !== receipt.hostToken) {
    throw Object.assign(new Error("forbidden"), { code: "forbidden" });
  }
  return receipt;
}

let demoSeeded: Promise<void> | null = null;

async function seedDemoIfNeeded() {
  if (!demoEnabled()) return;
  if (!demoSeeded) {
    demoSeeded = (async () => {
      await ensureSchema();
      const existing = await getPool().query(`SELECT 1 FROM ${DB_SCHEMA}.receipts WHERE id = 'demo'`);
      if (existing.rowCount) return;
      const parsed = SAMPLE_PARSE;
      const receipt: InternalReceipt = {
        id: "demo",
        status: "open",
        restaurant: parsed.restaurant,
        receiptDate: parsed.receiptDate ?? null,
        items: itemsFromParse(parsed),
        fees: feesFromParse(parsed),
        claims: [],
        hostInfo: { payments: [{ method: "venmo", handle: "@host" }] },
        createdAt: now(),
        imageName: "sample-tab.jpg",
        hostToken: "demo-host",
      };
      await withTransaction((client) => upsertReceipt(client, receipt));
    })();
  }
  await demoSeeded;
}

export function subscribe(id: string, listener: Listener): () => void {
  const s = listeners();
  const set = s.listeners.get(id) ?? new Set();
  set.add(listener);
  s.listeners.set(id, set);
  void (async () => {
    try {
      await ensureSchema();
      const client = await getPool().connect();
      try {
        const receipt = await selectReceipt(client, id);
        if (receipt) listener({ type: "snapshot", receipt: toPublic(receipt) });
      } finally {
        client.release();
      }
    } catch {
      /* ignore snapshot errors on subscribe */
    }
  })();
  return () => {
    set.delete(listener);
  };
}

export async function createReceipt(input?: { imageName?: string }): Promise<{
  receiptId: string;
  hostToken: string;
}> {
  await ensureSchema();
  const id = shortId();
  const receipt: InternalReceipt = {
    id,
    status: "draft",
    restaurant: "",
    items: [],
    fees: [],
    claims: [],
    createdAt: now(),
    imageName: input?.imageName,
    hostToken: randomUUID(),
  };
  await withTransaction((client) => upsertReceipt(client, receipt));
  return { receiptId: id, hostToken: receipt.hostToken };
}

export async function getPublicReceipt(id: string): Promise<PublicReceipt> {
  await ensureSchema();
  await seedDemoIfNeeded();
  return withTransaction(async (client) => toPublic(await requireReceipt(client, id)));
}

export async function parseReceipt(
  id: string,
  hostToken: string | null,
  image?: ReceiptImage,
  opts?: { forceStub?: boolean },
): Promise<{ receipt: PublicReceipt; parse: ParseMeta }> {
  await ensureSchema();
  // Auth + draft check under lock, then release before the slow vision call.
  await withTransaction(async (client) => {
    const receipt = assertHostToken(await requireReceipt(client, id, { forUpdate: true }), hostToken);
    if (receipt.status !== "draft") {
      throw Object.assign(new Error("already_published"), { code: "conflict" });
    }
  });
  const { result, parse } = await parseReceiptImage(image, opts);
  return withTransaction(async (client) => {
    const receipt = assertHostToken(await requireReceipt(client, id, { forUpdate: true }), hostToken);
    if (receipt.status !== "draft") {
      throw Object.assign(new Error("already_published"), { code: "conflict" });
    }
    // Leave venue unset — host confirms from Places suggestions on step 4.
    receipt.restaurant = result.restaurant;
    receipt.venue = null;
    receipt.receiptDate = result.receiptDate ?? null;
    receipt.items = itemsFromParse(result);
    receipt.fees = feesFromParse(result);
    receipt.imageName = image?.name ?? receipt.imageName;
    if (image?.bytes?.length) {
      await putReceiptImage(id, image);
      receipt.hasImage = true;
    }
    receipt.parseFlag =
      parse.reason === "ok" || parse.reason === "no_image" ? undefined : parse.reason;
    await upsertReceipt(client, receipt);
    emit(receipt, "updated");
    return { receipt: toPublic(receipt), parse };
  });
}

export async function saveReceipt(
  id: string,
  hostToken: string | null,
  patch: {
    restaurant?: string;
    venue?: import("./types").ReceiptVenue | null;
    receiptDate?: string | null;
    items?: {
      id?: string;
      name: string;
      qty: number;
      totalCents: number;
      kind?: import("./types").ItemKind | null;
    }[];
    fees?: { id?: string; name: string; amountCents: number }[];
    hostInfo?: HostInfo;
    publish?: boolean;
  },
): Promise<PublicReceipt> {
  await ensureSchema();
  return withTransaction(async (client) => {
    const receipt = assertHostToken(await requireReceipt(client, id, { forUpdate: true }), hostToken);
    if (receipt.status === "finalized") {
      throw Object.assign(new Error("finalized"), { code: "conflict" });
    }
    if (patch.restaurant !== undefined) receipt.restaurant = patch.restaurant.trim();
    if (patch.venue !== undefined) {
      receipt.venue = patch.venue;
      if (patch.venue?.name && patch.restaurant === undefined) {
        receipt.restaurant = patch.venue.name.trim();
      }
    }
    if (patch.receiptDate !== undefined) {
      receipt.receiptDate = patch.receiptDate;
    }
    if (patch.items) {
      if (receipt.status === "open") {
        for (const incoming of patch.items) {
          if (!incoming.id) continue;
          const existing = receipt.items.find((item) => item.id === incoming.id);
          if (!existing) continue;
          const claimed = existing.qty - remainingForItem(existing, receipt.claims);
          if (incoming.qty < claimed) {
            throw Object.assign(new Error("qty_below_claimed"), { code: "conflict" });
          }
        }
        const incomingIds = new Set(patch.items.map((item) => item.id).filter(Boolean));
        for (const item of receipt.items) {
          if (!incomingIds.has(item.id) && remainingForItem(item, receipt.claims) < item.qty) {
            throw Object.assign(new Error("cannot_delete_claimed"), { code: "conflict" });
          }
        }
      }
      receipt.items = patch.items.map((item) => ({
        id: item.id && receipt.items.some((row) => row.id === item.id) ? item.id : `it_${shortId()}`,
        name: item.name.trim(),
        qty: item.qty,
        totalCents: item.totalCents,
        kind:
          item.kind === "food" || item.kind === "drink"
            ? item.kind
            : item.kind === null
              ? null
              : receipt.items.find((row) => row.id === item.id)?.kind ?? null,
      }));
    }
    if (patch.fees) {
      receipt.fees = patch.fees.map((fee) => ({
        id: fee.id && receipt.fees.some((row) => row.id === fee.id) ? fee.id : `fe_${shortId()}`,
        name: fee.name.trim(),
        amountCents: fee.amountCents,
      }));
    }
    if (patch.hostInfo) receipt.hostInfo = patch.hostInfo;
    if (patch.publish) {
      if (receipt.items.length === 0) {
        throw Object.assign(new Error("no_items"), { code: "invalid" });
      }
      if (!isValidatedVenue(receipt.venue)) {
        throw Object.assign(new Error("venue_required"), {
          code: "invalid",
          message: "Confirm the place from suggestions before sharing.",
        });
      }
      const { rows } = await client.query<{
        id: string;
        body: Omit<InternalReceipt, "hostToken">;
      }>(`SELECT id, body FROM ${DB_SCHEMA}.receipts WHERE id <> $1`, [receipt.id]);
      const others: InternalReceipt[] = rows.map((row) => ({
        ...row.body,
        id: row.id,
        hostToken: "",
      }));
      const conflict = findVenueDayConflict(
        others,
        receipt.id,
        receipt.venue,
        receipt.restaurant,
        receipt.receiptDate,
      );
      if (conflict) {
        throw Object.assign(new Error("venue_day_taken"), {
          code: "venue_day_taken",
          existingId: conflict.id,
          message: `You already have a tab at ${conflict.restaurant || "this place"} for that day.`,
        });
      }
      receipt.status = "open";
    }
    await upsertReceipt(client, receipt);
    emit(receipt, "updated");
    return toPublic(receipt);
  });
}

export async function addClaim(
  id: string,
  input: { itemId: string; personName: string; personContact?: string; units: number },
) {
  await ensureSchema();
  return withTransaction(async (client) => {
    const receipt = await requireReceipt(client, id, { forUpdate: true });
    if (receipt.status !== "open") {
      throw Object.assign(new Error("not_open"), { code: "conflict" });
    }
    const name = input.personName.trim();
    if (!name) {
      throw Object.assign(new Error("name_required"), { code: "invalid" });
    }
    if (!Number.isInteger(input.units) || input.units < 1) {
      throw Object.assign(new Error("invalid_units"), { code: "invalid" });
    }
    const item = receipt.items.find((row) => row.id === input.itemId);
    if (!item) {
      throw Object.assign(new Error("item_not_found"), { code: "not_found" });
    }
    const remaining = remainingForItem(item, receipt.claims);
    if (input.units > remaining) {
      const claimedBy = latestClaimerForItem(receipt.claims, item.id, name);
      throw Object.assign(new Error("not_enough_remaining"), {
        code: "not_enough_remaining",
        remaining,
        itemId: item.id,
        itemName: item.name,
        claimedBy,
        message: claimedBy
          ? remaining === 0
            ? `${item.name} has already been claimed by ${claimedBy}`
            : `Only ${remaining} left on ${item.name} — ${claimedBy} already claimed some`
          : remaining === 0
            ? `${item.name} has already been claimed`
            : `Only ${remaining} left on ${item.name}`,
      });
    }
    const claim: InternalClaim = {
      id: `cl_${shortId()}`,
      itemId: item.id,
      personName: name,
      personContact: input.personContact?.trim() || undefined,
      units: input.units,
      createdAt: now(),
      ownerToken: randomUUID(),
    };
    receipt.claims.push(claim);
    await upsertReceipt(client, receipt);
    emit(receipt, "claim");
    return {
      claim: {
        id: claim.id,
        itemId: claim.itemId,
        personName: claim.personName,
        personContact: claim.personContact,
        units: claim.units,
        createdAt: claim.createdAt,
      },
      ownerToken: claim.ownerToken,
      remaining: remainingForItem(item, receipt.claims),
    };
  });
}

export async function addClaims(
  id: string,
  input: {
    personName: string;
    personContact?: string;
    claims: { itemId: string; units: number }[];
  },
) {
  await ensureSchema();
  return withTransaction(async (client) => {
    const receipt = await requireReceipt(client, id, { forUpdate: true });
    if (receipt.status !== "open") {
      throw Object.assign(new Error("not_open"), { code: "conflict" });
    }
    const name = input.personName.trim();
    if (!name) {
      throw Object.assign(new Error("name_required"), { code: "invalid" });
    }
    if (!Array.isArray(input.claims) || input.claims.length === 0) {
      throw Object.assign(new Error("claims_required"), { code: "invalid" });
    }

    const requested = new Map<string, number>();
    for (const row of input.claims) {
      if (!Number.isInteger(row.units) || row.units < 1) {
        throw Object.assign(new Error("invalid_units"), { code: "invalid" });
      }
      requested.set(row.itemId, (requested.get(row.itemId) ?? 0) + row.units);
    }

    for (const [itemId, units] of requested) {
      const item = receipt.items.find((row) => row.id === itemId);
      if (!item) {
        throw Object.assign(new Error("item_not_found"), { code: "not_found", itemId });
      }
      const remaining = remainingForItem(item, receipt.claims);
      if (units > remaining) {
        const claimedBy = latestClaimerForItem(receipt.claims, itemId, name);
        throw Object.assign(new Error("not_enough_remaining"), {
          code: "not_enough_remaining",
          remaining,
          itemId,
          itemName: item.name,
          claimedBy,
          message: claimedBy
            ? remaining === 0
              ? `${item.name} has already been claimed by ${claimedBy}`
              : `Only ${remaining} left on ${item.name} — ${claimedBy} already claimed some`
            : remaining === 0
              ? `${item.name} has already been claimed`
              : `Only ${remaining} left on ${item.name}`,
        });
      }
    }

    const created: InternalClaim[] = [];
    for (const [itemId, units] of requested) {
      const claim: InternalClaim = {
        id: `cl_${shortId()}`,
        itemId,
        personName: name,
        personContact: input.personContact?.trim() || undefined,
        units,
        createdAt: now(),
        ownerToken: randomUUID(),
      };
      receipt.claims.push(claim);
      created.push(claim);
    }
    await upsertReceipt(client, receipt);
    emit(receipt, "claim");
    const publicReceipt = toPublic(receipt);
    return {
      claims: created.map(({ ownerToken, autoLeftover, ...claim }) => {
        void ownerToken;
        void autoLeftover;
        return claim;
      }),
      tokens: Object.fromEntries(created.map((claim) => [claim.id, claim.ownerToken])),
      remaining: publicReceipt.remaining,
    };
  });
}

export async function removeClaim(
  claimId: string,
  ownerToken: string | null,
  hostToken: string | null = null,
) {
  await ensureSchema();
  return withTransaction(async (client) => {
    const lookup = await client.query<{ receipt_id: string }>(
      `SELECT receipt_id FROM ${DB_SCHEMA}.claim_lookup WHERE claim_id = $1`,
      [claimId],
    );
    const receiptId = lookup.rows[0]?.receipt_id;
    if (!receiptId) {
      throw Object.assign(new Error("not_found"), { code: "not_found" });
    }
    const receipt = await requireReceipt(client, receiptId, { forUpdate: true });
    if (receipt.status === "finalized") {
      throw Object.assign(new Error("finalized"), { code: "conflict" });
    }
    const claim = receipt.claims.find((row) => row.id === claimId);
    if (!claim) {
      throw Object.assign(new Error("not_found"), { code: "not_found" });
    }
    const asOwner = Boolean(ownerToken && ownerToken === claim.ownerToken);
    const asHost = Boolean(hostToken && hostToken === receipt.hostToken);
    if (!asOwner && !asHost) {
      throw Object.assign(new Error("forbidden"), { code: "forbidden" });
    }
    const item = receipt.items.find((row) => row.id === claim.itemId);
    const removed = {
      personName: claim.personName,
      itemId: claim.itemId,
      itemName: item?.name ?? "an item",
      units: claim.units,
    };
    receipt.claims = receipt.claims.filter((row) => row.id !== claimId);
    await upsertReceipt(client, receipt);
    emit(receipt, "unclaim");
    return { receipt: toPublic(receipt), removed };
  });
}

export async function registerHostPushToken(
  id: string,
  hostToken: string | null,
  token: string,
  platform?: string | null,
) {
  await ensureSchema();
  return withTransaction(async (client) => {
    assertHostToken(await requireReceipt(client, id, { forUpdate: true }), hostToken);
    const trimmed = token.trim();
    if (!trimmed) {
      throw Object.assign(new Error("token_required"), { code: "invalid" });
    }
    await client.query(
      `INSERT INTO ${DB_SCHEMA}.host_push_tokens (receipt_id, token, platform, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (receipt_id, token) DO UPDATE SET
         platform = EXCLUDED.platform,
         updated_at = now()`,
      [id, trimmed, platform?.trim() || null],
    );
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${DB_SCHEMA}.host_push_tokens WHERE receipt_id = $1`,
      [id],
    );
    return { ok: true as const, count: Number(rows[0]?.count ?? 0) };
  });
}

export async function listHostPushTokens(id: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await getPool().query<{ token: string }>(
    `SELECT token FROM ${DB_SCHEMA}.host_push_tokens WHERE receipt_id = $1`,
    [id],
  );
  return rows.map((row) => row.token);
}

export async function setHostInfo(id: string, hostToken: string | null, info: HostInfo) {
  return saveReceipt(id, hostToken, { hostInfo: info });
}

export async function setParseReview(
  id: string,
  hostToken: string | null,
  choice: ParseReviewChoice,
) {
  await ensureSchema();
  return withTransaction(async (client) => {
    const receipt = assertHostToken(await requireReceipt(client, id, { forUpdate: true }), hostToken);
    receipt.parseReview = choice;
    receipt.parseReviewAt = now();
    console.info(
      JSON.stringify({
        event: "parse.review",
        ts: receipt.parseReviewAt,
        receiptId: receipt.id,
        choice,
        parseFlag: receipt.parseFlag ?? null,
        itemCount: receipt.items.length,
        feeCount: receipt.fees.length,
      }),
    );
    await upsertReceipt(client, receipt);
    emit(receipt, "updated");
    return toPublic(receipt);
  });
}

export async function finalizeReceipt(id: string, hostToken: string | null) {
  await ensureSchema();
  return withTransaction(async (client) => {
    const receipt = assertHostToken(await requireReceipt(client, id, { forUpdate: true }), hostToken);
    if (receipt.status !== "open") {
      throw Object.assign(new Error("not_open"), { code: "conflict" });
    }
    const hostName = receipt.hostInfo?.payments[0]?.handle
      ? `Host (${receipt.hostInfo.payments[0].handle})`
      : "Host";
    const leftovers = leftoverAssignments(toPublic(receipt));
    for (const leftover of leftovers) {
      const claim: InternalClaim = {
        id: `cl_${shortId()}`,
        itemId: leftover.itemId,
        personName: hostName,
        units: leftover.units,
        createdAt: now(),
        ownerToken: randomUUID(),
        autoLeftover: true,
      };
      receipt.claims.push(claim);
    }
    receipt.status = "finalized";
    await upsertReceipt(client, receipt);
    emit(receipt, "finalized");
    return { receipt: toPublic(receipt), totals: computeTotals(toPublic(receipt)) };
  });
}

export async function reopenReceipt(id: string, hostToken: string | null) {
  await ensureSchema();
  return withTransaction(async (client) => {
    const receipt = assertHostToken(await requireReceipt(client, id, { forUpdate: true }), hostToken);
    if (receipt.status !== "finalized") {
      throw Object.assign(new Error("not_finalized"), { code: "conflict" });
    }
    receipt.claims = receipt.claims.filter((claim) => !claim.autoLeftover);
    receipt.status = "open";
    await upsertReceipt(client, receipt);
    emit(receipt, "reopened");
    return { receipt: toPublic(receipt), totals: computeTotals(toPublic(receipt)) };
  });
}

export async function getTotals(id: string) {
  return computeTotals(await getPublicReceipt(id));
}
