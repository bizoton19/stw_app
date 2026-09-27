import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Fee, HostPayment, Item, ItemPour, ReceiptVenue } from "./types";

const KEY = "stw-host-draft-v1";

export type PersistedDraftItem = Item & {
  totalInput: string;
  removed?: boolean;
  pour?: ItemPour | null;
};
export type PersistedDraftFee = Fee & { amountInput: string };
export type PersistedPickMode = "camera" | "library" | "share" | null;

export type PersistedHostDraft = {
  version: 1;
  updatedAt: string;
  receiptId: string | null;
  restaurant: string;
  venue: ReceiptVenue | null;
  receiptDate: string | null;
  items: PersistedDraftItem[];
  fees: PersistedDraftFee[];
  payments: HostPayment[];
  note: string;
  /** Local file URI — may be gone after OS purge; server still has parse if receiptId set. */
  imageUri: string | null;
  pickMode: PersistedPickMode;
  /** Last host route so Resume can jump back (e.g. /host/pay). */
  resumePath: string | null;
};

export function draftHasProgress(draft: PersistedHostDraft | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    draft.receiptId ||
      draft.items.length > 0 ||
      draft.fees.length > 0 ||
      draft.payments.length > 0 ||
      draft.imageUri ||
      draft.restaurant.trim() ||
      draft.venue,
  );
}

/** Best screen to reopen after a failed publish or app restart. */
export function resumePathForDraft(draft: PersistedHostDraft): string {
  if (draft.resumePath?.startsWith("/host/")) return draft.resumePath;
  if (draft.payments.length > 0) return "/host/pay";
  if (draft.fees.length > 0 || draft.items.some((i) => i.pour)) return "/host/fees";
  if (draft.items.length > 0 && draft.venue) return "/host/items";
  if (draft.items.length > 0) return "/host/restaurant";
  if (draft.imageUri || draft.receiptId) return "/host/items";
  return "/host/capture";
}

export async function loadHostDraft(): Promise<PersistedHostDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedHostDraft;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveHostDraft(draft: PersistedHostDraft): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function clearHostDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
