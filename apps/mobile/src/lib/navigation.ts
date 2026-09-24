import { Platform } from "react-native";
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
