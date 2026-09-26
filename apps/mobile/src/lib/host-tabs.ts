import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { getHostToken, hydrateSession } from "./session";
import type { PublicReceipt, ReceiptStatus } from "./types";

const ACTIVE_KEY = "stw-active-receipt";
const HOSTED_KEY = "stw-hosted-receipts";

export type HostedReceiptSummary = {
  id: string;
  restaurant: string;
  claimUrl: string;
  updatedAt: string;
  /** Places key used to block duplicate tabs same day. */
  placeKey?: string;
  receiptDay?: string;
  /** open | finalized | draft — from publish / close / reopen / API refresh. */
  status?: ReceiptStatus;
};

export function hostedStatusLabel(status?: ReceiptStatus): "Open" | "Closed" {
  return status === "finalized" ? "Closed" : "Open";
}

export async function setActiveHostReceipt(id: string | null) {
  if (!id) {
    await AsyncStorage.removeItem(ACTIVE_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_KEY, id);
}

export async function getActiveHostReceiptId(): Promise<string | null> {
  await hydrateSession();
  const id = await AsyncStorage.getItem(ACTIVE_KEY);
  if (!id) return null;
  if (!getHostToken(id)) {
    await AsyncStorage.removeItem(ACTIVE_KEY);
    return null;
  }
  return id;
}

async function readHostedList(): Promise<HostedReceiptSummary[]> {
  const raw = await AsyncStorage.getItem(HOSTED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HostedReceiptSummary[];
  } catch {
    return [];
  }
}

async function writeHostedList(list: HostedReceiptSummary[]) {
  await AsyncStorage.setItem(HOSTED_KEY, JSON.stringify(list));
}

export async function rememberHostedReceipt(summary: HostedReceiptSummary) {
  await setActiveHostReceipt(summary.id);
  const list = await readHostedList();
  const next: HostedReceiptSummary = {
    ...summary,
    status: summary.status ?? "open",
  };
  await writeHostedList([next, ...list.filter((row) => row.id !== summary.id)].slice(0, 20));
}

export async function patchHostedReceipt(
  id: string,
  patch: Partial<Omit<HostedReceiptSummary, "id">>,
) {
  const list = await readHostedList();
  const idx = list.findIndex((row) => row.id === id);
  if (idx < 0) return;
  const next = [...list];
  next[idx] = { ...next[idx], ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() };
  await writeHostedList(next);
}

export async function listHostedReceipts(): Promise<HostedReceiptSummary[]> {
  await hydrateSession();
  const list = await readHostedList();
  return list.filter((row) => Boolean(getHostToken(row.id)));
}

/** Refresh open/closed from the API so the desk stays accurate after close/reopen elsewhere. */
export async function refreshHostedReceiptStatuses(): Promise<HostedReceiptSummary[]> {
  const list = await listHostedReceipts();
  if (list.length === 0) return [];
  const next = await Promise.all(
    list.map(async (row) => {
      try {
        const receipt = await api<PublicReceipt>(`/api/receipts/${row.id}`);
        return {
          ...row,
          restaurant: receipt.restaurant || row.restaurant,
          status: receipt.status,
          receiptDay: receipt.receiptDate ?? row.receiptDay,
        } satisfies HostedReceiptSummary;
      } catch {
        return row;
      }
    }),
  );
  await writeHostedList(next);
  return next;
}

export async function clearHostedReceipt(id: string) {
  const list = (await readHostedList()).filter((row) => row.id !== id);
  await writeHostedList(list);
  const active = await AsyncStorage.getItem(ACTIVE_KEY);
  if (active === id) await AsyncStorage.removeItem(ACTIVE_KEY);
}
