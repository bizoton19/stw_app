"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QtyStepper } from "@/components/qty-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        setMessage(
          `Only ${remaining ?? 0} left on that line — pick a smaller number.`,
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

  const closed = receipt.status === "finalized";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-ink">
              {receipt.restaurant || "The check"}
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {closed ? "Claiming is closed" : "What did you have?"}
            </h1>
          </div>
          {mine ? (
            <Badge className="h-7 bg-secondary px-2 text-secondary-foreground">
              You {centsToLabel(mine.totalCents)}
            </Badge>
          ) : null}
        </div>

        {message ? (
          <p className="mb-3 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {message}
          </p>
        ) : null}

        {guest ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Claiming as <span className="font-semibold text-foreground">{guest.name}</span>
            {guest.contact ? ` · ${guest.contact}` : ""}
          </p>
        ) : null}

        <section className="space-y-2">
          {remainingItems.length === 0 ? (
            <div className="rounded-2xl bg-ice px-4 py-6 text-center text-sm text-sky-ink ring-1 ring-sky-ink/15">
              Everything on this check is claimed.
            </div>
          ) : (
            remainingItems.map((item) => {
              const left = receipt.remaining[item.id] ?? 0;
              const active = selected === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={closed}
                  onClick={() => {
                    setSelected(item.id);
                    setUnits(Math.min(units, left) || 1);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left ring-1 transition ${
                    active
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-card ring-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {centsToLabel(item.totalCents)} for {item.qty}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        active ? "bg-white/15" : "bg-ice text-sky-ink"
                      }`}
                    >
                      {left} left
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </section>

        {goneItems.length > 0 ? (
          <section className="mt-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Claimed out
            </p>
            <ul className="space-y-2 opacity-70">
              {goneItems.map((item) => (
                <li key={item.id} className="rounded-2xl bg-muted px-4 py-3 text-sm">
                  {item.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-ink">
            Who claimed what
          </p>
          {receipt.items.map((item) => {
            const claims = receipt.claims.filter((c) => c.itemId === item.id);
            if (claims.length === 0) return null;
            return (
              <div key={item.id} className="mb-3 rounded-2xl bg-card p-3 ring-1 ring-border">
                <p className="text-sm font-semibold">{item.name}</p>
                <ul className="mt-2 space-y-1">
                  {claims.map((claim) => {
                    const mineToDrop =
                      getClaimToken(receipt.id, claim.id) && !closed;
                    return (
                      <li
                        key={claim.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          <span className="font-medium">{claim.personName}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {claim.units}
                            {claim.personContact ? ` · ${claim.personContact}` : " · no contact"}
                          </span>
                        </span>
                        {mineToDrop ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 px-2 text-xs"
                            disabled={busy}
                            onClick={() => void unclaim(claim.id)}
                          >
                            Unclaim
                          </Button>
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

      <div className="border-t border-border/70 bg-background/90 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        {selectedItem && !closed && guest ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p id="qty-label" className="text-sm font-semibold">
                {selectedItem.name}
              </p>
              <p className="text-xs text-muted-foreground">{max} still unclaimed</p>
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
          <Button
            className="h-12 w-full rounded-full"
            render={<Link href={`/r/${receipt.id}/settle`} />}
          >
            See who owes what
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              className="h-12 w-full rounded-full bg-primary text-base font-semibold"
              disabled={busy || !selectedItem || !guest || max < 1}
              onClick={() => void claim()}
            >
              {busy ? "Claiming…" : "Claim"}
            </Button>
            {isHost ? (
              <Button
                variant="outline"
                className="h-12 w-full rounded-full"
                disabled={busy || !getHostToken(receipt.id)}
                onClick={() => void closeOut()}
              >
                {remainingItems.length > 0
                  ? "Close claiming — leftovers on the host"
                  : "Close claiming & split"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-12 w-full rounded-full"
                render={<Link href={`/r/${receipt.id}/settle`} />}
              >
                Running totals
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
