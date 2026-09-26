import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LineKindIcon } from "@/components/line-kind-icon";
import { PressScale } from "@/components/press-scale";
import { centsToLabel } from "@/lib/money";
import { claimMoneySlice } from "@/lib/pour";
import { colors } from "@/lib/theme";
import type { Item } from "@/lib/types";

const PAPER = colors.paper;
const SELECTED_BG = colors.selectWash;
const SELECTED_BORDER = colors.select;
const IDLE_BORDER = "transparent";

export function ClaimLineRow({
  item,
  left,
  selected,
  onToggle,
}: {
  item: Item;
  left: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const on = useSharedValue(selected ? 1 : 0);
  const bump = useSharedValue(1);
  const money = claimMoneySlice(item, left);
  const unit = money.unitCents;
  const remainingCents = money.remainingCents;

  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 180 });
    if (selected) {
      bump.value = 0.97;
      bump.value = withSpring(1, { damping: 14, stiffness: 280 });
    }
  }, [bump, on, selected]);

  const shell = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [PAPER, SELECTED_BG]),
    borderColor: interpolateColor(on.value, [0, 1], [IDLE_BORDER, SELECTED_BORDER]),
    transform: [{ scale: bump.value }],
  }));

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.name}, ${centsToLabel(unit)} each, ${left} left, ${centsToLabel(remainingCents)} remaining`}
      haptic="select"
      onPress={onToggle}
      style={styles.hit}
    >
      <Animated.View style={[styles.row, shell]}>
        <LineKindIcon name={item.name} kind={item.kind} />
        <View style={styles.copy}>
          <Text style={[styles.name, selected && styles.nameOn]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.meta, styles.tabular]}>
            {centsToLabel(unit)} each
            {money.glasses
              ? ` · ${money.capacity} glasses · from ${item.qty} bottle${item.qty === 1 ? "" : "s"}`
              : ` · ${item.qty} on check`}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.left, selected && styles.leftOn]}>
            {centsToLabel(unit)} × {left}
            {money.glasses ? (left === 1 ? " glass" : " glasses") : ""}
          </Text>
          <Text style={[styles.remainTotal, selected && styles.leftOn]}>
            {centsToLabel(remainingCents)} left
          </Text>
        </View>
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  hit: { marginBottom: 8 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: "600", color: colors.ink, letterSpacing: -0.2 },
  nameOn: { color: colors.select, fontWeight: "700" },
  meta: { marginTop: 3, fontSize: 13, color: colors.muted },
  tabular: { fontVariant: ["tabular-nums"] },
  right: { alignItems: "flex-end", gap: 2 },
  left: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  remainTotal: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  leftOn: { color: colors.select, fontWeight: "700" },
});
