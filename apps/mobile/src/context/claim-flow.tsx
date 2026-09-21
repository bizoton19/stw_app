import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useReceipt } from "@/hooks/use-receipt";
import {
  ensureDemoHost,
  getGuest,
  getHostToken,
  hydrateSession,
  saveClaimToken,
  saveGuest,
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
      setIsHost(Boolean(getHostToken(id)) || hostQuery);
    })();
  }, [hostQuery, id]);

  const join = useCallback(
    async (next: GuestIdentity) => {
      await saveGuest(id, next);
      setGuest(next);
    },
    [id],
  );

  const toggle = useCallback((itemId: string) => {
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
  }, []);

  const setUnit = useCallback((itemId: string, qty: number) => {
    setUnits((prev) => ({ ...prev, [itemId]: qty }));
  }, []);

  const claimQueued = useCallback(async () => {
    if (!receipt || !guest || queued.length === 0) return false;
    setBusy(true);
    setMessage(null);
    try {
      const queuedItems = receipt.items.filter(
        (item) => queued.includes(item.id) && (receipt.remaining[item.id] ?? 0) > 0,
      );
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
        setMessage(`Only ${e.remaining ?? 0} left on one of those lines.`);
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
      const { getClaimToken } = await import("@/lib/session");
      const token = getClaimToken(id, claimId);
      if (!token) return;
      setBusy(true);
      try {
        await api(`/api/claims/${claimId}`, { method: "DELETE", claimToken: token });
        await refresh();
      } catch {
        setMessage("Couldn't drop that claim.");
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
      queued,
      units,
      message,
      busy,
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
      queued,
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
