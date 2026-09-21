import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, createDraftReceipt, parseReceiptWithImage } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import { saveHostToken } from "@/lib/session";
import type { Fee, HostPayment, Item, PayMethod, PickedImage, PublicReceipt } from "@/lib/types";

export type DraftItem = Item & { totalInput: string };
export type DraftFee = Fee & { amountInput: string };
export type PickMode = "camera" | "library" | null;

function toDraftItems(items: Item[]): DraftItem[] {
  return items.map((item) => ({ ...item, totalInput: (item.totalCents / 100).toFixed(2) }));
}
function toDraftFees(fees: Fee[]): DraftFee[] {
  return fees.map((fee) => ({ ...fee, amountInput: (fee.amountCents / 100).toFixed(2) }));
}

type HostDraft = {
  receiptId: string | null;
  pickMode: PickMode;
  image: PickedImage | null;
  restaurant: string;
  items: DraftItem[];
  fees: DraftFee[];
  payments: HostPayment[];
  claimUrl: string;
  error: string | null;
  setPick: (mode: PickMode, image?: PickedImage | null) => void;
  setRestaurant: (v: string) => void;
  setItems: (v: DraftItem[] | ((prev: DraftItem[]) => DraftItem[])) => void;
  setFees: (v: DraftFee[] | ((prev: DraftFee[]) => DraftFee[])) => void;
  setPayment: (index: number, patch: Partial<HostPayment>) => void;
  addPayment: (method?: PayMethod) => void;
  removePayment: (index: number) => void;
  runParse: () => Promise<void>;
  publish: () => Promise<void>;
};

const Ctx = createContext<HostDraft | null>(null);

export function HostDraftProvider({ children }: { children: React.ReactNode }) {
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [restaurant, setRestaurant] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [fees, setFees] = useState<DraftFee[]>([]);
  const [payments, setPayments] = useState<HostPayment[]>([{ method: "venmo", handle: "" }]);
  const [claimUrl, setClaimUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setPick = useCallback((mode: PickMode, next?: PickedImage | null) => {
    setPickMode(mode);
    setImage(next ?? null);
    setError(null);
  }, []);

  const setPayment = useCallback((index: number, patch: Partial<HostPayment>) => {
    setPayments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }, []);

  const addPayment = useCallback((method: PayMethod = "cashapp") => {
    setPayments((prev) => {
      const used = new Set(prev.map((p) => p.method));
      const nextMethod =
        method && !used.has(method)
          ? method
          : (["venmo", "zelle", "cashapp", "other"] as PayMethod[]).find((m) => !used.has(m));
      if (!nextMethod) return prev;
      return [...prev, { method: nextMethod, handle: "" }];
    });
  }, []);

  const removePayment = useCallback((index: number) => {
    setPayments((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const applyReceipt = useCallback((receipt: PublicReceipt) => {
    setRestaurant(receipt.restaurant);
    setItems(toDraftItems(receipt.items));
    setFees(toDraftFees(receipt.fees));
  }, []);

  const ensureDraft = useCallback(async () => {
    if (receiptId) return receiptId;
    const created = await createDraftReceipt();
    await saveHostToken(created.receiptId, created.hostToken);
    setReceiptId(created.receiptId);
    return created.receiptId;
  }, [receiptId]);

  const runParse = useCallback(async () => {
    setError(null);
    try {
      const id = await ensureDraft();
      const { getHostToken } = await import("@/lib/session");
      const { receipt, parse } = await parseReceiptWithImage(id, {
        image,
        hostToken: getHostToken(id),
      });
      applyReceipt(receipt);
      if (parse?.reason === "empty") {
        setError("We couldn't find any drinks. Add them on the next screens.");
      } else if (parse?.reason === "failed") {
        setError("Couldn't read that photo. Add the lines on the next screens.");
      } else if (parse?.reason === "no_key") {
        setError("Scanning isn't configured here. Add the lines on the next screens.");
      } else if (parse?.reason === "no_image") {
        setError("No photo attached. Add the lines on the next screens.");
      } else {
        setError(null);
      }
    } catch (err) {
      const code =
        (err as { code?: string; message?: string }).code ??
        (err as { message?: string }).message;
      if (code && code !== "Network request failed" && code !== "request_failed") {
        setError(`Server said ${code}. You can still enter the lines yourself.`);
      } else {
        setError(
          "Couldn't reach the server. Check the API URL on the home screen, then enter the lines yourself.",
        );
      }
    }
  }, [applyReceipt, ensureDraft, image]);

  const publish = useCallback(async () => {
    if (!receiptId) throw new Error("no_receipt");
    const cleaned = payments
      .map((p) => ({ method: p.method, handle: p.handle.trim() }))
      .filter((p) => p.handle);
    if (cleaned.length === 0) throw new Error("no_payments");
    const { getHostToken } = await import("@/lib/session");
    await api(`/api/receipts/${receiptId}`, {
      method: "PUT",
      hostToken: getHostToken(receiptId),
      body: JSON.stringify({
        restaurant,
        items: items.map(({ id, name, qty, totalCents }) => ({ id, name, qty, totalCents })),
        fees: fees.map(({ id, name, amountCents }) => ({ id, name, amountCents })),
        hostInfo: { payments: cleaned },
        publish: true,
      }),
    });
    setClaimUrl(publicClaimUrl(receiptId));
  }, [fees, items, payments, receiptId, restaurant]);

  const value = useMemo(
    () => ({
      receiptId,
      pickMode,
      image,
      restaurant,
      items,
      fees,
      payments,
      claimUrl,
      error,
      setPick,
      setRestaurant,
      setItems,
      setFees,
      setPayment,
      addPayment,
      removePayment,
      runParse,
      publish,
    }),
    [
      addPayment,
      claimUrl,
      error,
      fees,
      image,
      items,
      payments,
      pickMode,
      publish,
      receiptId,
      removePayment,
      restaurant,
      runParse,
      setPayment,
      setPick,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHostDraft() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHostDraft outside provider");
  return ctx;
}
