import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "@/lib/api";
import {
  classifyHostPushPermission,
  mayRequestHostPushPermission,
  type HostPushPermission,
} from "@/lib/host-push-prime-policy";
import { getHostToken } from "@/lib/session";

export const HOST_PUSH_DONE_CATEGORY = "stw-tab-done";
export const HOST_PUSH_CLOSE_ACTION = "close-tab";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let categoriesReady: Promise<void> | null = null;

export function ensureHostPushCategories(): Promise<void> {
  if (!categoriesReady) {
    categoriesReady = Notifications.setNotificationCategoryAsync(HOST_PUSH_DONE_CATEGORY, [
      {
        identifier: HOST_PUSH_CLOSE_ACTION,
        buttonTitle: "Close tab",
        options: {
          opensAppToForeground: true,
          isDestructive: false,
          isAuthenticationRequired: false,
        },
      },
    ]).then(() => undefined);
  }
  return categoriesReady;
}

function easProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId
  );
}

export type HostPushRegisterResult = "ok" | "denied" | "undetermined" | "skip" | "error";

/** Read OS notification permission. Does not prompt. */
export async function readHostPushPermission(): Promise<HostPushPermission | "skip"> {
  if (Platform.OS === "web") return "skip";
  try {
    const current = await Notifications.getPermissionsAsync();
    return classifyHostPushPermission({
      status: current.status,
      canAskAgain: current.canAskAgain,
    });
  } catch {
    return "skip";
  }
}

/**
 * Register this phone's Expo push token when permission is already granted.
 * Never calls requestPermissionsAsync — the priming sheet asks first.
 */
export async function registerHostClaimPush(receiptId: string): Promise<HostPushRegisterResult> {
  if (!Device.isDevice) return "skip";
  const hostToken = getHostToken(receiptId);
  if (!hostToken) return "skip";

  const permission = await readHostPushPermission();
  if (permission !== "granted") return permission;

  await ensureHostPushCategories();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("claims", {
      name: "Claims",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = easProjectId();
  if (!projectId) return "error";

  try {
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    await api(`/api/receipts/${receiptId}/host-push`, {
      method: "PUT",
      hostToken,
      body: JSON.stringify({
        token: push.data,
        platform: Platform.OS,
      }),
    });
    return "ok";
  } catch {
    return "error";
  }
}

/**
 * Undetermined sheet primary only. One system prompt, then the same token PUT.
 * Denied (or canAskAgain false) returns without calling requestPermissionsAsync.
 */
export async function requestHostPushPermissionAndRegister(
  receiptId: string,
): Promise<HostPushRegisterResult> {
  const permission = await readHostPushPermission();
  if (permission === "skip") return "skip";
  if (!mayRequestHostPushPermission(permission)) {
    if (permission === "granted") return registerHostClaimPush(receiptId);
    return "denied";
  }

  const asked = await Notifications.requestPermissionsAsync();
  const next = classifyHostPushPermission({
    status: asked.status,
    canAskAgain: asked.canAskAgain,
  });
  if (next !== "granted") return next;
  return registerHostClaimPush(receiptId);
}

export async function finalizeTabFromPush(receiptId: string): Promise<boolean> {
  const hostToken = getHostToken(receiptId);
  if (!hostToken) return false;
  try {
    await api(`/api/receipts/${receiptId}/finalize`, {
      method: "POST",
      hostToken,
    });
    const { patchHostedReceipt } = await import("./host-tabs");
    await patchHostedReceipt(receiptId, { status: "finalized" });
    return true;
  } catch {
    return false;
  }
}

export type ClaimPushData = {
  receiptId?: string;
  screen?: string;
  kind?: string;
  tabDone?: boolean;
};

export function parseClaimPushData(data: unknown): ClaimPushData {
  if (!data || typeof data !== "object") return {};
  const row = data as Record<string, unknown>;
  return {
    receiptId: typeof row.receiptId === "string" ? row.receiptId : undefined,
    screen: typeof row.screen === "string" ? row.screen : undefined,
    kind: typeof row.kind === "string" ? row.kind : undefined,
    tabDone: row.tabDone === true,
  };
}
