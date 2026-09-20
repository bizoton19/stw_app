"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { QtyStepper } from "@/components/qty-stepper";
import { ContinueButton, QuietButton } from "@/components/interview-chrome";
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
  const [selected, setSelected] = useState<string | null>(null);
  const [units, setUnits] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const remainingItems = receipt.items.filter((item) => (receipt.remaining[item.id] ?? 0) > 0);
  const goneItems = receipt.items.filter((item) => (receipt.remaining[item.id] ?? 0) <= 0);
  const totals = useMemo(() => computeTotals(receipt), [receipt]);
  const mine = guest
    ? totals.people.find((p) => p.personName === guest.name)
    : undefined;
  const selectedItem = receipt.items.find((item) => item.id === selected);
  const max = selectedItem ? (receipt.remaining[selectedItem.id] ?? 0) : 0;
  const closed = receipt.status === "finalized";

  async function claim() {
    if (!selectedItem || !guest) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api<{
        claim: { id: string };
        ownerToken: string;
        remaining: number;
      }>(`/api/receipts/${receipt.id}/claims`, {
        method: "POST",
        body: JSON.stringify({
          itemId: selectedItem.id,
          personName: guest.name,
          personContact: guest.contact || undefined,
          units,
        }),
      });
      saveClaimToken(receipt.id, result.claim.id, result.ownerToken);
      setUnits(1);
      if (result.remaining === 0) setSelected(null);
      await onChange();
    } catch (err) {
      const code = (err as { code?: string; remaining?: number }).code;
      const remaining = (err as { remaining?: number }).remaining;
      if (code === "not_enough_remaining") {
        setMessage(`Only ${remaining ?? 0} left on that line.`);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="mb-5 flex items-start justify-between gap-3 pt-2">
          <div>
            <p className="text-[13px] font-medium text-ink-soft">
              {receipt.restaurant || "The check"}
            </p>
            <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight">
              {closed ? "Claiming is closed" : "What did you have?"}
            </h1>
          </div>
          {mine ? (
            <p className="pt-6 text-[13px] font-medium tabular-nums">
              You {centsToLabel(mine.totalCents)}
            </p>
          ) : null}
        </div>

        {message ? (
          <p className="mb-3 text-sm text-destructive">{message}</p>
        ) : null}

        {guest ? (
          <p className="mb-4 text-[13px] text-muted-foreground">
            Claiming as {guest.name}
            {guest.contact ? ` · ${guest.contact}` : ""}
          </p>
        ) : null}

        <section>
          {remainingItems.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-muted-foreground">
              Everything on this check is claimed.
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {remainingItems.map((item) => {
                const left = receipt.remaining[item.id] ?? 0;
                const active = selected === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={closed}
                      onClick={() => {
                        setSelected(item.id);
                        setUnits(Math.min(units, left) || 1);
                      }}
                      className="pressable flex w-full items-start justify-between gap-3 py-3.5 text-left"
                    >
                      <span>
                        <span className="block text-[15px] font-medium">{item.name}</span>
                        <span className="text-[12px] text-muted-foreground">
                          {centsToLabel(item.totalCents)} for {item.qty}
                        </span>
                      </span>
                      <motion.span
                        key={`${item.id}-${left}`}
                        initial={{ opacity: 0.4, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-[12px] font-medium tabular-nums ${
                          active ? "text-primary" : "text-ink-soft"
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
        </section>

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

        <section className="mt-8">
          <p className="mb-2 text-[12px] font-medium text-muted-foreground">Who claimed what</p>
          {receipt.items.map((item) => {
            const claims = receipt.claims.filter((c) => c.itemId === item.id);
            if (claims.length === 0) return null;
            return (
              <div key={item.id} className="mb-4">
                <p className="text-[14px] font-medium">{item.name}</p>
                <ul className="mt-1 space-y-1">
                  {claims.map((claim) => {
                    const mineToDrop = getClaimToken(receipt.id, claim.id) && !closed;
                    return (
                      <li
                        key={claim.id}
                        className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground"
                      >
                        <span>
                          {claim.personName} · {claim.units}
                          {claim.personContact ? ` · ${claim.personContact}` : ""}
                        </span>
                        {mineToDrop ? (
                          <button
                            type="button"
                            className="pressable h-9 px-2 text-[12px] font-medium text-foreground"
                            disabled={busy}
                            onClick={() => void unclaim(claim.id)}
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
      </div>

      <div className="border-t border-border bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {selectedItem && !closed && guest ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p id="qty-label" className="truncate text-[14px] font-medium">
                {selectedItem.name}
              </p>
              <p className="text-[12px] text-muted-foreground">{max} still unclaimed</p>
            </div>
            <QtyStepper
              value={Math.min(units, max)}
              min={1}
              max={Math.max(1, max)}
              labelledBy="qty-label"
              onChange={setUnits}
            />
          </div>
        ) : null}
        {closed ? (
          <Link
            href={`/r/${receipt.id}/settle`}
            className="pressable inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
          >
            See who owes what
          </Link>
        ) : (
          <div className="space-y-1">
            <ContinueButton
              disabled={busy || !selectedItem || !guest || max < 1}
              onClick={() => void claim()}
            >
              {busy ? "Claiming…" : "Claim"}
            </ContinueButton>
            {isHost ? (
              <QuietButton
                disabled={busy || !getHostToken(receipt.id)}
                onClick={() => void closeOut()}
              >
                {remainingItems.length > 0
                  ? "Close — leftovers on the host"
                  : "Close claiming"}
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
        )}
      </div>
    </div>
  );
}
