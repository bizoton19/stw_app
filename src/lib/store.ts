import { usingDatabase } from "./db";
import * as memory from "./store-memory";
import * as pg from "./store-pg";
import type { HostInfo, ParseReviewChoice, ReceiptVenue } from "./types";
import type { ParseMeta, ReceiptImage } from "./parse-receipt";

/**
 * Persistence facade: Postgres (schema `split_the_wine`) when DATABASE_URL is set,
 * otherwise the in-memory Map used for local/dev and unit tests.
 */

export function subscribe(
  id: string,
  listener: Parameters<typeof memory.subscribe>[1],
): () => void {
  return usingDatabase() ? pg.subscribe(id, listener) : memory.subscribe(id, listener);
}

export async function createReceipt(input?: { imageName?: string }) {
  return usingDatabase() ? pg.createReceipt(input) : memory.createReceipt(input);
}

export async function getPublicReceipt(id: string) {
  return usingDatabase() ? pg.getPublicReceipt(id) : memory.getPublicReceipt(id);
}

export async function parseReceipt(
  id: string,
  hostToken: string | null,
  image?: ReceiptImage,
  opts?: { forceStub?: boolean },
): Promise<{ receipt: Awaited<ReturnType<typeof getPublicReceipt>>; parse: ParseMeta }> {
  return usingDatabase()
    ? pg.parseReceipt(id, hostToken, image, opts)
    : memory.parseReceipt(id, hostToken, image, opts);
}

export async function saveReceipt(
  id: string,
  hostToken: string | null,
  patch: {
    restaurant?: string;
    venue?: ReceiptVenue | null;
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
) {
  return usingDatabase()
    ? pg.saveReceipt(id, hostToken, patch)
    : memory.saveReceipt(id, hostToken, patch);
}

export async function addClaim(
  id: string,
  input: { itemId: string; personName: string; personContact?: string; units: number },
) {
  return usingDatabase() ? pg.addClaim(id, input) : memory.addClaim(id, input);
}

export async function addClaims(
  id: string,
  input: {
    personName: string;
    personContact?: string;
    claims: { itemId: string; units: number }[];
  },
) {
  return usingDatabase() ? pg.addClaims(id, input) : memory.addClaims(id, input);
}

export async function removeClaim(
  claimId: string,
  ownerToken: string | null,
  hostToken?: string | null,
) {
  return usingDatabase()
    ? pg.removeClaim(claimId, ownerToken, hostToken)
    : memory.removeClaim(claimId, ownerToken, hostToken);
}

export async function registerHostPushToken(
  id: string,
  hostToken: string | null,
  token: string,
  platform?: string | null,
) {
  return usingDatabase()
    ? pg.registerHostPushToken(id, hostToken, token, platform)
    : memory.registerHostPushToken(id, hostToken, token, platform);
}

export async function listHostPushTokens(id: string) {
  return usingDatabase() ? pg.listHostPushTokens(id) : memory.listHostPushTokens(id);
}

export async function setHostInfo(id: string, hostToken: string | null, info: HostInfo) {
  return usingDatabase() ? pg.setHostInfo(id, hostToken, info) : memory.setHostInfo(id, hostToken, info);
}

export async function setParseReview(
  id: string,
  hostToken: string | null,
  choice: ParseReviewChoice,
) {
  return usingDatabase()
    ? pg.setParseReview(id, hostToken, choice)
    : memory.setParseReview(id, hostToken, choice);
}

export async function finalizeReceipt(id: string, hostToken: string | null) {
  return usingDatabase() ? pg.finalizeReceipt(id, hostToken) : memory.finalizeReceipt(id, hostToken);
}

export async function reopenReceipt(id: string, hostToken: string | null) {
  return usingDatabase() ? pg.reopenReceipt(id, hostToken) : memory.reopenReceipt(id, hostToken);
}

export async function getTotals(id: string) {
  return usingDatabase() ? pg.getTotals(id) : memory.getTotals(id);
}

/** Unit tests always use the in-memory backend. */
export function resetStoreForTests() {
  memory.resetStoreForTests();
}
