import { StyleSheet, Text } from "react-native";
import { Copy, QrCode, Share2 } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

/** Secondary action with icon — copy / share / QR / etc. Not for primary Continue. */
export function IconActionButton({
  label,
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  icon: "copy" | "share" | "qr";
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const Icon = icon === "copy" ? Copy : icon === "qr" ? QrCode : Share2;
  const off = Boolean(disabled) || !onPress;
  return (
    <PressScale
      onPress={onPress}
      disabled={off}
      haptic="light"
      style={styles.btn}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Icon size={18} color={off ? colors.muted : colors.ink} strokeWidth={2.25} />
      <Text style={[styles.label, off && styles.labelOff]} numberOfLines={1}>
        {label}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
    paddingHorizontal: 10,
  },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
  labelOff: { color: colors.muted },
});
