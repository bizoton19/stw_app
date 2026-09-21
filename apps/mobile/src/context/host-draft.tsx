import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, createDraftReceipt, parseReceiptWithImage } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import { saveHostToken } from "@/lib/session";
import type { Fee, Item, PayMethod, PickedImage, PublicReceipt } from "@/lib/types";

export type DraftItem = Item & { totalInput: string };
export type DraftFee = Fee & { amountInput: string };
export type PickMode = "camera" | "library" | "sample" | null;

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
  method: PayMethod;
  handle: string;
  claimUrl: string;
  error: string | null;
  setPick: (mode: PickMode, image?: PickedImage | null) => void;
  setRestaurant: (v: string) => void;
  setItems: (v: DraftItem[] | ((prev: DraftItem[]) => DraftItem[])) => void;
  setFees: (v: DraftFee[] | ((prev: DraftFee[]) => DraftFee[])) => void;
  setMethod: (v: PayMethod) => void;
  setHandle: (v: string) => void;
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
  const [method, setMethod] = useState<PayMethod>("venmo");
  const [handle, setHandle] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setPick = useCallback((mode: PickMode, next?: PickedImage | null) => {
    setPickMode(mode);
    setImage(mode === "sample" ? null : (next ?? null));
    setError(null);
  }, []);

  const applyReceipt = useCallback((receipt: PublicReceipt) => {
    setRestaurant(receipt.restaurant);
    setItems(toDraftItems(receipt.items));
    setFees(toDraftFees(receipt.fees));
  }, []);

  const ensureDraft = useCallback(async () => {
    if (receiptId) return receiptId;
    // Create without multipart — RN FormData file uploads often fail on device.
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
        sample: pickMode === "sample",
        hostToken: getHostToken(id),
      });
      applyReceipt(receipt);
      if (parse?.reason === "empty") {
        setError("We couldn't find any drinks. Add them on the next screens.");
      } else if (parse?.reason === "failed") {
        setError("Couldn't read that photo. Here's the sample tab so you can keep going.");
      } else if (parse?.reason === "no_key") {
        setError("Scanning isn't configured here. Using the sample tab.");
      } else {
        setError(null);
      }
    } catch (err) {
      const code = (err as { code?: string; message?: string }).code
        ?? (err as { message?: string }).message;
      if (code && code !== "Network request failed" && code !== "request_failed") {
        setError(`Server said ${code}. You can still enter the lines yourself.`);
      } else {
        setError(
          "Couldn't reach the server. Check the API URL on the home screen, then enter the lines yourself.",
        );
      }
    }
  }, [applyReceipt, ensureDraft, image, pickMode]);

  const publish = useCallback(async () => {
    if (!receiptId) throw new Error("no_receipt");
    const { getHostToken } = await import("@/lib/session");
    await api(`/api/receipts/${receiptId}`, {
      method: "PUT",
      hostToken: getHostToken(receiptId),
      body: JSON.stringify({
        restaurant,
        items: items.map(({ id, name, qty, totalCents }) => ({ id, name, qty, totalCents })),
        fees: fees.map(({ id, name, amountCents }) => ({ id, name, amountCents })),
        hostInfo: { method, handle: handle.trim() },
        publish: true,
      }),
    });
    setClaimUrl(publicClaimUrl(receiptId));
  }, [fees, handle, items, method, receiptId, restaurant]);

  const value = useMemo(
    () => ({
      receiptId,
      pickMode,
      image,
      restaurant,
      items,
      fees,
      method,
      handle,
      claimUrl,
      error,
      setPick,
      setRestaurant,
      setItems,
      setFees,
      setMethod,
      setHandle,
      runParse,
      publish,
    }),
    [
      claimUrl,
      error,
      fees,
      handle,
      image,
      items,
      method,
      pickMode,
      publish,
      receiptId,
      restaurant,
      runParse,
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
