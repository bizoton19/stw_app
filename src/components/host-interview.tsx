"use client";

import { Camera, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContinueButton, InterviewChrome } from "@/components/interview-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToLabel } from "@/lib/money";
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

const STEP_INDEX: Record<Step, number> = {
  ready: 1,
  capture: 2,
  parsing: 3,
  restaurant: 4,
  items: 5,
  fees: 6,
  pay: 7,
  share: 8,
};

const PAY_OPTIONS: { method: PayMethod; label: string; hint: string }[] = [
  { method: "venmo", label: "Venmo", hint: "@handle" },
  { method: "zelle", label: "Zelle", hint: "email or phone" },
  { method: "cashapp", label: "Cash App", hint: "$cashtag" },
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

export function HostInterview() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("ready");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [useSample, setUseSample] = useState(false);
  const [restaurant, setRestaurant] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [fees, setFees] = useState<DraftFee[]>([]);
  const [method, setMethod] = useState<PayMethod>("venmo");
  const [handle, setHandle] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const hostInfo: HostInfo = { method, handle: handle.trim() };
  const itemSubtotal = items.reduce((s, i) => s + i.totalCents, 0);
  const feeTotal = fees.reduce((s, f) => s + f.amountCents, 0);

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

  function onPick(next: File | null, sample: boolean) {
    setUseSample(sample);
    setFile(sample ? null : next);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    setError(null);
  }

  async function startParse() {
    setError(null);
    setBusy(true);
    setStep("parsing");
    try {
      const id = await ensureDraft();
      const token = sessionStorage.getItem(`stw-host:${id}`);
      const form = new FormData();
      if (file) form.set("image", file);
      const { receipt } = await api<{ receipt: PublicReceipt }>(`/api/receipts/${id}/parse`, {
        method: "POST",
        body: form,
        hostToken: token,
      });
      applyReceipt(receipt);
      setStep("restaurant");
    } catch {
      setError("Couldn't read that photo. Enter the lines yourself — same next steps.");
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
      const url = `${window.location.origin}${path}`;
      setClaimUrl(url);
      setStep("share");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish");
    } finally {
      setBusy(false);
    }
  }

  const continueLabel = busy ? "Working…" : "Continue";

  if (step === "ready") {
    return (
      <InterviewChrome
        step={STEP_INDEX.ready}
        total={8}
        kicker="Fair split"
        title="Got the check in front of you?"
        footer={
          <ContinueButton onClick={() => setStep("capture")}>
            Yes — start with the receipt
          </ContinueButton>
        }
      >
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Photograph the tab, fix anything the scan misses, then send a link.
          Friends claim what they actually ordered. Tax and tip follow the
          drinks — not the headcount.
        </p>
        <ul className="mt-6 space-y-3 text-sm">
          {[
            "One photo, then a short review",
            "Guests don't need the app — just the link",
            "Whole glasses only. No splitting a pour in half",
          ].map((line) => (
            <li
              key={line}
              className="flex gap-3 rounded-2xl bg-ice px-4 py-3 ring-1 ring-sky-ink/10"
            >
              <span className="mt-0.5 size-2 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>
      </InterviewChrome>
    );
  }

  if (step === "capture") {
    return (
      <InterviewChrome
        step={STEP_INDEX.capture}
        total={8}
        kicker="The receipt"
        title="How do you want to add the tab?"
        onBack={() => setStep("ready")}
        footer={
          <ContinueButton
            disabled={!useSample && !file}
            onClick={() => void startParse()}
          >
            {useSample ? "Use the sample bar tab" : continueLabel}
          </ContinueButton>
        }
      >
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 py-4 text-left ring-1 ring-border transition hover:ring-primary"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Camera className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">Take a photo</span>
              <span className="text-sm text-muted-foreground">
                Uses the camera when this browser allows it
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 py-4 text-left ring-1 ring-border transition hover:ring-primary"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <ImageIcon className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">Choose from library</span>
              <span className="text-sm text-muted-foreground">
                Upload a JPEG, PNG, or screenshot
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onPick(null, true)}
            className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-4 text-left ring-1 transition ${
              useSample
                ? "bg-ice ring-sky-ink/40"
                : "bg-card ring-border hover:ring-primary"
            }`}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-ice text-primary">
              <Sparkles className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">Use the sample bar tab</span>
              <span className="text-sm text-muted-foreground">
                16 lines, wine package vs apple juice — no camera needed
              </span>
            </span>
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => onPick(e.target.files?.[0] ?? null, false)}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onPick(e.target.files?.[0] ?? null, false)}
        />
        {previewUrl ? (
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Receipt preview" className="max-h-56 w-full object-cover" />
          </div>
        ) : null}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Scanning is stubbed until a vision key is wired in. Any photo still
          lands you on the sample tab so you can finish the split today.
        </p>
      </InterviewChrome>
    );
  }

  if (step === "parsing") {
    return (
      <InterviewChrome
        step={STEP_INDEX.parsing}
        total={8}
        kicker="Reading"
        title="Looking over every pour and plate…"
        footer={
          <ContinueButton disabled>
            Reading the receipt
          </ContinueButton>
        }
      >
        <div className="flex flex-col items-center py-10 text-center">
          <div className="relative size-24">
            <div className="absolute inset-0 animate-pulse rounded-full bg-secondary" />
            <div className="absolute inset-3 animate-bounce rounded-full bg-primary/90" />
          </div>
          <p className="mt-6 max-w-xs text-sm text-muted-foreground">
            The scan is a stub right now — you will review the reference bar tab
            next and can fix any line.
          </p>
        </div>
      </InterviewChrome>
    );
  }

  if (step === "restaurant") {
    return (
      <InterviewChrome
        step={STEP_INDEX.restaurant}
        total={8}
        kicker="The place"
        title="What's the name on the check?"
        onBack={() => setStep("capture")}
        footer={
          <ContinueButton
            disabled={!restaurant.trim()}
            onClick={() => setStep("items")}
          >
            Continue
          </ContinueButton>
        }
      >
        {error ? (
          <p className="mb-4 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Label htmlFor="restaurant" className="mb-2">
          Restaurant or bar
        </Label>
        <Input
          id="restaurant"
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          placeholder="The Bar"
          className="h-12 rounded-xl text-base"
          autoComplete="organization"
        />
      </InterviewChrome>
    );
  }

  if (step === "items") {
    return (
      <InterviewChrome
        step={STEP_INDEX.items}
        total={8}
        kicker="The drinks"
        title="Does this look right?"
        onBack={() => setStep("restaurant")}
        footer={
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Items {centsToLabel(itemSubtotal)}
            </p>
            <ContinueButton
              disabled={items.length === 0 || items.some((i) => !i.name.trim() || i.qty < 1)}
              onClick={() => setStep("fees")}
            >
              Looks good
            </ContinueButton>
          </div>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Fix misreads, add a missed pour. Quantities stay whole numbers.
        </p>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label htmlFor={`item-name-${item.id}`} className="text-xs text-muted-foreground">
                  Line {index + 1}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`Remove ${item.name || "line"}`}
                  onClick={() => setItems(items.filter((row) => row.id !== item.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
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
                className="h-11 rounded-xl"
                placeholder="Item name"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`item-qty-${item.id}`} className="mb-1 text-xs">
                    Qty
                  </Label>
                  <Input
                    id={`item-qty-${item.id}`}
                    inputMode="numeric"
                    value={item.qty}
                    onChange={(e) => {
                      const qty = Math.max(1, Math.floor(Number(e.target.value) || 0));
                      setItems(
                        items.map((row) => (row.id === item.id ? { ...row, qty } : row)),
                      );
                    }}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor={`item-total-${item.id}`} className="mb-1 text-xs">
                    Line total
                  </Label>
                  <Input
                    id={`item-total-${item.id}`}
                    inputMode="decimal"
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
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 w-full rounded-full"
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
        </Button>
      </InterviewChrome>
    );
  }

  if (step === "fees") {
    return (
      <InterviewChrome
        step={STEP_INDEX.fees}
        total={8}
        kicker="Tax & tip"
        title="These get split by what people ordered"
        onBack={() => setStep("items")}
        footer={
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Grand {centsToLabel(itemSubtotal + feeTotal)}
            </p>
            <ContinueButton onClick={() => setStep("pay")}>Continue</ContinueButton>
          </div>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Admin, gratuity, tax — never an even split across headcount. Leave
          “Subtotal” and “Total” off this list.
        </p>
        <div className="space-y-3">
          {fees.map((fee) => (
            <div key={fee.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
              <div className="mb-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`Remove ${fee.name || "fee"}`}
                  onClick={() => setFees(fees.filter((row) => row.id !== fee.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Input
                value={fee.name}
                onChange={(e) =>
                  setFees(
                    fees.map((row) =>
                      row.id === fee.id ? { ...row, name: e.target.value } : row,
                    ),
                  )
                }
                className="h-11 rounded-xl"
                placeholder="Fee name"
              />
              <Input
                className="mt-2 h-11 rounded-xl"
                inputMode="decimal"
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
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 w-full rounded-full"
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
        </Button>
      </InterviewChrome>
    );
  }

  if (step === "pay") {
    return (
      <InterviewChrome
        step={STEP_INDEX.pay}
        total={8}
        kicker="Getting paid back"
        title="How should people pay you?"
        onBack={() => setStep("fees")}
        footer={
          <ContinueButton disabled={!handle.trim() || busy} onClick={() => void publish()}>
            {busy ? "Publishing…" : "Create the claim link"}
          </ContinueButton>
        }
      >
        {error ? (
          <p className="mb-4 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {PAY_OPTIONS.map((option) => (
            <button
              key={option.method}
              type="button"
              onClick={() => setMethod(option.method)}
              className={`min-h-14 rounded-2xl px-3 py-3 text-left text-sm font-semibold ring-1 transition ${
                method === option.method
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-card ring-border"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Label htmlFor="handle" className="mt-4 mb-2">
          Your {PAY_OPTIONS.find((o) => o.method === method)?.hint}
        </Label>
        <Input
          id="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@alex"
          className="h-12 rounded-xl text-base"
        />
        <p className="mt-4 text-xs text-muted-foreground">
          We will generate a pre-filled message. Nobody gets charged from this
          app — they still tap send themselves.
        </p>
      </InterviewChrome>
    );
  }

  return (
    <InterviewChrome
      step={STEP_INDEX.share}
      total={8}
      kicker="Share"
      title="Send this link. They claim what they drank."
      footer={
        <div className="space-y-2">
          <ContinueButton onClick={() => router.push(`/r/${receiptId}?host=1`)}>
            Open the live board
          </ContinueButton>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-full"
            onClick={() => router.push("/")}
          >
            Done for now
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl bg-ice p-4 ring-1 ring-sky-ink/20">
        <p className="break-all font-mono text-sm text-foreground">{claimUrl}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-full"
          onClick={async () => {
            await navigator.clipboard.writeText(claimUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-full"
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
        </Button>
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
        <span className="text-sm text-muted-foreground">Check total</span>
        <Badge className="h-6 bg-primary px-2 text-primary-foreground">
          {centsToLabel(itemSubtotal + feeTotal)}
        </Badge>
      </div>
    </InterviewChrome>
  );
}
