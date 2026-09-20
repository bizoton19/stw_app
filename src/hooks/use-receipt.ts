"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicReceipt } from "@/lib/types";
import { api } from "@/lib/session";

export function useReceipt(id: string) {
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<"live" | "reconnecting" | "offline">("reconnecting");

  const refresh = useCallback(async () => {
    try {
      const next = await api<PublicReceipt>(`/api/receipts/${id}`);
      setReceipt(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "offline");
      setLive("offline");
      return null;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void refresh();

    const source = new EventSource(`/api/receipts/${id}/live`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { receipt?: PublicReceipt };
        if (payload.receipt && !cancelled) {
          setReceipt(payload.receipt);
          setLive("live");
          setError(null);
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    source.onerror = () => {
      if (!cancelled) setLive("reconnecting");
    };
    source.onopen = () => {
      if (!cancelled) setLive("live");
    };

    const poll = window.setInterval(() => {
      if (source.readyState !== EventSource.OPEN) void refresh();
    }, 4000);

    return () => {
      cancelled = true;
      source.close();
      window.clearInterval(poll);
    };
  }, [id, refresh]);

  return { receipt, error, live, refresh, setReceipt };
}
