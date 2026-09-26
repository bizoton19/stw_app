import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

export function ChoiceRow({
  title,
  hint,
  selected,
  icon,
  onPress,
  /** Empty-state capture tiles — tall, large type, easy to hit with glasses on. */
  size = "default",
  /** Radio/check mark — off for action cards like camera / library. */
  showCheck = true,
}: {
  title: string;
  hint: string;
  selected?: boolean;
  icon: React.ReactNode;
  onPress: () => void;
  size?: "default" | "large";
  showCheck?: boolean;
}) {
  const large = size === "large";
  const showSelected = Boolean(showCheck && selected);
  return (
    <PressScale
      onPress={onPress}
      haptic="select"
      style={[styles.row, large && styles.rowLarge, showSelected && large && styles.rowLargeOn]}
      accessibilityRole="button"
      accessibilityState={showCheck ? { selected: showSelected } : undefined}
    >
      <View style={[styles.icon, large && styles.iconLarge]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={[styles.title, large && styles.titleLarge]}>{title}</Text>
        <Text style={[styles.hint, large && styles.hintLarge]}>{hint}</Text>
      </View>
      {showCheck ? (
        <View style={[styles.dot, large && styles.dotLarge, showSelected && styles.dotOn]} />
      ) : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLarge: {
    minHeight: 108,
    flexGrow: 1,
    gap: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderBottomWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: "#FFFcf8",
  },
  rowLargeOn: {
    borderColor: colors.merlot,
    backgroundColor: "rgba(110, 46, 53, 0.06)",
  },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  iconLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(110, 46, 53, 0.1)",
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  titleLarge: { fontSize: 22, fontWeight: "700", letterSpacing: -0.35, lineHeight: 28 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  hintLarge: { fontSize: 16, lineHeight: 22, color: colors.inkSoft, marginTop: 6 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotLarge: { width: 22, height: 22, borderRadius: 11 },
  dotOn: { backgroundColor: colors.merlot, borderColor: colors.merlot },
});
