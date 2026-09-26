import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useReceipt } from "@/hooks/use-receipt";
import { needsQtyStep, pruneQueue } from "@/lib/claim-queue";
import {
  ensureDemoHost,
  getGuest,
  getHostToken,
  hydrateSession,
  saveClaimToken,
  clearClaimToken,
  saveGuest,
  getClaimToken,
} from "@/lib/session";
import { api, type ApiError } from "@/lib/api";
import type { GuestIdentity, PublicReceipt } from "@/lib/types";

type ClaimFlow = {
  id: string;
  receipt: PublicReceipt | null;
  error: string | null;
  live: "live" | "reconnecting" | "offline";
  refresh: () => Promise<unknown>;
  guest: GuestIdentity | null;
  isHost: boolean;
  queued: string[];
  units: Record<string, number>;
  message: string | null;
  busy: boolean;
  /** True when any selected line still has >1 unit left (qty screen needed). */
  needsQty: boolean;
  setMessage: (v: string | null) => void;
  join: (guest: GuestIdentity) => Promise<void>;
  toggle: (itemId: string) => void;
  setUnit: (itemId: string, qty: number) => void;
  claimQueued: () => Promise<boolean>;
  unclaim: (claimId: string) => Promise<void>;
  closeOut: () => Promise<boolean>;
  reopen: () => Promise<boolean>;
};

const Ctx = createContext<ClaimFlow | null>(null);

export function ClaimFlowProvider({ children }: { children: React.ReactNode }) {
  const params = useLocalSearchParams<{ id: string; host?: string }>();
  const id = String(params.id ?? "");
  const hostQuery = params.host === "1" || params.host === "true";
  const { receipt, error, live, refresh } = useReceipt(id);
  const [guest, setGuest] = useState<GuestIdentity | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [queued, setQueued] = useState<string[]>([]);
  const [units, setUnits] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      await hydrateSession();
      await ensureDemoHost(hostQuery);
      setGuest(getGuest(id));
      // Privileged host UI (close claiming, etc.) only when this device holds the host token —
      // not merely because ?host=1 is in the URL.
      setIsHost(Boolean(getHostToken(id)));
    })();
  }, [hostQuery, id]);

  // Live remaining: drop sold-out lines from the cart; clamp units.
  useEffect(() => {
    if (!receipt) return;
    setQueued((prevQ) => {
      const pruned = pruneQueue(receipt.remaining, prevQ, units);
      const sameQueue =
        pruned.queued.length === prevQ.length &&
        pruned.queued.every((id, i) => id === prevQ[i]);
      const sameUnits =
        Object.keys(pruned.units).length === Object.keys(units).length &&
        Object.keys(pruned.units).every((id) => pruned.units[id] === units[id]);
      if (!sameUnits) setUnits(pruned.units);
      return sameQueue ? prevQ : pruned.queued;
    });
    // units intentionally omitted — we only react to server remaining changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  const activeQueued = useMemo(() => {
    if (!receipt) return queued;
    return queued.filter((itemId) => (receipt.remaining[itemId] ?? 0) > 0);
  }, [queued, receipt]);

  const needsQty = useMemo(
    () => (receipt ? needsQtyStep(receipt.remaining, activeQueued) : false),
    [activeQueued, receipt],
  );

  const join = useCallback(
    async (next: GuestIdentity) => {
      await saveGuest(id, next);
      setGuest(next);
    },
    [id],
  );

  const toggle = useCallback(
    (itemId: string) => {
      if (!receipt) return;
      const left = receipt.remaining[itemId] ?? 0;
      if (left <= 0) return;
      setMessage(null);
      setQueued((prev) => {
        const selected = prev.includes(itemId);
        setUnits((unitsPrev) => {
          if (selected) {
            const next = { ...unitsPrev };
            delete next[itemId];
            return next;
          }
          return { ...unitsPrev, [itemId]: unitsPrev[itemId] ?? 1 };
        });
        return selected ? prev.filter((row) => row !== itemId) : [...prev, itemId];
      });
    },
    [receipt],
  );

  const setUnit = useCallback(
    (itemId: string, qty: number) => {
      const max = receipt?.remaining[itemId] ?? qty;
      setUnits((prev) => ({ ...prev, [itemId]: Math.min(Math.max(1, qty), Math.max(1, max)) }));
    },
    [receipt],
  );

  const claimQueued = useCallback(async () => {
    if (!receipt || !guest || queued.length === 0) return false;
    setBusy(true);
    setMessage(null);
    try {
      const queuedItems = receipt.items.filter(
        (item) => queued.includes(item.id) && (receipt.remaining[item.id] ?? 0) > 0,
      );
      if (queuedItems.length === 0) {
        setMessage("Those lines were just claimed by someone else.");
        setQueued([]);
        setUnits({});
        await refresh();
        return false;
      }
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
            units: Math.min(Math.max(1, units[item.id] ?? 1), receipt.remaining[item.id] ?? 0),
          })),
        }),
      });
      for (const claim of result.claims) {
        const token = result.tokens[claim.id];
        if (token) await saveClaimToken(receipt.id, claim.id, token);
      }
      setQueued([]);
      setUnits({});
      await refresh();
      return true;
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "not_enough_remaining") {
        if (e.message) {
          setMessage(e.message);
        } else if (e.claimedBy && e.itemName) {
          setMessage(
            e.remaining === 0
              ? `${e.itemName} has already been claimed by ${e.claimedBy}`
              : `Only ${e.remaining ?? 0} left on ${e.itemName} — ${e.claimedBy} already claimed some`,
          );
        } else {
          setMessage(`Only ${e.remaining ?? 0} left on one of those lines — pick again.`);
        }
        setQueued([]);
        setUnits({});
        await refresh();
      } else if (e.code === "conflict") {
        setMessage("This check is closed.");
      } else {
        setMessage("Couldn't reach the table. Try again.");
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, [guest, queued, receipt, refresh, units]);

  const unclaim = useCallback(
    async (claimId: string) => {
      const claimToken = getClaimToken(id, claimId);
      const hostToken = getHostToken(id);
      if (!claimToken && !hostToken) return;
      setBusy(true);
      setMessage(null);
      try {
        await api(`/api/claims/${claimId}`, {
          method: "DELETE",
          claimToken,
          hostToken,
        });
        await clearClaimToken(id, claimId);
        await refresh();
      } catch (err) {
        const e = err as ApiError;
        // Already gone (double-tap / live race) — treat as success.
        if (e.code === "not_found" || e.status === 404) {
          await clearClaimToken(id, claimId);
          await refresh();
          return;
        }
        if (e.code === "conflict") {
          setMessage("Claiming is closed — reopen to change claims.");
        } else if (e.code === "forbidden") {
          setMessage("Only the person who claimed that (or the host) can drop it.");
        } else {
          setMessage("Couldn't drop that claim. Check the server and try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [id, refresh],
  );

  const closeOut = useCallback(async () => {
    const token = getHostToken(id);
    setBusy(true);
    try {
      await api(`/api/receipts/${id}/finalize`, { method: "POST", hostToken: token });
      await refresh();
      return true;
    } catch {
      setMessage("Only the host can close claiming.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [id, refresh]);

  const reopen = useCallback(async () => {
    const token = getHostToken(id);
    setBusy(true);
    try {
      await api(`/api/receipts/${id}/reopen`, { method: "POST", hostToken: token });
      await refresh();
      return true;
    } catch {
      setMessage("Only the host can reopen claiming.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [id, refresh]);

  const value = useMemo(
    () => ({
      id,
      receipt,
      error,
      live,
      refresh,
      guest,
      isHost,
      queued: activeQueued,
      units,
      message,
      busy,
      needsQty,
      setMessage,
      join,
      toggle,
      setUnit,
      claimQueued,
      unclaim,
      closeOut,
      reopen,
    }),
    [
      activeQueued,
      busy,
      claimQueued,
      closeOut,
      error,
      guest,
      id,
      isHost,
      join,
      live,
      message,
      needsQty,
      receipt,
      refresh,
      reopen,
      toggle,
      unclaim,
      units,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClaimFlow() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClaimFlow outside provider");
  return ctx;
}
