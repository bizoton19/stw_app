import { ActionSheetIOS, Alert, Platform } from "react-native";

export type ActionMenuItem = {
  label: string;
  onPress: () => void;
  /** Destructive styling when the platform supports it (iOS). */
  destructive?: boolean;
};

/**
 * Platform action menu: iOS ActionSheet, Android Alert button list.
 * Use for “choose how…” menus — not for permission/info alerts (keep Alert.alert).
 */
export function showActionMenu(opts: {
  title?: string;
  message?: string;
  cancelLabel?: string;
  options: ActionMenuItem[];
}) {
  const cancelLabel = opts.cancelLabel ?? "Cancel";
  const options = opts.options.filter(Boolean);

  if (Platform.OS === "ios") {
    const labels = [...options.map((o) => o.label), cancelLabel];
    const destructiveButtonIndex = options.findIndex((o) => o.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: opts.title,
        message: opts.message,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex:
          destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
      },
      (index) => {
        if (index == null || index >= options.length) return;
        options[index]?.onPress();
      },
    );
    return;
  }

  Alert.alert(opts.title ?? "Choose", opts.message, [
    ...options.map((o) => ({
      text: o.label,
      style: o.destructive ? ("destructive" as const) : ("default" as const),
      onPress: o.onPress,
    })),
    { text: cancelLabel, style: "cancel" },
  ]);
}
