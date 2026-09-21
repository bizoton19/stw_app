import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

export function ChoiceRow({
  title,
  hint,
  selected,
  icon,
  onPress,
}: {
  title: string;
  hint: string;
  selected?: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} style={styles.row} accessibilityState={{ selected }}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <View style={[styles.dot, selected && styles.dotOn]} />
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
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotOn: { backgroundColor: colors.merlot, borderColor: colors.merlot },
});
