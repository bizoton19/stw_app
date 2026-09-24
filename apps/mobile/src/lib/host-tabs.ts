import AsyncStorage from "@react-native-async-storage/async-storage";
import { getHostToken, hydrateSession } from "./session";

const ACTIVE_KEY = "stw-active-receipt";
const HOSTED_KEY = "stw-hosted-receipts";

export type HostedReceiptSummary = {
  id: string;
  restaurant: string;
  claimUrl: string;
  updatedAt: string;
};

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

export async function rememberHostedReceipt(summary: HostedReceiptSummary) {
  await setActiveHostReceipt(summary.id);
  const raw = await AsyncStorage.getItem(HOSTED_KEY);
  let list: HostedReceiptSummary[] = [];
  try {
    list = raw ? (JSON.parse(raw) as HostedReceiptSummary[]) : [];
  } catch {
    list = [];
  }
  list = [summary, ...list.filter((row) => row.id !== summary.id)].slice(0, 20);
  await AsyncStorage.setItem(HOSTED_KEY, JSON.stringify(list));
}

export async function listHostedReceipts(): Promise<HostedReceiptSummary[]> {
  await hydrateSession();
  const raw = await AsyncStorage.getItem(HOSTED_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as HostedReceiptSummary[];
    return list.filter((row) => Boolean(getHostToken(row.id)));
  } catch {
    return [];
  }
}

export async function clearHostedReceipt(id: string) {
  const raw = await AsyncStorage.getItem(HOSTED_KEY);
  if (raw) {
    try {
      const list = (JSON.parse(raw) as HostedReceiptSummary[]).filter((row) => row.id !== id);
      await AsyncStorage.setItem(HOSTED_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }
  const active = await AsyncStorage.getItem(ACTIVE_KEY);
  if (active === id) await AsyncStorage.removeItem(ACTIVE_KEY);
}
