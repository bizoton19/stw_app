import { StyleSheet, Text, View } from "react-native";
import { Copy, Share2 } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

/** Secondary action with icon — copy / share / etc. Not for primary Continue. */
export function IconActionButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: "copy" | "share";
  onPress?: () => void;
  disabled?: boolean;
}) {
  const Icon = icon === "copy" ? Copy : Share2;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || !onPress}
      haptic="light"
      style={styles.btn}
      accessibilityLabel={label}
    >
      <Icon size={18} color={colors.ink} strokeWidth={2.25} />
      <Text style={styles.label}>{label}</Text>
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
    paddingHorizontal: 16,
  },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
});
