import { GlassWater, UtensilsCrossed } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { classifyLineKind, type LineKind } from "@/lib/line-kind";
import { colors } from "@/lib/theme";
import type { ItemKind } from "@/lib/types";

const TINT: Record<LineKind, { bg: string; fg: string }> = {
  drink: { bg: "rgba(110, 46, 53, 0.12)", fg: colors.merlot },
  food: { bg: "rgba(184, 121, 58, 0.16)", fg: "#9A5F28" },
};

export function LineKindIcon({
  name,
  kind,
  size = 14,
  style,
}: {
  name: string;
  /** Prefer vision/storage kind; fall back to name heuristic. */
  kind?: ItemKind | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const resolved: LineKind | null =
    kind === "food" || kind === "drink" ? kind : classifyLineKind(name);
  if (!resolved) return null;
  const tint = TINT[resolved];
  const Icon = resolved === "drink" ? GlassWater : UtensilsCrossed;
  return (
    <View
      style={[
        {
          width: size + 10,
          height: size + 10,
          borderRadius: 7,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint.bg,
        },
        style,
      ]}
      accessibilityLabel={resolved === "drink" ? "Drink" : "Food"}
    >
      <Icon size={size} color={tint.fg} strokeWidth={2.25} />
    </View>
  );
}
