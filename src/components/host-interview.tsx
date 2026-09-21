"use client";

import { Camera, ImageIcon, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContinueButton, InterviewChrome, QuietButton } from "@/components/interview-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToLabel } from "@/lib/money";
import { validateHostPayments } from "@/lib/host-pay";
import { api, saveHostToken } from "@/lib/session";
import type { Fee, HostInfo, Item, PayMethod, PublicReceipt } from "@/lib/types";

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
  const [items, setItems] = useState<DraftItem[]>([]);
  const [fees, setFees] = useState<DraftFee[]>([]);
  const [payments, setPayments] = useState<{ method: PayMethod; handle: string }[]>([
    { method: "venmo", handle: "" },
  ]);
  const [claimUrl, setClaimUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [payConfirming, setPayConfirming] = useState(false);

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
    setItems(toDraftItems(receipt.items));
    setFees(toDraftFees(receipt.fees));
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
      const token = sessionStorage.getItem(`stw-host:${receiptId}`);
      const { claimUrl: path } = await api<{ claimUrl: string }>(`/api/receipts/${receiptId}`, {
        method: "PUT",
        hostToken: token,
        body: JSON.stringify({
          restaurant,
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
      setError(err instanceof Error ? err.message : "Couldn't publish");
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
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        One photo, a short review, then a link. Whole glasses only — no splitting a pour in half.
      </p>
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
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Receipt preview" className="max-h-48 w-full object-cover" />
          </div>
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
    body = (
      <>
        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
        <Label htmlFor="restaurant" className="mb-2 text-[13px] font-medium">
          Restaurant or bar
        </Label>
        <Input
          id="restaurant"
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          placeholder="The Bar"
          className={fieldClass}
          autoComplete="organization"
        />
      </>
    );
    footer = (
      <ContinueButton disabled={!restaurant.trim()} onClick={() => go("items")}>
        Continue
      </ContinueButton>
    );
  } else if (step === "items") {
    body = (
      <>
        <p className="mb-4 text-[14px] text-muted-foreground">
          {items.length === 0
            ? "Nothing came through. Add what was on the check."
            : "Fix misreads. Quantities stay whole numbers."}
        </p>
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
                className="pressable flex h-8 w-7 shrink-0 items-center justify-center"
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
    footer = (
      <div>
        <p className="mb-2 text-center text-[13px] tabular-nums text-muted-foreground">
          Items {centsToLabel(itemSubtotal)}
        </p>
        <ContinueButton
          disabled={items.length === 0 || items.some((i) => !i.name.trim() || i.qty < 1)}
          onClick={() => go("fees")}
        >
          Looks good
        </ContinueButton>
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
    const used = new Set(payments.map((p) => p.method));
    const unused = PAY_OPTIONS.filter((o) => !used.has(o.method));
    if (payConfirming) {
      const checked = validateHostPayments(payments);
      const rows = checked.ok ? checked.payments : hostInfo.payments;
      body = (
        <>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <p className="mb-4 text-[14px] leading-relaxed text-muted-foreground">
            Claimers will see these options. A typo here means money goes to the wrong place.
          </p>
          <ul className="space-y-3">
            {rows.map((payment) => (
              <li
                key={payment.method}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3"
              >
                <span className="text-[13px] font-semibold text-ink-soft">
                  {PAY_OPTIONS.find((o) => o.method === payment.method)?.label}
                </span>
                <span className="text-[17px] font-semibold tracking-tight">{payment.handle}</span>
              </li>
            ))}
          </ul>
        </>
      );
      footer = (
        <div>
          <ContinueButton disabled={busy} onClick={() => void publish()}>
            {busy ? "Publishing…" : "Looks good — create link"}
          </ContinueButton>
          <QuietButton onClick={() => setPayConfirming(false)}>Edit</QuietButton>
        </div>
      );
    } else {
      body = (
        <>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <p className="mb-4 text-[14px] leading-relaxed text-muted-foreground">
            Add every app you accept. We check the format for typos, then you confirm before
            publishing.
          </p>
          {payments.map((payment, index) => (
            <div
              key={`${payment.method}-${index}`}
              className="mb-4 rounded-xl border border-border p-3"
            >
              <div className="mb-3 flex flex-wrap gap-2">
                {PAY_OPTIONS.map((option) => {
                  const taken = payments.some((p, i) => i !== index && p.method === option.method);
                  if (taken) return null;
                  const on = payment.method === option.method;
                  return (
                    <button
                      key={option.method}
                      type="button"
                      onClick={() =>
                        setPayments((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, method: option.method } : row,
                          ),
                        )
                      }
                      className={`pressable rounded-lg border px-2.5 py-1.5 text-[13px] font-medium ${
                        on
                          ? "border-primary text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                {payments.length > 1 ? (
                  <QuietButton
                    onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </QuietButton>
                ) : null}
              </div>
              <Label className="mb-2 text-[13px] font-medium">
                Your {PAY_OPTIONS.find((o) => o.method === payment.method)?.hint}
              </Label>
              <Input
                value={payment.handle}
                onChange={(e) => {
                  setError(null);
                  setPayments((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, handle: e.target.value } : row)),
                  );
                }}
                placeholder="@alex"
                className={fieldClass}
              />
            </div>
          ))}
          {unused.length > 0 ? (
            <QuietButton
              onClick={() =>
                setPayments((prev) => [...prev, { method: unused[0].method, handle: "" }])
              }
            >
              Add another way to pay
            </QuietButton>
          ) : null}
        </>
      );
      footer = (
        <ContinueButton
          onClick={() => {
            const result = validateHostPayments(payments);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setError(null);
            setPayConfirming(true);
          }}
        >
          Review payment info
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
            {copied ? "Copied" : "Copy link"}
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
