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
import { bindOwnedClaims } from "@/lib/bind-guest";
import type { GuestDraft, GuestIdentity, PublicReceipt } from "@/lib/types";

type ClaimFlow = {
  id: string;
  inviteToken: string;
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
  join: (guest: GuestDraft) => Promise<void>;
  toggle: (itemId: string) => void;
  setUnit: (itemId: string, qty: number) => void;
  claimQueued: () => Promise<boolean>;
  unclaim: (claimId: string) => Promise<void>;
  closeOut: () => Promise<boolean>;
  reopen: () => Promise<boolean>;
  deleteClosed: () => Promise<boolean>;
};

const Ctx = createContext<ClaimFlow | null>(null);

export function ClaimFlowProvider({ children }: { children: React.ReactNode }) {
  const params = useLocalSearchParams<{ id: string; host?: string; invite?: string }>();
  const id = String(params.id ?? "");
  const hostQuery = params.host === "1" || params.host === "true";
  const inviteToken = typeof params.invite === "string" ? params.invite : "";
  const { receipt, error, live, refresh, applyReceipt } = useReceipt(id, { inviteToken });
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
    async (next: GuestDraft) => {
      const saved = await saveGuest(id, next);
      setGuest(saved);
    },
    [id],
  );

  useEffect(() => {
    if (!receipt || !guest?.guestId) return;
    let cancelled = false;
    void bindOwnedClaims(receipt.id, guest.guestId, receipt.claims)
      .then((changed) => {
        if (changed && !cancelled) void refresh();
      })
      .catch(() => {
        /* next visit retries */
      });
    return () => {
      cancelled = true;
    };
  }, [guest?.guestId, receipt, refresh]);

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
          guestId: guest.guestId,
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
      const result = await api<{ receipt: PublicReceipt }>(`/api/receipts/${id}/finalize`, {
        method: "POST",
        hostToken: token,
      });
      const { patchHostedReceipt } = await import("@/lib/host-tabs");
      await patchHostedReceipt(id, { status: "finalized" });
      if (result.receipt) applyReceipt(result.receipt);
      else await refresh();
      return true;
    } catch {
      setMessage("Only the host can close claiming.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [applyReceipt, id, refresh]);

  const reopen = useCallback(async () => {
    const token = getHostToken(id);
    setBusy(true);
    try {
      const result = await api<{ receipt: PublicReceipt }>(`/api/receipts/${id}/reopen`, {
        method: "POST",
        hostToken: token,
      });
      const { patchHostedReceipt } = await import("@/lib/host-tabs");
      await patchHostedReceipt(id, { status: "open" });
      if (result.receipt) applyReceipt(result.receipt);
      else await refresh();
      return true;
    } catch {
      setMessage("Only the host can reopen claiming.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [applyReceipt, id, refresh]);

  const deleteClosed = useCallback(async () => {
    const token = getHostToken(id);
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/receipts/${id}`, { method: "DELETE", hostToken: token });
      const { clearHostedReceipt } = await import("@/lib/host-tabs");
      await clearHostedReceipt(id);
      return true;
    } catch (err) {
      const e = err as ApiError;
      setMessage(
        e.message ||
          (e.code === "conflict"
            ? "Close the tab before deleting it."
            : "Couldn't delete that tab."),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [id]);

  const value = useMemo(
    () => ({
      id,
      inviteToken,
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
      deleteClosed,
    }),
    [
      activeQueued,
      busy,
      claimQueued,
      closeOut,
      deleteClosed,
      error,
      guest,
      id,
      inviteToken,
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
