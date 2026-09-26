import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "@/lib/api";
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

/** Request permission + Expo push token; register with API for this receipt (host only). */
export async function registerHostClaimPush(
  receiptId: string,
): Promise<"ok" | "denied" | "skip" | "error"> {
  if (!Device.isDevice) return "skip";
  const hostToken = getHostToken(receiptId);
  if (!hostToken) return "skip";

  await ensureHostPushCategories();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== "granted") {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== "granted") return "denied";

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
