"use client";

import { Camera, ChevronDown, Copy, ImageIcon, Share2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContinueButton, InterviewChrome, QuietButton } from "@/components/interview-chrome";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VenueTypeahead } from "@/components/venue-typeahead";
import { centsToLabel } from "@/lib/money";
import { validateHostPayments } from "@/lib/host-pay";
import { payVerifyUrl } from "@/lib/pay";
import { payMethodsForRegion } from "@/lib/pay-region";
import { api, getHostToken, saveHostToken } from "@/lib/session";
import { isValidatedVenue } from "@/lib/venue-day";
import type {
  Fee,
  HostInfo,
  Item,
  ParseReviewChoice,
  PayMethod,
  PublicReceipt,
  ReceiptVenue,
} from "@/lib/types";

type Step =
  | "ready"
  | "capture"
  | "parsing"
  | "restaurant"
  | "items"
  | "fees"
  | "pay"
  | "share";

const ORDER: Step[] = [
  "ready",
  "capture",
  "parsing",
  "restaurant",
  "items",
  "fees",
  "pay",
  "share",
];

const COPY: Record<Step, { kicker: string; title: string }> = {
  ready: { kicker: "Fair split", title: "Got the check in front of you?" },
  capture: { kicker: "The receipt", title: "How should we add the tab?" },
  parsing: { kicker: "Reading", title: "Looking over every pour…" },
  restaurant: { kicker: "The place", title: "What's the name on the check?" },
  items: { kicker: "The drinks", title: "Does this look right?" },
  fees: { kicker: "Tax & tip", title: "These follow what people ordered." },
  pay: { kicker: "Getting paid", title: "How should people pay you?" },
  share: { kicker: "Share", title: "Send this. They claim what they drank." },
};

const PAY_OPTIONS: { method: PayMethod; label: string; hint: string }[] = [
  { method: "venmo", label: "Venmo", hint: "@handle" },
  { method: "paypal", label: "PayPal", hint: "email, @user, or paypal.me/name" },
  { method: "zelle", label: "Zelle", hint: "email or phone" },
  { method: "cashapp", label: "Cash App", hint: "$cashtag" },
  { method: "moncash", label: "MonCash", hint: "Digicel phone (+509…)" },
  { method: "natcash", label: "Natcash", hint: "Natcom phone (+509…)" },
  { method: "other", label: "Other", hint: "how to pay you" },
];

type DraftItem = Item & { totalInput: string };
type DraftFee = Fee & { amountInput: string };

function toDraftItems(items: Item[]): DraftItem[] {
  return items.map((item) => ({
    ...item,
    totalInput: (item.totalCents / 100).toFixed(2),
  }));
}

function toDraftFees(fees: Fee[]): DraftFee[] {
  return fees.map((fee) => ({
    ...fee,
    amountInput: (fee.amountCents / 100).toFixed(2),
  }));
}

const fieldClass = "h-12 rounded-xl border-border bg-transparent text-base";
const denseFieldClass =
  "h-8 rounded-md border-border bg-transparent px-1.5 text-[13px] font-semibold";
const denseLabelClass =
  "mb-0.5 block text-left text-[10px] font-semibold tracking-wide text-muted-foreground";

function Choice({
  selected,
  title,
  hint,
  icon,
  onClick,
}: {
  selected?: boolean;
  title: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable flex min-h-14 w-full items-center gap-3 border-b border-border py-4 text-left last:border-b-0 ${
        selected ? "opacity-100" : ""
      }`}
    >
      <span className="flex size-10 items-center justify-center text-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      <span
        className={`size-4 rounded-full border ${
          selected ? "border-primary bg-primary" : "border-border"
        }`}
      />
    </button>
  );
}

export function HostInterview() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("ready");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pickMode, setPickMode] = useState<"camera" | "library" | null>(null);
  const [restaurant, setRestaurant] = useState("");
  const [venue, setVenue] = useState<ReceiptVenue | null>(null);
  const [receiptDate, setReceiptDate] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [fees, setFees] = useState<DraftFee[]>([]);
  const [payments, setPayments] = useState<{ method: PayMethod; handle: string }[]>([]);
  const [claimUrl, setClaimUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [payConfirming, setPayConfirming] = useState(false);
  const [itemsNoOpen, setItemsNoOpen] = useState(false);
  const [itemsYesOpen, setItemsYesOpen] = useState(false);
  const [itemsHint, setItemsHint] = useState<string | null>(null);
  const [parseReview, setParseReview] = useState<ParseReviewChoice | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const hostInfo: HostInfo = {
    payments: payments
      .map((p) => ({ method: p.method, handle: p.handle.trim() }))
      .filter((p) => p.handle),
  };
  const itemSubtotal = items.reduce((s, i) => s + i.totalCents, 0);
  const feeTotal = fees.reduce((s, f) => s + f.amountCents, 0);
  const stepIndex = ORDER.indexOf(step) + 1;

  function go(next: Step) {
    setDirection(ORDER.indexOf(next) >= ORDER.indexOf(step) ? 1 : -1);
    setStep(next);
  }

  function applyReceipt(receipt: PublicReceipt) {
    setRestaurant(receipt.restaurant);
    setVenue(receipt.venue ?? null);
    setReceiptDate(receipt.receiptDate ?? null);
    setItems(toDraftItems(receipt.items));
    setFees(toDraftFees(receipt.fees));
  }

  async function recordParseReview(choice: ParseReviewChoice) {
    if (!receiptId) return;
    try {
      await api(`/api/receipts/${receiptId}/parse-review`, {
        method: "POST",
        hostToken: getHostToken(receiptId),
        body: JSON.stringify({ choice }),
      });
    } catch {
      /* eval signal — don't block host */
    }
  }

  async function applyItemsReview(choice: ParseReviewChoice, opts?: { continue?: boolean }) {
    setItemsYesOpen(false);
    setItemsNoOpen(false);
    setParseReview(choice);
    setReviewBusy(true);
    try {
      await recordParseReview(choice);
      if (choice === "remove_items") {
        setItemsHint("Tap the trash on any line you don't want — then continue.");
      } else if (choice === "needs_edits") {
        setItemsHint("Edit any name, qty, or amount below — then continue.");
      } else {
        setItemsHint(null);
      }
      if (opts?.continue) go("fees");
    } finally {
      setReviewBusy(false);
    }
  }

  async function ensureDraft() {
    if (receiptId) return receiptId;
    const form = new FormData();
    if (file) form.set("image", file);
    const created = await api<{ receiptId: string; hostToken: string }>("/api/receipts", {
      method: "POST",
      body: form,
    });
    saveHostToken(created.receiptId, created.hostToken);
    setReceiptId(created.receiptId);
    return created.receiptId;
  }

  function onPick(next: File | null, mode: "camera" | "library") {
    setPickMode(mode);
    setFile(next);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    setError(null);
  }

  async function startParse() {
    setError(null);
    setBusy(true);
    go("parsing");
    try {
      const id = await ensureDraft();
      const token = sessionStorage.getItem(`stw-host:${id}`);
      const form = new FormData();
      if (file) form.set("image", file);
      const { receipt, parse } = await api<{
        receipt: PublicReceipt;
        parse?: { source: string; reason: string };
      }>(`/api/receipts/${id}/parse`, {
        method: "POST",
        body: form,
        hostToken: token,
      });
      applyReceipt(receipt);
      // Leave venue unset — host confirms from suggestions on the restaurant step.
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
      setDirection(1);
      setStep("restaurant");
    } catch {
      setError("Couldn't read that photo. Enter the lines yourself.");
      setDirection(1);
      setStep("restaurant");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!receiptId) return;
    setBusy(true);
    setError(null);
    try {
      if (!isValidatedVenue(venue)) {
        setError("Confirm the place from suggestions before sharing.");
        setPayConfirming(false);
        setStep("restaurant");
        return;
      }
      const token = sessionStorage.getItem(`stw-host:${receiptId}`);
      const venueToSave = venue!;
      const { claimUrl: path } = await api<{ claimUrl: string }>(`/api/receipts/${receiptId}`, {
        method: "PUT",
        hostToken: token,
        body: JSON.stringify({
          restaurant: venueToSave.name,
          venue: venueToSave,
          receiptDate,
          items: items.map(({ id, name, qty, totalCents }) => ({
            id,
            name,
            qty,
            totalCents,
          })),
          fees: fees.map(({ id, name, amountCents }) => ({ id, name, amountCents })),
          hostInfo,
          publish: true,
        }),
      });
      setClaimUrl(`${window.location.origin}${path}`);
      go("share");
    } catch (err) {
      const e = err as Error & { code?: string; message?: string };
      setError(
        e.code === "venue_day_taken" || e.message
          ? e.message
          : "Couldn't publish",
      );
    } finally {
      setBusy(false);
    }
  }

  const back: Partial<Record<Step, () => void>> = {
    capture: () => go("ready"),
    parsing: () => go("capture"),
    restaurant: () => go("capture"),
    items: () => go("restaurant"),
    fees: () => go("items"),
    pay: () => go("fees"),
  };

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (step === "ready") {
    body = (
      <>
        <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/table-ready.jpg"
            alt="Friends at a restaurant table staring at the check over wine and food"
            className="h-full w-full object-cover"
          />
        </div>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          One photo, a short review, then a link. Whole glasses only — no splitting a pour in half.
        </p>
      </>
    );
    footer = (
      <ContinueButton onClick={() => go("capture")}>Yes — start with the receipt</ContinueButton>
    );
  } else if (step === "capture") {
    body = (
      <>
        <div className="border-t border-border">
          <Choice
            icon={<Camera className="size-5" />}
            title="Take a photo"
            hint="Camera, when this device allows it"
            selected={pickMode === "camera"}
            onClick={() => cameraRef.current?.click()}
          />
          <Choice
            icon={<ImageIcon className="size-5" />}
            title="Choose from library"
            hint="JPEG, PNG, or a screenshot"
            selected={pickMode === "library"}
            onClick={() => libraryRef.current?.click()}
          />
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => onPick(e.target.files?.[0] ?? null, "camera")}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onPick(e.target.files?.[0] ?? null, "library")}
        />
        {previewUrl ? (
          <button
            type="button"
            className="pressable relative mt-4 block w-full overflow-hidden rounded-xl border border-border text-left"
            onClick={() =>
              pickMode === "camera"
                ? cameraRef.current?.click()
                : libraryRef.current?.click()
            }
            aria-label="Replace receipt photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Receipt preview" className="max-h-48 w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-[rgba(42,36,28,0.55)] py-2 text-center text-[12px] font-semibold text-[#F6F4F1]">
              Tap to replace
            </span>
          </button>
        ) : null}
        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          Photos are read on the server. You still review every line and can fix anything before
          sharing.
        </p>
      </>
    );
    footer = (
      <ContinueButton disabled={pickMode === null || !file} onClick={() => void startParse()}>
        {busy ? "Working…" : "Continue"}
      </ContinueButton>
    );
  } else if (step === "parsing") {
    body = (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="size-10 animate-spin rounded-full border-[1.5px] border-border border-t-primary" />
        <p className="mt-6 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
          This can take a few seconds. You will review every line next and can
          fix anything.
        </p>
      </div>
    );
    footer = <ContinueButton disabled>Reading the receipt</ContinueButton>;
  } else if (step === "restaurant") {
    const placeLocked = isValidatedVenue(venue);
    body = (
      <>
        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
        <VenueTypeahead
          value={restaurant}
          venue={venue}
          receiptDate={receiptDate}
          onChangeName={setRestaurant}
          onChangeVenue={setVenue}
          fieldClass={fieldClass}
        />
        {!placeLocked ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            {restaurant.trim()
              ? "Pick a match from the list — we won’t continue until you tap one."
              : "Start typing — nearby matches appear as you go."}
          </p>
        ) : null}
      </>
    );
    footer = (
      <ContinueButton disabled={!placeLocked} onClick={() => go("items")}>
        Continue
      </ContinueButton>
    );
  } else if (step === "items") {
    body = (
      <>
        {itemsHint ? (
          <p className="mb-3 rounded-xl bg-[#E6E0D8] px-3 py-2.5 text-[13px] font-medium leading-snug text-foreground">
            {itemsHint}
          </p>
        ) : (
          <p className="mb-4 text-[14px] text-muted-foreground">
            {items.length === 0
              ? "Nothing came through. Add what was on the check."
              : "Fix misreads. Quantities stay whole numbers."}
          </p>
        )}
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-end gap-1.5 py-1.5">
              <label className="min-w-0 flex-1">
                <span className={denseLabelClass}>item</span>
                <Input
                  id={`item-name-${item.id}`}
                  value={item.name}
                  onChange={(e) =>
                    setItems(
                      items.map((row) =>
                        row.id === item.id ? { ...row, name: e.target.value } : row,
                      ),
                    )
                  }
                  className={denseFieldClass}
                  placeholder="Item name"
                />
              </label>
              <label className="w-10 shrink-0">
                <span className={denseLabelClass}>qty</span>
                <Input
                  id={`item-qty-${item.id}`}
                  inputMode="numeric"
                  aria-label="Quantity"
                  value={item.qty}
                  onChange={(e) => {
                    const qty = Math.max(1, Math.floor(Number(e.target.value) || 0));
                    setItems(items.map((row) => (row.id === item.id ? { ...row, qty } : row)));
                  }}
                  className={`${denseFieldClass} text-left tabular-nums`}
                />
              </label>
              <label className="w-[3.6rem] shrink-0">
                <span className={denseLabelClass}>amt</span>
                <Input
                  id={`item-total-${item.id}`}
                  inputMode="decimal"
                  aria-label="Line total"
                  value={item.totalInput}
                  onChange={(e) => {
                    const totalInput = e.target.value;
                    const totalCents = Math.round((Number(totalInput) || 0) * 100);
                    setItems(
                      items.map((row) =>
                        row.id === item.id ? { ...row, totalInput, totalCents } : row,
                      ),
                    );
                  }}
                  className={`${denseFieldClass} text-left tabular-nums`}
                />
              </label>
              <button
                type="button"
                className={`pressable flex h-8 w-7 shrink-0 items-center justify-center ${
                  parseReview === "remove_items"
                    ? "rounded-md bg-[rgba(110,46,53,0.08)] text-[#6E2E35]"
                    : ""
                }`}
                aria-label={`Remove ${item.name || "line"}`}
                onClick={() => setItems(items.filter((row) => row.id !== item.id))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <QuietButton
          className="mt-2"
          onClick={() =>
            setItems([
              ...items,
              {
                id: `new_${crypto.randomUUID().slice(0, 8)}`,
                name: "",
                qty: 1,
                totalCents: 0,
                totalInput: "0.00",
              },
            ])
          }
        >
          Add a line
        </QuietButton>
      </>
    );
    const itemsOk =
      items.length > 0 && !items.some((i) => !i.name.trim() || i.qty < 1);
    footer = (
      <div>
        <p className="mb-2 text-center text-[13px] tabular-nums text-muted-foreground">
          Items {centsToLabel(itemSubtotal)}
        </p>
        <p className="mb-2 text-center text-[13px] font-bold text-foreground">Looks good?</p>
        {itemsYesOpen ? (
          <div className="mb-2 overflow-hidden rounded-xl border border-border bg-white">
            <button
              type="button"
              disabled={reviewBusy || !itemsOk}
              className="block w-full px-3.5 py-3.5 text-left text-[14px] font-semibold text-foreground hover:bg-[#F6F4F1] disabled:opacity-40"
              onClick={() => void applyItemsReview("looks_good", { continue: true })}
            >
              Looks good
            </button>
            <div className="h-px bg-border" />
            <button
              type="button"
              disabled={reviewBusy}
              className="block w-full px-3.5 py-3.5 text-left text-[14px] font-semibold text-foreground hover:bg-[#F6F4F1] disabled:opacity-40"
              onClick={() => void applyItemsReview("remove_items")}
            >
              Yes but I need to remove some items
            </button>
          </div>
        ) : null}
        {itemsNoOpen ? (
          <div className="mb-2 overflow-hidden rounded-xl border border-border bg-white">
            <button
              type="button"
              disabled={reviewBusy}
              className="block w-full px-3.5 py-3.5 text-left text-[14px] font-semibold text-foreground hover:bg-[#F6F4F1] disabled:opacity-40"
              onClick={() => void applyItemsReview("needs_edits")}
            >
              No I need to make edits
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={reviewBusy}
            className={`pressable inline-flex h-12 flex-1 items-center justify-center gap-1 rounded-full border px-4 text-[15px] font-bold ${
              parseReview === "looks_good" || parseReview === "remove_items"
                ? "border-[#6E2E35] bg-[rgba(110,46,53,0.06)]"
                : "border-border bg-background"
            }`}
            aria-expanded={itemsYesOpen}
            onClick={() => {
              setItemsYesOpen((v) => !v);
              setItemsNoOpen(false);
            }}
          >
            Yes
            <ChevronDown
              className={`size-4 transition-transform ${itemsYesOpen ? "rotate-180" : ""}`}
            />
          </button>
          <button
            type="button"
            disabled={reviewBusy}
            className={`pressable inline-flex h-12 flex-1 items-center justify-center gap-1 rounded-full border px-4 text-[15px] font-bold ${
              parseReview === "needs_edits"
                ? "border-[#6E2E35] bg-[rgba(110,46,53,0.06)]"
                : "border-border bg-background"
            }`}
            aria-expanded={itemsNoOpen}
            onClick={() => {
              setItemsNoOpen((v) => !v);
              setItemsYesOpen(false);
            }}
          >
            No
            <ChevronDown
              className={`size-4 transition-transform ${itemsNoOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {parseReview && parseReview !== "looks_good" ? (
          <button
            type="button"
            disabled={reviewBusy || !itemsOk}
            className="pressable mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#6E2E35] text-[15px] font-bold text-white disabled:opacity-40"
            onClick={() => go("fees")}
          >
            Continue
          </button>
        ) : null}
      </div>
    );
  } else if (step === "fees") {
    body = (
      <>
        <p className="mb-4 text-[14px] text-muted-foreground">
          Admin, gratuity, tax — never an even split by headcount.
        </p>
        <ul className="divide-y divide-border border-y border-border">
          {fees.map((fee) => (
            <li key={fee.id} className="flex items-end gap-1.5 py-1.5">
              <label className="min-w-0 flex-1">
                <span className={denseLabelClass}>fee</span>
                <Input
                  value={fee.name}
                  onChange={(e) =>
                    setFees(
                      fees.map((row) =>
                        row.id === fee.id ? { ...row, name: e.target.value } : row,
                      ),
                    )
                  }
                  className={denseFieldClass}
                  placeholder="Fee name"
                />
              </label>
              <label className="w-16 shrink-0">
                <span className={denseLabelClass}>amt</span>
                <Input
                  className={`${denseFieldClass} text-left tabular-nums`}
                  inputMode="decimal"
                  aria-label="Amount"
                  value={fee.amountInput}
                  onChange={(e) => {
                    const amountInput = e.target.value;
                    const amountCents = Math.round((Number(amountInput) || 0) * 100);
                    setFees(
                      fees.map((row) =>
                        row.id === fee.id ? { ...row, amountInput, amountCents } : row,
                      ),
                    );
                  }}
                />
              </label>
              <button
                type="button"
                className="pressable flex h-8 w-7 shrink-0 items-center justify-center"
                aria-label={`Remove ${fee.name || "fee"}`}
                onClick={() => setFees(fees.filter((row) => row.id !== fee.id))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <QuietButton
          className="mt-2"
          onClick={() =>
            setFees([
              ...fees,
              {
                id: `new_${crypto.randomUUID().slice(0, 8)}`,
                name: "",
                amountCents: 0,
                amountInput: "0.00",
              },
            ])
          }
        >
          Add a fee
        </QuietButton>
      </>
    );
    footer = (
      <div>
        <p className="mb-2 text-center text-[13px] tabular-nums text-muted-foreground">
          Grand {centsToLabel(itemSubtotal + feeTotal)}
        </p>
        <ContinueButton onClick={() => go("pay")}>Continue</ContinueButton>
      </div>
    );
  } else if (step === "pay") {
    const regionMethods = new Set(payMethodsForRegion());
    const payOptions = PAY_OPTIONS.filter((o) => regionMethods.has(o.method));
    if (payConfirming) {
      const checked = validateHostPayments(payments);
      const rows = checked.ok ? checked.payments : hostInfo.payments;
      body = (
        <>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <div className="mb-4 rounded-xl border border-[rgba(110,46,53,0.28)] bg-[rgba(110,46,53,0.06)] px-3.5 py-3.5">
            <p className="text-[14px] font-bold text-foreground">Guests pay exactly what you enter</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Wrong handle or number means the payment won’t reach you — we can’t verify accounts
              live. Double-check each line.
            </p>
          </div>
          <ul className="space-y-3">
            {rows.map((payment) => {
              const verify = payVerifyUrl(payment.method, payment.handle);
              const label =
                PAY_OPTIONS.find((o) => o.method === payment.method)?.label ?? payment.method;
              return (
                <li
                  key={payment.method}
                  className="flex items-start gap-3 rounded-xl border border-border px-3 py-3"
                >
                  <PayMethodIcon method={payment.method} size={48} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
                    <div className="text-[17px] font-semibold tracking-tight">{payment.handle}</div>
                    {verify ? (
                      <a
                        href={verify}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-[13px] font-bold text-primary"
                      >
                        Open {label} to check
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      );
      footer = (
        <div>
          <p className="mb-2 text-center text-[13px] font-medium text-muted-foreground">
            A quick glance now beats chasing people later.
          </p>
          <ContinueButton disabled={busy} onClick={() => void publish()}>
            {busy ? "Publishing…" : "Looks good — create link"}
          </ContinueButton>
          <QuietButton onClick={() => setPayConfirming(false)}>Edit</QuietButton>
        </div>
      );
    } else {
      const selected = new Set(payments.map((p) => p.method));
      const handleRows = payOptions
        .map((o) => payments.find((p) => p.method === o.method))
        .filter((p): p is { method: PayMethod; handle: string } => Boolean(p));

      function toggleMethod(method: PayMethod) {
        setError(null);
        setPayments((prev) => {
          const idx = prev.findIndex((p) => p.method === method);
          if (idx >= 0) return prev.filter((_, i) => i !== idx);
          return [...prev, { method, handle: "" }];
        });
      }

      body = (
        <>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <p className="mb-4 text-[14px] leading-relaxed text-muted-foreground">
            Tap every app you accept. Then add your handle for each.
          </p>
          <div className="mb-2 flex flex-wrap gap-2.5">
            {payOptions.map((option) => {
              const on = selected.has(option.method);
              return (
                <button
                  key={option.method}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMethod(option.method)}
                  className={`pressable flex min-w-[96px] flex-1 flex-col items-center gap-2 rounded-[14px] border-[1.5px] px-2.5 py-3.5 ${
                    on
                      ? "border-[#2F5D50] bg-[rgba(47,93,80,0.14)]"
                      : "border-border bg-transparent"
                  }`}
                >
                  <PayMethodIcon method={option.method} size={48} />
                  <span
                    className={`text-[13px] font-semibold ${
                      on ? "font-bold text-[#2F5D50]" : "text-ink-soft"
                    }`}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          {handleRows.length > 0 ? (
            <div className="mt-5 space-y-3">
              <p className="text-[13px] font-bold tracking-wide text-ink-soft">Your handles</p>
              {handleRows.map((payment) => {
                const meta = payOptions.find((o) => o.method === payment.method);
                return (
                  <div
                    key={payment.method}
                    className="rounded-xl border border-border bg-[#FFFcf8] p-3"
                  >
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <PayMethodIcon method={payment.method} size={40} />
                      <span className="text-[15px] font-bold">{meta?.label ?? payment.method}</span>
                    </div>
                    <Label className="mb-2 text-[13px] font-medium">Your {meta?.hint}</Label>
                    <Input
                      value={payment.handle}
                      onChange={(e) => {
                        setError(null);
                        const handle = e.target.value;
                        setPayments((prev) =>
                          prev.map((row) =>
                            row.method === payment.method ? { ...row, handle } : row,
                          ),
                        );
                      }}
                      placeholder={
                        payment.method === "cashapp"
                          ? "$alex"
                          : payment.method === "venmo"
                            ? "@alex"
                            : payment.method === "paypal"
                              ? "paypal.me/alex"
                              : payment.method === "zelle"
                                ? "alex@email.com"
                                : payment.method === "moncash" || payment.method === "natcash"
                                  ? "+509 3XXX XXXX"
                                  : "how to pay you"
                      }
                      className={fieldClass}
                      autoCapitalize="none"
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      );
      footer = (
        <ContinueButton
          disabled={payments.length === 0}
          onClick={() => {
            if (payments.length === 0) {
              setError("Tap at least one way people can pay you.");
              return;
            }
            const result = validateHostPayments(payments);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setError(null);
            setPayConfirming(true);
          }}
        >
          {handleRows.length === 0 ? "Select a payment method" : "Review payment info"}
        </ContinueButton>
      );
    }
  } else {
    body = (
      <>
        <p className="break-all rounded-xl border border-border px-3 py-3 font-mono text-[13px]">
          {claimUrl}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <QuietButton
            onClick={async () => {
              await navigator.clipboard.writeText(claimUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="size-4" strokeWidth={2.25} aria-hidden />
            {copied ? "Copied" : "Copy"}
          </QuietButton>
          <QuietButton
            onClick={async () => {
              if (navigator.share) {
                await navigator.share({
                  title: "Split the Wine",
                  text: `Claim what you ordered at ${restaurant}`,
                  url: claimUrl,
                });
              } else {
                await navigator.clipboard.writeText(claimUrl);
                setCopied(true);
              }
            }}
          >
            <Share2 className="size-4" strokeWidth={2.25} aria-hidden />
            Share
          </QuietButton>
        </div>
        <div className="mt-8 flex items-center justify-between text-[14px]">
          <span className="text-muted-foreground">Check total</span>
          <span className="tabular-nums font-medium">{centsToLabel(itemSubtotal + feeTotal)}</span>
        </div>
      </>
    );
    footer = (
      <div className="space-y-1">
        <ContinueButton onClick={() => router.push(`/r/${receiptId}?host=1`)}>
          Open the live board
        </ContinueButton>
        <QuietButton onClick={() => router.push("/")}>Done for now</QuietButton>
      </div>
    );
  }

  return (
    <InterviewChrome
      step={stepIndex}
      total={8}
      kicker={COPY[step].kicker}
      title={COPY[step].title}
      onBack={
        step === "ready"
          ? () => router.push("/")
          : back[step]
      }
      direction={direction}
      stepKey={step}
      footer={footer}
    >
      {body}
    </InterviewChrome>
  );
}
