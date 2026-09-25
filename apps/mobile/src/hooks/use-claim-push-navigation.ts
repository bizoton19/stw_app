import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { parseClaimPushData } from "@/lib/host-push";

/** Opens the host live board when a claim push is tapped. */
export function useClaimPushNavigation() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    function openSettle(receiptId: string) {
      if (!receiptId || handled.current === receiptId) return;
      handled.current = receiptId;
      router.push({
        pathname: "/r/[id]/settle",
        params: { id: receiptId, host: "1" },
      });
      setTimeout(() => {
        handled.current = null;
      }, 2000);
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = parseClaimPushData(response.notification.request.content.data);
      if (data.receiptId) openSettle(data.receiptId);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = parseClaimPushData(response.notification.request.content.data);
      if (data.receiptId) openSettle(data.receiptId);
    });

    return () => sub.remove();
  }, [router]);
}
