import { View, type StyleProp, type ViewStyle } from "react-native";
import { Motif, type MotifName } from "@/components/motifs";
import { useCardTheme } from "@/lib/card-theme/dusk";
import { classifyLineKind, type LineKind } from "@/lib/line-kind";
import { usesCarafeMotif } from "@/lib/pour";
import type { CardTheme } from "@/lib/card-theme/themes";
import type { ItemKind, ItemPour } from "@/lib/types";

/** Matches web: stem = drink, carafe = shared pour, torn stub = food/tab. */
const MOTIF: Record<LineKind, MotifName> = { drink: "stem", food: "check-stub" };

function tint(theme: CardTheme, kind: LineKind) {
  return kind === "drink"
    ? { bg: theme.kindDrinkWash, fg: theme.kindDrink }
    : { bg: theme.kindFoodWash, fg: theme.kindFood };
}

export function LineKindIcon({
  name,
  kind,
  pour,
  size = 14,
  style,
}: {
  name: string;
  /** Prefer vision/storage kind; fall back to name heuristic. */
  kind?: ItemKind | null;
  pour?: ItemPour | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useCardTheme();
  const resolved: LineKind | null =
    kind === "food" || kind === "drink" ? kind : classifyLineKind(name);
  if (!resolved) return null;
  const { bg, fg } = tint(theme, resolved);
  const motif: MotifName =
    resolved === "drink" && usesCarafeMotif({ name, pour }) ? "carafe" : MOTIF[resolved];
  return (
    <View
      style={[
        {
          width: size + 10,
          height: size + 10,
          borderRadius: 7,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
        },
        style,
      ]}
      accessibilityLabel={
        resolved === "food" ? "Food" : motif === "carafe" ? "Shared drink" : "Drink"
      }
    >
      <Motif name={motif} size={size + 2} color={fg} />
    </View>
  );
}
