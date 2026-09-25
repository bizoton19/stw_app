import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  ensureHostPushCategories,
  finalizeTabFromPush,
  HOST_PUSH_CLOSE_ACTION,
  parseClaimPushData,
} from "@/lib/host-push";

/** Opens the host live board when a claim push is tapped; Close tab finalizes. */
export function useClaimPushNavigation() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    void ensureHostPushCategories();

    function openSettle(receiptId: string) {
      const key = `open:${receiptId}`;
      if (!receiptId || handled.current === key) return;
      handled.current = key;
      router.push({
        pathname: "/r/[id]/settle",
        params: { id: receiptId, host: "1" },
      });
      setTimeout(() => {
        handled.current = null;
      }, 2000);
    }

    async function handleResponse(response: Notifications.NotificationResponse) {
      const data = parseClaimPushData(response.notification.request.content.data);
      if (!data.receiptId) return;

      if (response.actionIdentifier === HOST_PUSH_CLOSE_ACTION) {
        const key = `close:${data.receiptId}`;
        if (handled.current === key) return;
        handled.current = key;
        await finalizeTabFromPush(data.receiptId);
        router.push({
          pathname: "/r/[id]/settle",
          params: { id: data.receiptId, host: "1" },
        });
        setTimeout(() => {
          handled.current = null;
        }, 2000);
        return;
      }

      // Default tap (or dismiss) → open board
      if (
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ||
        !response.actionIdentifier
      ) {
        openSettle(data.receiptId);
      }
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handleResponse(response);
    });

    return () => sub.remove();
  }, [router]);
}
