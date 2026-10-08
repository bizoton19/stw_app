import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import { MapPin } from "lucide-react-native";
import { HostPushPrimeSheet } from "@/components/host-push-prime-sheet";
import { loadHostPrimeShownAt } from "@/lib/host-prime-cooldown";
import { hostPrimeCooldownActive } from "@/lib/host-prime-policy";
import {
  acquireHostPrimeSheet,
  enqueueHostPrime,
  otherHostPrimeSheetVisible,
  releaseHostPrimeSheet,
  subscribeHostPrimeSheet,
} from "@/lib/host-prime-queue";
import {
  loadHostLocationPrime,
  markHostLocationPrimeDismissed,
  markHostLocationPrimeOutcome,
  markHostLocationPrimeShown,
} from "@/lib/host-location-prime";
import {
  HOST_LOCATION_PRIME_COPY,
  classifyHostLocationPermission,
  hostLocationPrimeResolvedToday,
  hostLocationPrimeVariant,
  hostLocationPrimeWaitMs,
  hostLocationSheetEnabled,
  mayRequestHostLocationPermission,
  noteHostLocationPrimeResolved,
  shouldAutoShowHostLocationPrime,
  shouldCloseLocationPrimeForGrant,
  shouldPresentHostLocationPrime,
  shouldRememberSystemLocationDenial,
  shouldRevealDeniedLocationVariant,
  type HostLocationPermission,
} from "@/lib/host-location-prime-policy";
import { colors } from "@/lib/theme";

/**
 * Place-step location priming. Auto-shows at most once a day, and never on
 * top of the notification sheet. The quiet line calls `openerRef` and skips
 * that cadence.
 */
export function HostLocationPrime({
  active,
  permission,
  onPermission,
  onGranted,
  openerRef,
}: {
  /** Focused place step, nothing pinned, query under 2 characters, keyboard down. */
  active: boolean;
  permission: HostLocationPermission | null;
  onPermission: (permission: HostLocationPermission) => void;
  onGranted: () => void;
  openerRef: { current: (() => void) | null };
}) {
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<"undetermined" | "denied">("undetermined");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState(false);
  const [gateTick, setGateTick] = useState(0);
  const visibleRef = useRef(false);
  const holdRef = useRef(false);
  const closingRef = useRef(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const permissionRef = useRef(permission);
  permissionRef.current = permission;
  const onPermissionRef = useRef(onPermission);
  onPermissionRef.current = onPermission;
  const onGrantedRef = useRef(onGranted);
  onGrantedRef.current = onGranted;

  const hideSheet = useCallback(() => {
    closingRef.current = true;
    visibleRef.current = false;
    holdRef.current = false;
    releaseHostPrimeSheet("location");
    setHold(false);
    setVisible(false);
  }, []);

  const showSheet = useCallback((next: "undetermined" | "denied") => {
    closingRef.current = false;
    visibleRef.current = true;
    holdRef.current = false;
    variantRef.current = next;
    setHold(false);
    setVariant(next);
    setVisible(true);
  }, []);

  const clearHold = useCallback(() => {
    if (!holdRef.current) return;
    holdRef.current = false;
    setHold(false);
  }, []);

  const tryAutoShow = useCallback(
    async (cancelled: () => boolean) => {
      await enqueueHostPrime(async () => {
        try {
          const live = permissionRef.current;
          if (!hostLocationSheetEnabled(Platform.OS)) return;
          if (cancelled() || !live || live === "granted" || visibleRef.current) return;
          const stored = await loadHostLocationPrime();
          const shownAt = await loadHostPrimeShownAt();
          const now = new Date();
          if (cancelled() || visibleRef.current) return;
          const otherVisible = otherHostPrimeSheetVisible("location");
          const presentable =
            !hostLocationPrimeResolvedToday(now) &&
            shouldPresentHostLocationPrime({
              permission: live,
              dismissedAt: stored.dismissedAt,
              lastShownAt: stored.lastShownAt,
              now,
            }) &&
            !hostPrimeCooldownActive(shownAt, now);
          if (
            !shouldAutoShowHostLocationPrime({
              permission: live,
              dismissedAt: stored.dismissedAt,
              lastShownAt: stored.lastShownAt,
              shownAt,
              otherSheetVisible: otherVisible,
              now,
            })
          ) {
            if (otherVisible && presentable) {
              const next = hostLocationPrimeVariant(live, stored.status.permission);
              variantRef.current = next;
              setVariant(next);
              holdRef.current = true;
              setHold(true);
            } else {
              clearHold();
            }
            return;
          }
          if (!acquireHostPrimeSheet("location")) {
            const next = hostLocationPrimeVariant(live, stored.status.permission);
            variantRef.current = next;
            setVariant(next);
            holdRef.current = true;
            setHold(true);
            return;
          }
          if (cancelled()) {
            releaseHostPrimeSheet("location");
            return;
          }
          const next = hostLocationPrimeVariant(live, stored.status.permission);
          noteHostLocationPrimeResolved(now);
          showSheet(next);
          await markHostLocationPrimeShown(next, now);
        } catch {
          if (!visibleRef.current) releaseHostPrimeSheet("location");
        }
      });
    },
    [clearHold, showSheet],
  );

  useEffect(() => {
    if (!hostLocationSheetEnabled(Platform.OS)) return undefined;
    if (!active || !permission || permission === "granted") return undefined;
    const started = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (!cancelled) void tryAutoShow(() => cancelled);
      }, hostLocationPrimeWaitMs(Date.now() - started));
    });
    return () => {
      cancelled = true;
      interaction.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [active, permission, tryAutoShow]);

  useEffect(() => subscribeHostPrimeSheet(() => setGateTick((n) => n + 1)), []);

  useEffect(() => {
    return () => {
      if (visibleRef.current) releaseHostPrimeSheet("location");
    };
  }, []);

  useEffect(() => {
    if (!hold || !active || !permission || permission === "granted") return undefined;
    let cancelled = false;
    void tryAutoShow(() => cancelled || !holdRef.current);
    return () => {
      cancelled = true;
    };
  }, [active, gateTick, hold, permission, tryAutoShow]);

  useEffect(() => {
    if (!shouldCloseLocationPrimeForGrant({ visible: visibleRef.current, permission })) return;
    hideSheet();
  }, [hideSheet, permission]);

  useEffect(() => {
    if (
      !shouldRevealDeniedLocationVariant({
        visible,
        permission,
        variant: variantRef.current,
        busy: busy || busyRef.current,
        closing: closingRef.current,
      })
    ) {
      return;
    }
    variantRef.current = "denied";
    setVariant("denied");
  }, [busy, permission, visible]);

  const openFromQuietLine = useCallback(() => {
    if (!hostLocationSheetEnabled(Platform.OS)) return;
    void enqueueHostPrime(async () => {
      try {
        const live = permissionRef.current;
        if (!hostLocationSheetEnabled(Platform.OS)) return;
        if (!live || live === "granted" || visibleRef.current) return;
        const stored = await loadHostLocationPrime();
        if (visibleRef.current) return;
        if (!acquireHostPrimeSheet("location")) return;
        showSheet(hostLocationPrimeVariant(live, stored.status.permission));
      } catch {
        if (!visibleRef.current) releaseHostPrimeSheet("location");
      }
    });
  }, [showSheet]);

  useEffect(() => {
    openerRef.current = openFromQuietLine;
    return () => {
      openerRef.current = null;
    };
  }, [openFromQuietLine, openerRef]);

  async function dismiss() {
    if (busy) return;
    noteHostLocationPrimeResolved();
    try {
      await markHostLocationPrimeDismissed();
    } finally {
      hideSheet();
    }
  }

  async function onPrimary() {
    if (busy) return;
    if (variantRef.current === "denied") {
      try {
        await Linking.openSettings();
      } catch {
        /* Settings unavailable — the sheet stays so Not now still works. */
      }
      return;
    }
    const live = permissionRef.current;
    if (!live || !mayRequestHostLocationPermission(live)) {
      if (live === "granted") {
        onGrantedRef.current();
        hideSheet();
        return;
      }
      if (live === "denied") {
        variantRef.current = "denied";
        setVariant("denied");
        try {
          await Linking.openSettings();
        } catch {
          /* Sheet stays on the Settings variant. */
        }
      }
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      const fresh = classifyHostLocationPermission({
        status: current.status,
        canAskAgain: current.canAskAgain,
      });
      if (!mayRequestHostLocationPermission(fresh)) {
        await markHostLocationPrimeOutcome(fresh);
        onPermissionRef.current(fresh);
        if (fresh === "granted") {
          noteHostLocationPrimeResolved();
          onGrantedRef.current();
          hideSheet();
        } else {
          variantRef.current = "denied";
          setVariant("denied");
          try {
            await Linking.openSettings();
          } catch {
            /* Sheet stays on the Settings variant. */
          }
        }
        return;
      }
      // Only call site for the system location prompt.
      const result = await Location.requestForegroundPermissionsAsync();
      // The dialog's dismiss fires AppState before this returns. Mark closing
      // before any await so that refresh cannot swap the copy on the way out.
      closingRef.current = true;
      const next = classifyHostLocationPermission({
        status: result.status,
        canAskAgain: result.canAskAgain,
      });
      noteHostLocationPrimeResolved();
      await markHostLocationPrimeOutcome(next);
      if (shouldRememberSystemLocationDenial(next)) {
        await markHostLocationPrimeDismissed();
      }
      onPermissionRef.current(next);
      if (next === "granted") onGrantedRef.current();
      hideSheet();
    } catch {
      hideSheet();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (!hostLocationSheetEnabled(Platform.OS)) return null;
  if (!permission && !visible) return null;
  if (permission === "granted" && !visible && !hold) return null;

  return (
    <HostPushPrimeSheet
      visible={visible}
      variant={variant}
      busy={busy}
      icon={<MapPin size={30} color={colors.inkSoft} strokeWidth={2} />}
      copy={HOST_LOCATION_PRIME_COPY[variant]}
      onPrimary={() => void onPrimary()}
      onDismiss={() => void dismiss()}
    />
  );
}
