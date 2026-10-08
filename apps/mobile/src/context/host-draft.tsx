import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "expo-router";
import { api, createDraftReceipt, parseReceiptWithImage, submitParseReview } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import {
  clearHostDraft,
  clearHostDraftForReceipt,
  draftHasProgress,
  loadHostDraft,
  saveHostDraft,
  type PersistedHostDraft,
} from "@/lib/host-draft-store";
import { nextUnusedPayMethod } from "@/lib/pay-region";
import { normalizeHostNote } from "@/lib/host-pay";
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
  ready: boolean;
  hasSavedProgress: boolean;
  receiptId: string | null;
  pickMode: PickMode;
  image: PickedImage | null;
  restaurant: string;
  venue: ReceiptVenue | null;
  receiptDate: string | null;
  items: DraftItem[];
  fees: DraftFee[];
  payments: HostPayment[];
  /** Optional note for claimers on the share link. */
  note: string;
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
  setNote: (v: string) => void;
  /** Bind host draft to an existing planning outing (same id for attach-receipt). */
  adoptOuting: (receiptId: string) => Promise<void>;
  runParse: () => Promise<{
    reason: string;
    skipRestaurant?: boolean;
    /** Planned pin kept; OCR place name looks different — host should confirm. */
    placeMismatch?: { planned: string; scanned: string } | null;
  } | null>;
  recordParseReview: (choice: ParseReviewChoice) => Promise<void>;
  publish: () => Promise<void>;
  clearSavedDraft: () => Promise<void>;
};

const Ctx = createContext<HostDraft | null>(null);

export function HostDraftProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [restaurant, setRestaurant] = useState("");
  const [venue, setVenue] = useState<ReceiptVenue | null>(null);
  const [receiptDate, setReceiptDate] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [fees, setFees] = useState<DraftFee[]>([]);
  const [payments, setPayments] = useState<HostPayment[]>([]);
  const [note, setNote] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resumePathRef = useRef<string | null>(null);
  const skipPersist = useRef(true);
  /** Bumped on clear / parse so a slow AsyncStorage hydrate cannot revive a stale pin. */
  const draftEpochRef = useRef(0);
  /** Coalesce double Continue / remount so a late timeout cannot wipe a good parse. */
  const parseInFlightRef = useRef<ReturnType<HostDraft["runParse"]> | null>(null);
  /** After a successful publish, keep in-memory fields for the share screen but never re-cache. */
  const [published, setPublished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = draftEpochRef.current;
    void (async () => {
      const saved = await loadHostDraft();
      if (cancelled || epochAtStart !== draftEpochRef.current) return;
      if (saved && draftHasProgress(saved)) {
        setReceiptId(saved.receiptId);
        setRestaurant(saved.restaurant);
        setVenue(saved.venue);
        setReceiptDate(saved.receiptDate);
        setItems(saved.items);
        setFees(saved.fees);
        setPayments(saved.payments);
        setNote(saved.note);
        setPickMode(saved.pickMode);
        resumePathRef.current = saved.resumePath;
        if (saved.imageUri) {
          setImage({ uri: saved.imageUri, mimeType: "image/jpeg", fileName: "receipt.jpg" });
        }
      }
      if (cancelled || epochAtStart !== draftEpochRef.current) return;
      setReady(true);
      // Avoid writing back the empty initial state before hydrate finishes.
      requestAnimationFrame(() => {
        if (epochAtStart !== draftEpochRef.current) return;
        skipPersist.current = false;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/host/") && pathname !== "/host") {
      resumePathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    if (!ready || skipPersist.current || published) return;
    const snapshot: PersistedHostDraft = {
      version: 1,
      updatedAt: new Date().toISOString(),
      receiptId,
      restaurant,
      venue,
      receiptDate,
      items,
      fees,
      payments,
      note,
      imageUri: image?.uri ?? null,
      pickMode,
      resumePath: resumePathRef.current,
    };
    const t = setTimeout(() => {
      // Re-check: publish / discard may have flipped this after the effect scheduled.
      if (skipPersist.current || published) return;
      void saveHostDraft(snapshot);
    }, 250);
    return () => clearTimeout(t);
  }, [
    ready,
    published,
    receiptId,
    restaurant,
    venue,
    receiptDate,
    items,
    fees,
    payments,
    note,
    image,
    pickMode,
    pathname,
  ]);

  const clearSavedDraft = useCallback(async () => {
    draftEpochRef.current += 1;
    skipPersist.current = true;
    setPublished(false);
    await clearHostDraft();
    setReceiptId(null);
    setPickMode(null);
    setImage(null);
    setRestaurant("");
    setVenue(null);
    setReceiptDate(null);
    setItems([]);
    setFees([]);
    setPayments([]);
    setNote("");
    setClaimUrl("");
    setError(null);
    resumePathRef.current = null;
    skipPersist.current = false;
  }, []);

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
    // Always leave place unconfirmed — host must tap a Places row on step 4.
    // (API also clears venue on parse; this blocks stale draft hydrate races.)
    setVenue(null);
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

  const adoptOuting = useCallback(async (id: string) => {
    const { getHostToken } = await import("@/lib/session");
    if (!getHostToken(id)) {
      throw new Error("Missing host token for this outing.");
    }
    setReceiptId(id);
    try {
      const receipt = await api<import("@/lib/types").PublicReceipt>(`/api/receipts/${id}`, {
        hostToken: getHostToken(id),
      });
      if (receipt.venue) {
        setVenue(receipt.venue);
        setRestaurant(receipt.venue.name || receipt.restaurant || "");
      }
      if (receipt.receiptDate) setReceiptDate(receipt.receiptDate);
      if (receipt.hostInfo?.note) setNote(receipt.hostInfo.note);
      if (receipt.hostInfo?.payments?.length) setPayments(receipt.hostInfo.payments);
    } catch {
      /* board can still attach with id alone */
    }
  }, []);

  const runParse = useCallback((): ReturnType<HostDraft["runParse"]> => {
    if (parseInFlightRef.current) return parseInFlightRef.current;

    const work = (async () => {
      const epoch = ++draftEpochRef.current;
      setError(null);
      try {
        const id = await ensureDraft();
        const { getHostToken } = await import("@/lib/session");
        const { venueNamesLikelyDifferent } = await import("@/lib/venue-match");
        const plannedBefore = venue;
        const { receipt, parse } = await parseReceiptWithImage(id, {
          image,
          hostToken: getHostToken(id),
        });
        if (epoch !== draftEpochRef.current) return null;
        const reason = parse?.reason ?? "ok";
        if (reason === "not_receipt") {
          setError("That doesn’t look like a receipt or tab. Please upload a photo of the check.");
          return { reason };
        }
        // Don't let a timed-out/failed empty body clear lines already on the draft.
        const incomingEmpty = (receipt.items?.length ?? 0) === 0;
        if (!incomingEmpty || reason === "ok") {
          applyReceipt(receipt);
        } else {
          setItems((prev) => {
            if (prev.length > 0) return prev;
            return toDraftItems(receipt.items);
          });
          setFees((prev) => {
            if (prev.length > 0) return prev;
            return toDraftFees(receipt.fees);
          });
        }
        const kept =
          receipt.venue?.source === "places" &&
          typeof receipt.venue.lat === "number" &&
          typeof receipt.venue.lng === "number";
        if (kept && receipt.venue) {
          setVenue(receipt.venue);
          setRestaurant(receipt.venue.name || receipt.restaurant || "");
        } else if (plannedBefore?.source === "places") {
          // Server should keep the pin; if it didn't, don't wipe the host's plan place.
          setVenue(plannedBefore);
          setRestaurant(plannedBefore.name || restaurant);
        } else {
          setVenue(null);
        }
        if (reason === "empty") {
          setError("We couldn't find any drinks. Add them on the next screens.");
        } else if (reason === "failed") {
          setError("Couldn't read that photo. Add the lines on the next screens.");
        } else if (reason === "timeout") {
          setError("Reading timed out. Try a clearer photo, or add the lines yourself.");
        } else if (reason === "no_key") {
          setError("Scanning isn't configured here. Add the lines on the next screens.");
        } else if (reason === "no_image") {
          setError("No photo attached. Add the lines on the next screens.");
        } else {
          setError(null);
        }
        const plannedName =
          (kept && receipt.venue?.name) || plannedBefore?.name || restaurant || "";
        const scannedName = parse?.scannedRestaurant?.trim() || "";
        const placeMismatch =
          Boolean(plannedName && scannedName) &&
          venueNamesLikelyDifferent(plannedName, scannedName)
            ? { planned: plannedName.trim(), scanned: scannedName }
            : null;
        return {
          reason,
          skipRestaurant: Boolean(kept || plannedBefore?.source === "places"),
          placeMismatch,
        };
      } catch (err) {
        if (epoch !== draftEpochRef.current) return null;
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
        return null;
      } finally {
        if (parseInFlightRef.current === work) parseInFlightRef.current = null;
      }
    })();

    parseInFlightRef.current = work;
    return work;
  }, [applyReceipt, ensureDraft, image, restaurant, venue]);

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
    if (!receiptId) throw new Error("Draft missing — go back and re-open the check photo.");
    const { validateHostPayments } = await import("@/lib/host-pay");
    const { isValidatedVenue, receiptDayKey, venueLocationKey } = await import("@/lib/venue-day");
    const checked = validateHostPayments(payments);
    if (!checked.ok) throw new Error(checked.message);
    if (!isValidatedVenue(venue)) {
      throw new Error("Confirm the place from suggestions before sharing.");
    }
    const { getHostToken } = await import("@/lib/session");
    const token = getHostToken(receiptId);
    if (!token) {
      throw new Error("Host session expired on this phone. Start again from the receipt photo.");
    }
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
        hostToken: token,
        body: JSON.stringify({
          restaurant: venueToSave.name ?? restaurant,
          venue: venueToSave,
          receiptDate,
          items: items
            .filter((row) => !row.removed)
            .map(({ id, name, qty, totalCents, kind, pour }) => ({
              id,
              name,
              qty,
              totalCents,
              kind: kind ?? null,
              pour: pour ?? null,
            })),
          fees: fees.map(({ id, name, amountCents }) => ({ id, name, amountCents })),
          hostInfo: {
            payments: checked.payments,
            ...(normalizeHostNote(note) ? { note: normalizeHostNote(note) } : {}),
          },
          publish: true,
        }),
      });
    } catch (err) {
      const e = err as { code?: string; message?: string; existingId?: string };
      if (e.code === "venue_day_taken") {
        // If the conflicting tab was only hidden locally, put it back on Home so trash can delete it.
        if (e.existingId && e.existingId !== receiptId) {
          const { getHostToken: tokenFor } = await import("@/lib/session");
          const existingToken = tokenFor(e.existingId);
          if (existingToken) {
            const { rememberHostedReceipt } = await import("@/lib/host-tabs");
            await rememberHostedReceipt({
              id: e.existingId,
              restaurant: venueToSave.name.trim() || restaurant.trim() || "Tonight’s check",
              claimUrl: publicClaimUrl(e.existingId),
              updatedAt: new Date().toISOString(),
              placeKey: placeKey ?? undefined,
              receiptDay: day,
              status: "open",
              venueLat: venueToSave.lat ?? null,
              venueLng: venueToSave.lng ?? null,
              venueCategory: venueToSave.category ?? null,
            });
          }
        }
        throw new Error(
          e.message
            ? `${e.message} Delete that tab from Home, then publish again.`
            : "You already have a tab for that place today. Delete it from Home, then publish again.",
        );
      }
      if (e.code === "invalid") {
        throw new Error(e.message || "Couldn't publish that place for today.");
      }
      if (e.message && e.message !== "request_failed") {
        throw new Error(e.message);
      }
      throw new Error(
        "Couldn't reach the API to publish. Check the API URL on Home, then tap publish again — your draft is saved.",
      );
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
      venueLat: venueToSave.lat ?? null,
      venueLng: venueToSave.lng ?? null,
      venueCategory: venueToSave.category ?? null,
    });
    // Keep interview fields in memory for /host/share, but stop caching — otherwise
    // the autosave effect rewrites the draft and Home shows Draft + Open.
    skipPersist.current = true;
    setPublished(true);
    resumePathRef.current = null;
    await clearHostDraftForReceipt(receiptId);
  }, [fees, items, note, payments, receiptDate, receiptId, restaurant, venue]);

  const hasSavedProgress =
    !published &&
    draftHasProgress({
      version: 1,
      updatedAt: "",
      receiptId,
      restaurant,
      venue,
      receiptDate,
      items,
      fees,
      payments,
      note,
      imageUri: image?.uri ?? null,
      pickMode,
      resumePath: resumePathRef.current,
    });

  const value = useMemo(
    () => ({
      ready,
      hasSavedProgress,
      receiptId,
      pickMode,
      image,
      restaurant,
      venue,
      receiptDate,
      items,
      fees,
      payments,
      note,
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
      setNote,
      adoptOuting,
      runParse,
      recordParseReview,
      publish,
      clearSavedDraft,
    }),
    [
      addPayment,
      adoptOuting,
      claimUrl,
      clearSavedDraft,
      error,
      fees,
      hasSavedProgress,
      image,
      items,
      note,
      payments,
      pickMode,
      publish,
      ready,
      receiptId,
      recordParseReview,
      removePayment,
      restaurant,
      venue,
      receiptDate,
      runParse,
      setPayment,
      setPaymentHandle,
      setNote,
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

export { resumePathForDraft } from "@/lib/host-draft-store";
