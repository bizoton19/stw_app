import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";

/**
 * When the OS shares a receipt photo into the app (iOS Share Extension /
 * Android ACTION_SEND), jump straight into the host capture step.
 */
export function ShareIntentGate() {
  const router = useRouter();
  const { hasShareIntent, shareIntent } = useShareIntentContext();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) {
      handledRef.current = null;
      return;
    }
    const file = shareIntent.files?.[0];
    if (!file?.path) return;
    if (handledRef.current === file.path) return;
    handledRef.current = file.path;
    router.replace("/host/capture");
  }, [hasShareIntent, router, shareIntent.files]);

  return null;
}
