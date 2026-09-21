"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Receipt, Users } from "lucide-react";
import { motion } from "motion/react";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { QtyStepper } from "@/components/qty-stepper";
import { ContinueButton, InterviewChrome, QuietButton } from "@/components/interview-chrome";
import { centsToLabel } from "@/lib/money";
import { api, getClaimToken, getGuest, getHostToken, saveClaimToken } from "@/lib/session";
import { computeTotals } from "@/lib/totals";
import type { PublicReceipt } from "@/lib/types";

export function ClaimBoard({
  receipt,
  isHost,
  onChange,
}: {
  receipt: PublicReceipt;
  isHost: boolean;
  onChange: () => Promise<unknown> | unknown;
}) {
  const router = useRouter();
  const guest = getGuest(receipt.id);
  const [queued, setQueued] = useState<string[]>([]);
  const [units, setUnits] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<"pick" | "qty">("pick");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const remainingItems = receipt.items.filter((item) => (receipt.remaining[item.id] ?? 0) > 0);
  const goneItems = receipt.items.filter((item) => (receipt.remaining[item.id] ?? 0) <= 0);
  const totals = useMemo(() => computeTotals(receipt), [receipt]);
  const mine = guest
    ? totals.people.find((p) => p.personName === guest.name)
    : undefined;
  const closed = receipt.status === "finalized";
  const totalSteps = 3;
  const pickStep = 2;
  const qtyStep = 3;
  const activeQueued = queued.filter((id) => (receipt.remaining[id] ?? 0) > 0);

  useEffect(() => {
    if (phase !== "qty" || activeQueued.length > 0) return;
    queueMicrotask(() => {
      setDirection(-1);
      setPhase("pick");
    });
  }, [phase, activeQueued.length]);

  const queuedItems = remainingItems.filter((item) => activeQueued.includes(item.id));
  const totalUnits = queuedItems.reduce((sum, item) => {
    const max = receipt.remaining[item.id] ?? 0;
    const value = units[item.id] ?? 1;
    return sum + Math.min(Math.max(1, value), max);
  }, 0);

  function toggle(id: string) {
    if (closed) return;
    setMessage(null);
    const selected = queued.includes(id);
    setQueued(selected ? queued.filter((row) => row !== id) : [...queued, id]);
    setUnits((prev) => {
      if (selected) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: 1 };
    });
  }

  function goQty() {
    if (activeQueued.length === 0) return;
    setDirection(1);
    setPhase("qty");
  }

  function goPick() {
    setDirection(-1);
    setPhase("pick");
  }

  async function claimQueued() {
    if (!guest || queuedItems.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api<{
        claims: { id: string }[];
        tokens: Record<string, string>;
      }>(`/api/receipts/${receipt.id}/claims`, {
        method: "POST",
        body: JSON.stringify({
          personName: guest.name,
          personContact: guest.contact || undefined,
          claims: queuedItems.map((item) => ({
            itemId: item.id,
            units: Math.min(
              Math.max(1, units[item.id] ?? 1),
              receipt.remaining[item.id] ?? 0,
            ),
          })),
        }),
      });
      for (const claim of result.claims) {
        const token = result.tokens[claim.id];
        if (token) saveClaimToken(receipt.id, claim.id, token);
      }
      setQueued([]);
      setUnits({});
      setDirection(-1);
      setPhase("pick");
      await onChange();
    } catch (err) {
      const code = (err as { code?: string; remaining?: number; itemId?: string }).code;
      const remaining = (err as { remaining?: number }).remaining;
      const itemId = (err as { itemId?: string }).itemId;
      const itemName = itemId
        ? receipt.items.find((item) => item.id === itemId)?.name
        : null;
      if (code === "not_enough_remaining") {
        setMessage(
          itemName
            ? `Only ${remaining ?? 0} left on ${itemName}.`
            : `Only ${remaining ?? 0} left on one of those lines.`,
        );
        await onChange();
      } else if (code === "conflict") {
        setMessage("This check is closed.");
      } else {
        setMessage("Couldn't reach the table. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function unclaim(claimId: string) {
    const token = getClaimToken(receipt.id, claimId);
    if (!token) return;
    setBusy(true);
    try {
      await api(`/api/claims/${claimId}`, {
        method: "DELETE",
        claimToken: token,
      });
      await onChange();
    } catch {
      setMessage("Couldn't drop that claim.");
    } finally {
      setBusy(false);
    }
  }

  async function closeOut() {
    const token = getHostToken(receipt.id);
    setBusy(true);
    try {
      await api(`/api/receipts/${receipt.id}/finalize`, {
        method: "POST",
        hostToken: token,
      });
      router.push(`/r/${receipt.id}/settle`);
    } catch {
      setMessage("Only the host can close claiming.");
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    const token = getHostToken(receipt.id);
    setBusy(true);
    try {
      await api(`/api/receipts/${receipt.id}/reopen`, {
        method: "POST",
        hostToken: token,
      });
      await onChange();
    } catch {
      setMessage("Only the host can reopen claiming.");
    } finally {
      setBusy(false);
    }
  }

  if (closed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <BoardHeader
          receipt={receipt}
          title="Claiming is closed"
          mine={mine?.totalCents}
          guest={guest}
          isHost={isHost}
        />
        {message ? <p className="mb-3 text-[14px] text-destructive">{message}</p> : null}
        <History
          receipt={receipt}
          goneItems={goneItems}
          busy={busy}
          closed
          onUnclaim={unclaim}
        />
        <div className="mt-auto space-y-1">
          <Link
            href={`/r/${receipt.id}/settle`}
            className="pressable inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
          >
            See who owes what
          </Link>
          {isHost ? (
            <QuietButton disabled={busy || !getHostToken(receipt.id)} onClick={() => void reopen()}>
              Reopen claiming
            </QuietButton>
          ) : null}
        </div>
      </div>
    );
  }

  const pickFooter =
    remainingItems.length === 0 ? (
      <div className="space-y-1">
        <Link
          href={`/r/${receipt.id}/settle`}
          className="pressable inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
        >
          See who owes what
        </Link>
        {isHost ? (
          <QuietButton
            disabled={busy || !getHostToken(receipt.id)}
            onClick={() => void closeOut()}
          >
            Close claiming
          </QuietButton>
        ) : null}
      </div>
    ) : (
    <div className="space-y-1">
      <ContinueButton
        disabled={busy || !guest || activeQueued.length === 0}
        onClick={goQty}
      >
        {activeQueued.length === 0
          ? "Pick what you had"
          : activeQueued.length === 1
            ? "Claim 1 item"
            : `Claim ${activeQueued.length} items`}
      </ContinueButton>
      {isHost ? (
        <QuietButton
          disabled={busy || !getHostToken(receipt.id)}
          onClick={() => void closeOut()}
        >
          Close — leftovers on the host
        </QuietButton>
      ) : (
        <Link
          href={`/r/${receipt.id}/settle`}
          className="pressable inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium"
        >
          Running totals
        </Link>
      )}
    </div>
    );

  if (phase === "qty" && queuedItems.length > 0) {
    return (
      <InterviewChrome
        step={qtyStep}
        total={totalSteps}
        kicker={receipt.restaurant || "The check"}
        title="How many of each?"
        stepKey="qty"
        direction={direction}
        onBack={goPick}
        footer={
          <ContinueButton
            disabled={busy || !guest || totalUnits < 1}
            onClick={() => void claimQueued()}
          >
            {busy
              ? "Claiming…"
              : totalUnits === 1
                ? "Claim 1"
                : `Claim ${totalUnits}`}
          </ContinueButton>
        }
      >
        <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
          Whole glasses only. We will not split a pour.
        </p>
        {message ? <p className="mb-3 text-sm text-destructive">{message}</p> : null}
        <ul className="divide-y divide-border border-y border-border">
          {queuedItems.map((item) => {
            const max = receipt.remaining[item.id] ?? 0;
            const value = Math.min(Math.max(1, units[item.id] ?? 1), Math.max(1, max));
            const labelId = `qty-${item.id}`;
            return (
              <li key={item.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p id={labelId} className="text-[15px] font-medium">
                      {item.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {centsToLabel(item.totalCents)} · {max} left
                    </p>
                  </div>
                  <QtyStepper
                    value={value}
                    min={1}
                    max={Math.max(1, max)}
                    labelledBy={labelId}
                    onChange={(next) =>
                      setUnits((prev) => ({ ...prev, [item.id]: next }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className="pressable mt-1 h-9 text-[12px] font-medium text-muted-foreground"
                  onClick={() => toggle(item.id)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </InterviewChrome>
    );
  }

  return (
    <InterviewChrome
      step={pickStep}
      total={totalSteps}
      kicker={receipt.restaurant || "The check"}
      title="What did you have?"
      stepKey="pick"
      direction={direction}
      onBack={() => router.push("/")}
      footer={pickFooter}
    >
      {mine ? (
        <p className="mb-3 text-[13px] font-medium tabular-nums">
          You {centsToLabel(mine.totalCents)} so far
        </p>
      ) : null}
      {guest ? (
        <p className="mb-4 text-[13px] text-muted-foreground">
          Claiming as {guest.name}
          {isHost ? " (host)" : ""}
          {guest.contact ? ` · ${guest.contact}` : ""}
        </p>
      ) : null}
      {message ? <p className="mb-3 text-sm text-destructive">{message}</p> : null}

      {remainingItems.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-muted-foreground">
          Everything on this check is claimed.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {remainingItems.map((item) => {
            const left = receipt.remaining[item.id] ?? 0;
            const selected = activeQueued.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(item.id)}
                  className="pressable flex w-full items-start gap-3 py-3.5 text-left"
                >
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{item.name}</span>
                    <span className="text-[12px] text-muted-foreground">
                      {centsToLabel(item.totalCents)} for {item.qty}
                    </span>
                  </span>
                  <motion.span
                    key={`${item.id}-${left}`}
                    initial={{ opacity: 0.45, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-[12px] font-medium tabular-nums ${
                      selected ? "text-primary" : "text-ink-soft"
                    }`}
                  >
                    {left} left
                  </motion.span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <History
        receipt={receipt}
        goneItems={goneItems}
        busy={busy}
        closed={false}
        onUnclaim={unclaim}
      />
    </InterviewChrome>
  );
}

function BoardHeader({
  receipt,
  title,
  mine,
  guest,
  isHost,
}: {
  receipt: PublicReceipt;
  title: string;
  mine?: number;
  guest: { name: string; contact: string } | null;
  isHost?: boolean;
}) {
  return (
    <div className="pt-3">
      <p className="text-[13px] font-medium text-ink-soft">
        {receipt.restaurant || "The check"}
      </p>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {mine != null ? (
          <p className="pt-2 text-[13px] font-medium tabular-nums">
            You {centsToLabel(mine)}
          </p>
        ) : null}
      </div>
      {guest ? (
        <p className="mb-4 text-[13px] text-muted-foreground">
          Claiming as {guest.name}
          {isHost ? " (host)" : ""}
          {guest.contact ? ` · ${guest.contact}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function History({
  receipt,
  goneItems,
  busy,
  closed,
  onUnclaim,
}: {
  receipt: PublicReceipt;
  goneItems: PublicReceipt["items"];
  busy: boolean;
  closed: boolean;
  onUnclaim: (claimId: string) => void;
}) {
  const hasClaims = receipt.claims.length > 0;
  if (goneItems.length === 0 && !hasClaims) return null;

  return (
    <>
      {goneItems.length > 0 ? (
        <section className="mt-8">
          <p className="mb-2 text-[12px] font-medium text-muted-foreground">Claimed out</p>
          <ul className="space-y-1 text-[14px] text-muted-foreground">
            {goneItems.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasClaims ? (
        <section className="mt-8">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <Users className="size-3.5" strokeWidth={2} aria-hidden />
            Who claimed what
          </p>
          {receipt.items.map((item) => {
            const claims = receipt.claims.filter((c) => c.itemId === item.id);
            if (claims.length === 0) return null;
            return (
              <div key={item.id} className="mb-4">
                <p className="flex items-center gap-1.5 text-[14px] font-medium">
                  <Receipt className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
                  {item.name}
                </p>
                <ul className="mt-1 space-y-2">
                  {claims.map((claim) => {
                    const mineToDrop = getClaimToken(receipt.id, claim.id) && !closed;
                    return (
                      <li
                        key={claim.id}
                        className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <ClaimerAvatar name={claim.personName} size={26} />
                          <span className="truncate">
                            {claim.personName} · {claim.units}
                            {claim.personContact ? ` · ${claim.personContact}` : ""}
                          </span>
                        </span>
                        {mineToDrop ? (
                          <button
                            type="button"
                            className="pressable h-9 shrink-0 px-2 text-[12px] font-medium text-foreground"
                            disabled={busy}
                            onClick={() => onUnclaim(claim.id)}
                          >
                            Unclaim
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
