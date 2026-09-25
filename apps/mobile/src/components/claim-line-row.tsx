import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { PressScale } from "@/components/press-scale";
import { centsToLabel } from "@/lib/money";
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

  const accent = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scaleY: 0.35 + on.value * 0.65 }],
  }));

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.name}, ${centsToLabel(item.totalCents)}, ${left} left`}
      haptic="select"
      onPress={onToggle}
      style={styles.hit}
    >
      <Animated.View style={[styles.row, shell]}>
        <Animated.View style={[styles.accent, accent]} />
        <View style={styles.copy}>
          <Text style={[styles.name, selected && styles.nameOn]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.meta, styles.tabular]}>
            {centsToLabel(item.totalCents)} for {item.qty}
          </Text>
        </View>
        <Text style={[styles.left, selected && styles.leftOn]}>{left} left</Text>
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
    paddingLeft: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.select,
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: "600", color: colors.ink, letterSpacing: -0.2 },
  nameOn: { color: colors.select, fontWeight: "700" },
  meta: { marginTop: 3, fontSize: 13, color: colors.muted },
  tabular: { fontVariant: ["tabular-nums"] },
  left: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  leftOn: { color: colors.select, fontWeight: "700" },
});
