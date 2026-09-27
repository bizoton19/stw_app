import { ShoppingBasket, UtensilsCrossed, Wine } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { classifyVenueKind, type VenueKind } from "@/lib/line-kind";
import { colors } from "@/lib/theme";

const TINT: Record<VenueKind, { bg: string; fg: string; label: string }> = {
  restaurant: { bg: "rgba(92, 122, 94, 0.14)", fg: "#4F6B50", label: "Restaurant" },
  bar: { bg: "rgba(110, 46, 53, 0.12)", fg: colors.merlot, label: "Bar" },
  grocery: { bg: "rgba(61, 90, 128, 0.14)", fg: "#3D5A80", label: "Grocery" },
};

const ICON = {
  restaurant: UtensilsCrossed,
  bar: Wine,
  grocery: ShoppingBasket,
} as const;

export function VenueKindIcon({
  category,
  name,
  size = 16,
  style,
}: {
  category?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const kind = classifyVenueKind(category, name);
  if (!kind) return null;
  const tint = TINT[kind];
  const Icon = ICON[kind];
  return (
    <View
      style={[
        {
          width: size + 12,
          height: size + 12,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint.bg,
        },
        style,
      ]}
      accessibilityLabel={tint.label}
    >
      <Icon size={size} color={tint.fg} strokeWidth={2.25} />
    </View>
  );
}

/** Round desk thumb when Places gave us a venue kind (replaces letter / map). */
export function VenueKindThumb({
  category,
  name,
  size = 56,
}: {
  category?: string | null;
  name?: string | null;
  size?: number;
}) {
  const kind = classifyVenueKind(category, name);
  if (!kind) return null;
  const tint = TINT[kind];
  const Icon = ICON[kind];
  const iconSize = Math.round(size * 0.42);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tint.bg,
        borderWidth: 2,
        borderColor: tint.fg,
        flexShrink: 0,
      }}
      accessibilityLabel={tint.label}
    >
      <Icon size={iconSize} color={tint.fg} strokeWidth={2.25} />
    </View>
  );
}

export { classifyVenueKind };
