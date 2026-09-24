import { randomUUID } from "node:crypto";
import { dollarsToCents } from "./money";
import { SAMPLE_PARSE } from "./sample-tab";
import { computeTotals, leftoverAssignments, remainingForItem, remainingMap } from "./totals";
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

type InternalClaim = Claim & { ownerToken: string; autoLeftover?: boolean };

type InternalReceipt = Omit<Receipt, "claims"> & {
  hostToken: string;
  claims: InternalClaim[];
};

type Listener = (event: LiveEvent) => void;

type StoreState = {
  receipts: Map<string, InternalReceipt>;
  claimsById: Map<string, string>;
  locks: Map<string, Promise<void>>;
  listeners: Map<string, Set<Listener>>;
};

const globalForStore = globalThis as typeof globalThis & {
  __splitTheWine?: StoreState;
};

function state(): StoreState {
  if (!globalForStore.__splitTheWine) {
    globalForStore.__splitTheWine = {
      receipts: new Map(),
      claimsById: new Map(),
      locks: new Map(),
      listeners: new Map(),
    };
    if (demoEnabled()) {
      seedDemo(globalForStore.__splitTheWine);
    }
  }
  return globalForStore.__splitTheWine;
}

function demoEnabled() {
  if (process.env.ALLOW_DEMO === "1" || process.env.ALLOW_DEMO === "true") return true;
  // Local/dev convenience; production Railway should leave ALLOW_DEMO unset.
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
  }));
}

function feesFromParse(parsed: ParseResult): Fee[] {
  return parsed.fees.map((fee) => ({
    id: `fe_${shortId()}`,
    name: fee.name,
    amountCents: dollarsToCents(fee.amount),
  }));
}

function seedDemo(s: StoreState) {
  const parsed = SAMPLE_PARSE;
  const receipt: InternalReceipt = {
    id: "demo",
    status: "open",
    restaurant: parsed.restaurant,
    items: itemsFromParse(parsed),
    fees: feesFromParse(parsed),
    claims: [],
    hostInfo: { payments: [{ method: "venmo", handle: "@host" }] },
    createdAt: now(),
    imageName: "sample-tab.jpg",
    hostToken: "demo-host",
  };
  s.receipts.set(receipt.id, receipt);
}

async function withLock<T>(id: string, fn: () => T | Promise<T>): Promise<T> {
  const s = state();
  const prev = s.locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  s.locks.set(
    id,
    prev.then(() => next),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
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
    items: receipt.items,
    fees: receipt.fees,
    claims,
    hostInfo: receipt.hostInfo,
    createdAt: receipt.createdAt,
    imageName: receipt.imageName,
    parseFlag: receipt.parseFlag,
    parseReview: receipt.parseReview,
    parseReviewAt: receipt.parseReviewAt,
  };
  return { ...publicReceipt, remaining: remainingMap(publicReceipt) };
}

function emit(receipt: InternalReceipt, type: LiveEvent["type"]) {
  const event: LiveEvent = { type, receipt: toPublic(receipt) };
  for (const listener of state().listeners.get(receipt.id) ?? []) {
    listener(event);
  }
}

function requireReceipt(id: string): InternalReceipt {
  const receipt = state().receipts.get(id);
  if (!receipt) {
    throw Object.assign(new Error("not_found"), { code: "not_found" });
  }
  return receipt;
}

export function subscribe(id: string, listener: Listener): () => void {
  const s = state();
  const set = s.listeners.get(id) ?? new Set();
  set.add(listener);
  s.listeners.set(id, set);
  const receipt = s.receipts.get(id);
  if (receipt) listener({ type: "snapshot", receipt: toPublic(receipt) });
  return () => {
    set.delete(listener);
  };
}

export function createReceipt(input?: { imageName?: string }): {
  receiptId: string;
  hostToken: string;
} {
  const s = state();
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
  s.receipts.set(id, receipt);
  return { receiptId: id, hostToken: receipt.hostToken };
}

export function getPublicReceipt(id: string): PublicReceipt {
  return toPublic(requireReceipt(id));
}

export function assertHost(id: string, token: string | null): InternalReceipt {
  const receipt = requireReceipt(id);
  if (!token || token !== receipt.hostToken) {
    throw Object.assign(new Error("forbidden"), { code: "forbidden" });
  }
  return receipt;
}

export async function parseReceipt(
  id: string,
  hostToken: string | null,
  image?: ReceiptImage,
  opts?: { forceStub?: boolean },
): Promise<{ receipt: PublicReceipt; parse: ParseMeta }> {
  return withLock(id, async () => {
    const receipt = assertHost(id, hostToken);
    if (receipt.status !== "draft") {
      throw Object.assign(new Error("already_published"), { code: "conflict" });
    }
    const { result, parse } = await parseReceiptImage(image, opts);
    receipt.restaurant = result.restaurant;
    receipt.items = itemsFromParse(result);
    receipt.fees = feesFromParse(result);
    receipt.imageName = image?.name ?? receipt.imageName;
    receipt.parseFlag =
      parse.reason === "ok" || parse.reason === "no_image" ? undefined : parse.reason;
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
    items?: { id?: string; name: string; qty: number; totalCents: number }[];
    fees?: { id?: string; name: string; amountCents: number }[];
    hostInfo?: HostInfo;
    publish?: boolean;
  },
): Promise<PublicReceipt> {
  return withLock(id, () => {
    const receipt = assertHost(id, hostToken);
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
      receipt.status = "open";
    }
    emit(receipt, "updated");
    return toPublic(receipt);
  });
}

export async function addClaim(
  id: string,
  input: { itemId: string; personName: string; personContact?: string; units: number },
) {
  return withLock(id, () => {
    const receipt = requireReceipt(id);
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
      throw Object.assign(new Error("not_enough_remaining"), {
        code: "not_enough_remaining",
        remaining,
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
    state().claimsById.set(claim.id, receipt.id);
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
  return withLock(id, () => {
    const receipt = requireReceipt(id);
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
        throw Object.assign(new Error("not_enough_remaining"), {
          code: "not_enough_remaining",
          remaining,
          itemId,
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
      state().claimsById.set(claim.id, receipt.id);
      created.push(claim);
    }
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

export async function removeClaim(claimId: string, ownerToken: string | null) {
  const receiptId = state().claimsById.get(claimId);
  if (!receiptId) {
    throw Object.assign(new Error("not_found"), { code: "not_found" });
  }
  return withLock(receiptId, () => {
    const receipt = requireReceipt(receiptId);
    if (receipt.status === "finalized") {
      throw Object.assign(new Error("finalized"), { code: "conflict" });
    }
    const claim = receipt.claims.find((row) => row.id === claimId);
    if (!claim) {
      throw Object.assign(new Error("not_found"), { code: "not_found" });
    }
    if (!ownerToken || ownerToken !== claim.ownerToken) {
      throw Object.assign(new Error("forbidden"), { code: "forbidden" });
    }
    receipt.claims = receipt.claims.filter((row) => row.id !== claimId);
    state().claimsById.delete(claimId);
    emit(receipt, "unclaim");
    return toPublic(receipt);
  });
}

export async function setHostInfo(id: string, hostToken: string | null, info: HostInfo) {
  return saveReceipt(id, hostToken, { hostInfo: info });
}

export async function setParseReview(
  id: string,
  hostToken: string | null,
  choice: ParseReviewChoice,
) {
  return withLock(id, () => {
    const receipt = assertHost(id, hostToken);
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
    emit(receipt, "updated");
    return toPublic(receipt);
  });
}

export async function finalizeReceipt(id: string, hostToken: string | null) {
  return withLock(id, () => {
    const receipt = assertHost(id, hostToken);
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
      state().claimsById.set(claim.id, receipt.id);
    }
    receipt.status = "finalized";
    emit(receipt, "finalized");
    return { receipt: toPublic(receipt), totals: computeTotals(toPublic(receipt)) };
  });
}

export async function reopenReceipt(id: string, hostToken: string | null) {
  return withLock(id, () => {
    const receipt = assertHost(id, hostToken);
    if (receipt.status !== "finalized") {
      throw Object.assign(new Error("not_finalized"), { code: "conflict" });
    }
    const kept: InternalClaim[] = [];
    for (const claim of receipt.claims) {
      if (claim.autoLeftover) {
        state().claimsById.delete(claim.id);
      } else {
        kept.push(claim);
      }
    }
    receipt.claims = kept;
    receipt.status = "open";
    emit(receipt, "reopened");
    return { receipt: toPublic(receipt), totals: computeTotals(toPublic(receipt)) };
  });
}

export function getTotals(id: string) {
  return computeTotals(toPublic(requireReceipt(id)));
}

export function resetStoreForTests() {
  globalForStore.__splitTheWine = {
    receipts: new Map(),
    claimsById: new Map(),
    locks: new Map(),
    listeners: new Map(),
  };
  seedDemo(globalForStore.__splitTheWine);
}
