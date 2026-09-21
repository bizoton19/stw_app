import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { getApiUrl } from "@/lib/config";
import type { PublicReceipt } from "@/lib/types";

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

    let source: EventSource | null = null;
    const canSse = Platform.OS === "web" && typeof EventSource !== "undefined";
    if (canSse) {
      source = new EventSource(`${getApiUrl()}/api/receipts/${id}/live`);
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { receipt?: PublicReceipt };
          if (payload.receipt && !cancelled) {
            setReceipt(payload.receipt);
            setLive("live");
            setError(null);
          }
        } catch {
          /* ignore */
        }
      };
      source.onerror = () => {
        if (!cancelled) setLive("reconnecting");
      };
      source.onopen = () => {
        if (!cancelled) setLive("live");
      };
    } else {
      setLive("live");
    }

    const poll = setInterval(() => {
      if (!source || source.readyState !== 1) void refresh();
    }, canSse ? 4000 : 2500);

    return () => {
      cancelled = true;
      source?.close();
      clearInterval(poll);
    };
  }, [id, refresh]);

  return { receipt, error, live, refresh };
}
