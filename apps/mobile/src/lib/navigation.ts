import { Platform } from "react-native";
import { router } from "expo-router";
import { colors } from "@/lib/theme";

/** Shared Expo Router Stack screenOptions — platform-adaptive transitions. */
export const nativeStackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.paper },
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animation: Platform.select({
    ios: "slide_from_right" as const,
    android: "fade_from_bottom" as const,
    default: "slide_from_right" as const,
  }),
  animationDuration: Platform.OS === "ios" ? 320 : 250,
};

/**
 * Leave host / receipt stacks in one step (avoid hammering Back through the interview).
 */
export function goHostDesk() {
  const r = router as typeof router & {
    canDismiss?: () => boolean;
    dismissAll?: () => void;
  };
  try {
    if (typeof r.canDismiss === "function" && r.canDismiss() && typeof r.dismissAll === "function") {
      r.dismissAll();
    }
  } catch {
    /* older runtimes — replace alone is enough */
  }
  router.replace("/");
}
