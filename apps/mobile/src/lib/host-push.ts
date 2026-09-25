import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "@/lib/api";
import { getHostToken } from "@/lib/session";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function easProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId
  );
}

/** Request permission + Expo push token; register with API for this receipt (host only). */
export async function registerHostClaimPush(receiptId: string): Promise<"ok" | "denied" | "skip" | "error"> {
  if (!Device.isDevice) return "skip";
  const hostToken = getHostToken(receiptId);
  if (!hostToken) return "skip";

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

export type ClaimPushData = {
  receiptId?: string;
  screen?: string;
  kind?: string;
};

export function parseClaimPushData(data: unknown): ClaimPushData {
  if (!data || typeof data !== "object") return {};
  const row = data as Record<string, unknown>;
  return {
    receiptId: typeof row.receiptId === "string" ? row.receiptId : undefined,
    screen: typeof row.screen === "string" ? row.screen : undefined,
    kind: typeof row.kind === "string" ? row.kind : undefined,
  };
}
