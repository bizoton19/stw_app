import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Meaningful haptics only — claim toggle, destructive, success/error. Skip on web. */
export async function hapticSelect() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.selectionAsync();
  } catch {
    /* simulator / unsupported */
  }
}

export async function hapticImpact(
  style: "light" | "medium" | "heavy" = "light",
) {
  if (Platform.OS === "web") return;
  try {
    const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    } as const;
    await Haptics.impactAsync(map[style]);
  } catch {
    /* ignore */
  }
}

export async function hapticNotify(
  type: "success" | "warning" | "error" = "success",
) {
  if (Platform.OS === "web") return;
  try {
    const map = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    } as const;
    await Haptics.notificationAsync(map[type]);
  } catch {
    /* ignore */
  }
}
