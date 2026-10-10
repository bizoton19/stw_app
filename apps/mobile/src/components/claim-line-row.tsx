import { useEffect, useMemo } from "react";
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
import { useCardTheme } from "@/lib/card-theme/dusk";
import type { CardTheme } from "@/lib/card-theme/themes";
import { centsToLabel } from "@/lib/money";
import { claimMoneySlice } from "@/lib/pour";
import type { Item } from "@/lib/types";

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
  const theme = useCardTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
    backgroundColor: interpolateColor(on.value, [0, 1], [theme.paper, theme.selectWash]),
    borderColor: interpolateColor(on.value, [0, 1], [IDLE_BORDER, theme.select]),
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
        <LineKindIcon name={item.name} kind={item.kind} pour={item.pour} />
        <View style={styles.copy}>
          <Text style={[styles.name, selected && styles.nameOn]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.meta, styles.tabular]}>
            {centsToLabel(unit)} each
            {money.glasses
              ? ` · ${money.capacity} glasses${
                  item.qty > 1 ? ` (from ${item.qty} on check)` : ""
                }`
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

function createStyles(theme: CardTheme) {
  return StyleSheet.create({
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
    name: { fontSize: 16, fontWeight: "600", color: theme.ink, letterSpacing: -0.2 },
    nameOn: { color: theme.select, fontWeight: "700" },
    meta: { marginTop: 3, fontSize: 13, color: theme.muted },
    tabular: { fontVariant: ["tabular-nums"] },
    right: { alignItems: "flex-end", gap: 2 },
    left: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.inkSoft,
      fontVariant: ["tabular-nums"],
    },
    remainTotal: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.ink,
      fontVariant: ["tabular-nums"],
    },
    leftOn: { color: theme.select, fontWeight: "700" },
  });
}
