import { UtensilsCrossed, Wine } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { classifyVenueKind, type VenueKind } from "@/lib/line-kind";
import { colors } from "@/lib/theme";

const TINT: Record<VenueKind, { bg: string; fg: string }> = {
  restaurant: { bg: "rgba(92, 122, 94, 0.14)", fg: "#4F6B50" },
  bar: { bg: "rgba(110, 46, 53, 0.12)", fg: colors.merlot },
};

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
  const Icon = kind === "bar" ? Wine : UtensilsCrossed;
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
      accessibilityLabel={kind === "bar" ? "Bar" : "Restaurant"}
    >
      <Icon size={size} color={tint.fg} strokeWidth={2.25} />
    </View>
  );
}
