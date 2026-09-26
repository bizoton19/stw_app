import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, createDraftReceipt, parseReceiptWithImage, submitParseReview } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import { nextUnusedPayMethod } from "@/lib/pay-region";
import { saveHostToken } from "@/lib/session";
import type {
  Fee,
  HostPayment,
  Item,
  ParseReviewChoice,
  PayMethod,
  PickedImage,
  PublicReceipt,
  ReceiptVenue,
} from "@/lib/types";

export type DraftItem = Item & { totalInput: string; removed?: boolean };
export type DraftFee = Fee & { amountInput: string };
export type PickMode = "camera" | "library" | "share" | null;

function toDraftItems(items: Item[]): DraftItem[] {
  return items.map((item) => ({
    ...item,
    kind: item.kind ?? null,
    totalInput: (item.totalCents / 100).toFixed(2),
  }));
}
function toDraftFees(fees: Fee[]): DraftFee[] {
  return fees.map((fee) => ({ ...fee, amountInput: (fee.amountCents / 100).toFixed(2) }));
}

type HostDraft = {
  receiptId: string | null;
  pickMode: PickMode;
  image: PickedImage | null;
  restaurant: string;
  venue: ReceiptVenue | null;
  receiptDate: string | null;
  items: DraftItem[];
  fees: DraftFee[];
  payments: HostPayment[];
  claimUrl: string;
  error: string | null;
  setPick: (mode: PickMode, image?: PickedImage | null) => void;
  setRestaurant: (v: string) => void;
  setVenue: (v: ReceiptVenue | null) => void;
  setItems: (v: DraftItem[] | ((prev: DraftItem[]) => DraftItem[])) => void;
  setFees: (v: DraftFee[] | ((prev: DraftFee[]) => DraftFee[])) => void;
  setPayment: (index: number, patch: Partial<HostPayment>) => void;
  addPayment: (method?: PayMethod) => void;
  removePayment: (index: number) => void;
  togglePaymentMethod: (method: PayMethod) => void;
  setPaymentHandle: (method: PayMethod, handle: string) => void;
  runParse: () => Promise<void>;
  recordParseReview: (choice: ParseReviewChoice) => Promise<void>;
  publish: () => Promise<void>;
};

const Ctx = createContext<HostDraft | null>(null);

export function HostDraftProvider({ children }: { children: React.ReactNode }) {
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [restaurant, setRestaurant] = useState("");
  const [venue, setVenue] = useState<ReceiptVenue | null>(null);
  const [receiptDate, setReceiptDate] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [fees, setFees] = useState<DraftFee[]>([]);
  const [payments, setPayments] = useState<HostPayment[]>([]);
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

  const addPayment = useCallback((method?: PayMethod) => {
    setPayments((prev) => {
      const used = new Set(prev.map((p) => p.method));
      const nextMethod =
        method && !used.has(method) ? method : nextUnusedPayMethod(used);
      if (!nextMethod) return prev;
      return [...prev, { method: nextMethod, handle: "" }];
    });
  }, []);

  const removePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const togglePaymentMethod = useCallback((method: PayMethod) => {
    setPayments((prev) => {
      const idx = prev.findIndex((p) => p.method === method);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { method, handle: "" }];
    });
  }, []);

  const setPaymentHandle = useCallback((method: PayMethod, handle: string) => {
    setPayments((prev) =>
      prev.map((row) => (row.method === method ? { ...row, handle } : row)),
    );
  }, []);

  const applyReceipt = useCallback((receipt: PublicReceipt) => {
    setRestaurant(receipt.restaurant);
    setVenue(receipt.venue ?? null);
    setReceiptDate(receipt.receiptDate ?? null);
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
      // Venue may already be Places-pinned by the API. Host confirms or Changes on step 4 —
      // never auto-lock a guess after they start typing.
      if (parse?.reason === "empty") {
        setError("We couldn't find any drinks. Add them on the next screens.");
      } else if (parse?.reason === "failed") {
        setError("Couldn't read that photo. Add the lines on the next screens.");
      } else if (parse?.reason === "timeout") {
        setError("Reading timed out. Try a clearer photo, or add the lines yourself.");
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
          "Couldn't finish reading that photo (connection dropped). Try again, or add the lines yourself.",
        );
      }
    }
  }, [applyReceipt, ensureDraft, image]);

  const recordParseReview = useCallback(
    async (choice: ParseReviewChoice) => {
      if (!receiptId) return;
      const { getHostToken } = await import("@/lib/session");
      try {
        await submitParseReview(receiptId, choice, getHostToken(receiptId));
      } catch {
        /* eval signal — don't block the host flow */
      }
    },
    [receiptId],
  );

  const publish = useCallback(async () => {
    if (!receiptId) throw new Error("no_receipt");
    const { validateHostPayments } = await import("@/lib/host-pay");
    const { isValidatedVenue, receiptDayKey, venueLocationKey } = await import("@/lib/venue-day");
    const checked = validateHostPayments(payments);
    if (!checked.ok) throw new Error(checked.message);
    if (!isValidatedVenue(venue)) {
      throw new Error("Confirm the place from suggestions before sharing.");
    }
    const { getHostToken } = await import("@/lib/session");
    const venueToSave = venue!;
    const day = receiptDayKey(receiptDate, new Date().toISOString());
    const placeKey = venueLocationKey(venueToSave, restaurant);
    if (placeKey) {
      const { listHostedReceipts } = await import("@/lib/host-tabs");
      const hosted = await listHostedReceipts();
      const localHit = hosted.find(
        (row) =>
          row.id !== receiptId &&
          row.placeKey === placeKey &&
          row.receiptDay === day,
      );
      if (localHit) {
        throw new Error(
          `You already have a tab at ${localHit.restaurant || "this place"} for that day. Open it from Home.`,
        );
      }
    }
    try {
      await api(`/api/receipts/${receiptId}`, {
        method: "PUT",
        hostToken: getHostToken(receiptId),
        body: JSON.stringify({
          restaurant: venueToSave.name ?? restaurant,
          venue: venueToSave,
          receiptDate,
          items: items
            .filter((row) => !row.removed)
            .map(({ id, name, qty, totalCents, kind }) => ({
              id,
              name,
              qty,
              totalCents,
              kind: kind ?? null,
            })),
          fees: fees.map(({ id, name, amountCents }) => ({ id, name, amountCents })),
          hostInfo: { payments: checked.payments },
          publish: true,
        }),
      });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "venue_day_taken" || e.code === "invalid") {
        throw new Error(e.message || "Couldn't publish that place for today.");
      }
      throw err;
    }
    const url = publicClaimUrl(receiptId);
    setClaimUrl(url);
    const { rememberHostedReceipt } = await import("@/lib/host-tabs");
    await rememberHostedReceipt({
      id: receiptId,
      restaurant: venueToSave.name.trim() || restaurant.trim() || "Tonight’s check",
      claimUrl: url,
      updatedAt: new Date().toISOString(),
      placeKey: placeKey ?? undefined,
      receiptDay: day,
      status: "open",
    });
  }, [fees, items, payments, receiptDate, receiptId, restaurant, venue]);

  const value = useMemo(
    () => ({
      receiptId,
      pickMode,
      image,
      restaurant,
      venue,
      receiptDate,
      items,
      fees,
      payments,
      claimUrl,
      error,
      setPick,
      setRestaurant,
      setVenue,
      setItems,
      setFees,
      setPayment,
      addPayment,
      removePayment,
      togglePaymentMethod,
      setPaymentHandle,
      runParse,
      recordParseReview,
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
      recordParseReview,
      removePayment,
      restaurant,
      venue,
      receiptDate,
      runParse,
      setPayment,
      setPaymentHandle,
      setPick,
      togglePaymentMethod,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHostDraft() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHostDraft outside provider");
  return ctx;
}
