import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import { HostPushPrimeSheet } from "@/components/host-push-prime-sheet";
import { loadHostPrimeShownAt } from "@/lib/host-prime-cooldown";
import { hostPrimeCooldownActive } from "@/lib/host-prime-policy";
import {
  acquireHostPrimeSheet,
  releaseHostPrimeSheet,
  subscribeHostPrimeSheet,
} from "@/lib/host-prime-queue";
import {
  readHostPushPermission,
  registerHostClaimPush,
  requestHostPushPermissionAndRegister,
} from "@/lib/host-push";
import {
  enqueueHostPushPrime,
  loadHostPushPrime,
  markHostPushPrimeDismissed,
  markHostPushPrimeOutcome,
  markHostPushPrimeShown,
} from "@/lib/host-push-prime";
import {
  hostPushPrimeVariant,
  localDayKey,
  shouldPresentHostPushPrime,
  type HostPushPrimeTrigger,
} from "@/lib/host-push-prime-policy";
import { getHostToken, hydrateSession } from "@/lib/session";

/** Earliest qualifying moment wins for this local day, even if the JS session spans midnight. */
let sessionPresentedOn: string | null = null;

function claimSession(now = new Date()): boolean {
  const today = localDayKey(now);
  if (!today || sessionPresentedOn === today) return false;
  sessionPresentedOn = today;
  return true;
}

/**
 * Host-only priming. Shows the sheet before any system prompt, or skips when
 * cadence / permission says so. Granted phones register the existing token path
 * with no sheet and no permission request.
 */
export function HostPushPrime({
  receiptId,
  trigger,
  enabled,
  blocked = false,
  onRegistered,
}: {
  receiptId: string | null | undefined;
  trigger: HostPushPrimeTrigger;
  enabled: boolean;
  /** Share sheet, QR, or photo is open — wait, then present. */
  blocked?: boolean;
  onRegistered?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<"undetermined" | "denied">("undetermined");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState(false);
  const [gateTick, setGateTick] = useState(0);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const onRegisteredRef = useRef(onRegistered);
  onRegisteredRef.current = onRegistered;
  const visibleRef = useRef(false);
  const holdRef = useRef(false);
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const epoch = useRef(0);

  const hideSheet = useCallback(() => {
    visibleRef.current = false;
    holdRef.current = false;
    releaseHostPrimeSheet("push");
    setHold(false);
    setVisible(false);
  }, []);

  const present = useCallback(
    async (next: "undetermined" | "denied", token: number) => {
      if (token !== epoch.current || visibleRef.current) return;
      const shownAt = await loadHostPrimeShownAt();
      if (token !== epoch.current || visibleRef.current) return;
      if (hostPrimeCooldownActive(shownAt, new Date())) {
        holdRef.current = false;
        setHold(false);
        return;
      }
      if (!acquireHostPrimeSheet("push")) {
        setVariant(next);
        holdRef.current = true;
        setHold(true);
        return;
      }
      if (!claimSession()) {
        releaseHostPrimeSheet("push");
        holdRef.current = false;
        setHold(false);
        return;
      }
      if (token !== epoch.current) {
        releaseHostPrimeSheet("push");
        return;
      }
      visibleRef.current = true;
      holdRef.current = false;
      setHold(false);
      setVariant(next);
      setVisible(true);
      await markHostPushPrimeShown(trigger, next);
    },
    [trigger],
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !receiptId) return undefined;
      const id = receiptId;
      const token = ++epoch.current;
      let cancelled = false;
      void enqueueHostPushPrime(async () => {
        try {
          if (cancelled || token !== epoch.current || visibleRef.current || holdRef.current) return;
          await hydrateSession();
          if (cancelled || !getHostToken(id)) return;
          const permission = await readHostPushPermission();
          if (cancelled || token !== epoch.current || permission === "skip") return;
          if (permission === "granted") {
            const result = await registerHostClaimPush(id);
            if (result === "ok") {
              await markHostPushPrimeOutcome("granted", true);
              onRegisteredRef.current?.();
            }
            return;
          }
          const stored = await loadHostPushPrime();
          if (
            !shouldPresentHostPushPrime({
              permission,
              dismissedAt: stored.dismissedAt,
              lastShownAt: stored.lastShownAt,
              status: stored.status,
              trigger,
              now: new Date(),
            })
          ) {
            return;
          }
          if (cancelled || token !== epoch.current) return;
          const next = hostPushPrimeVariant(permission, stored.status.permission);
          if (blockedRef.current) {
            holdRef.current = true;
            setVariant(next);
            setHold(true);
            return;
          }
          await present(next, token);
        } catch {
          /* Priming is optional — a storage miss must not break the host screen. */
        }
      });
      return () => {
        cancelled = true;
        if (epoch.current === token) epoch.current += 1;
      };
    }, [enabled, present, receiptId, trigger]),
  );

  useEffect(() => subscribeHostPrimeSheet(() => setGateTick((n) => n + 1)), []);

  useEffect(() => {
    return () => {
      if (visibleRef.current) releaseHostPrimeSheet("push");
    };
  }, []);

  useEffect(() => {
    if (!hold || blocked) return undefined;
    const token = epoch.current;
    let cancelled = false;
    void enqueueHostPushPrime(async () => {
      try {
        if (cancelled || token !== epoch.current || blockedRef.current || visibleRef.current) return;
        if (!holdRef.current) return;
        await present(variantRef.current, token);
      } catch {
        /* Priming is optional. */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [blocked, gateTick, hold, present]);

  useEffect(() => {
    if (!visible || !receiptId) return undefined;
    const id = receiptId;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void enqueueHostPushPrime(async () => {
        try {
          const permission = await readHostPushPermission();
          if (permission !== "granted") return;
          const result = await registerHostClaimPush(id);
          await markHostPushPrimeOutcome("granted", result === "ok");
          if (result === "ok") onRegisteredRef.current?.();
          hideSheet();
        } catch {
          /* Keep the sheet up so Not now still works. */
        }
      });
    });
    return () => sub.remove();
  }, [hideSheet, receiptId, visible]);

  async function dismiss() {
    if (busy) return;
    try {
      await markHostPushPrimeDismissed();
    } finally {
      hideSheet();
    }
  }

  async function onPrimary() {
    if (!receiptId || busy) return;
    if (variant === "denied") {
      try {
        await Linking.openSettings();
      } catch {
        /* Settings unavailable — the sheet stays so Not now still works. */
      }
      return;
    }
    setBusy(true);
    try {
      const result = await requestHostPushPermissionAndRegister(receiptId);
      if (result === "ok") {
        await markHostPushPrimeOutcome("granted", true);
        onRegisteredRef.current?.();
        hideSheet();
        return;
      }
      if (result === "denied") {
        await markHostPushPrimeOutcome("denied", false);
        hideSheet();
        return;
      }
      const again = await readHostPushPermission();
      if (again === "granted") {
        await markHostPushPrimeOutcome("granted", false);
      } else if (again === "denied") {
        await markHostPushPrimeOutcome("denied", false);
      }
      hideSheet();
    } catch {
      hideSheet();
    } finally {
      setBusy(false);
    }
  }

  if (!enabled && !visible && !hold) return null;

  return (
    <HostPushPrimeSheet
      visible={visible}
      variant={variant}
      busy={busy}
      onPrimary={() => void onPrimary()}
      onDismiss={() => void dismiss()}
    />
  );
}
