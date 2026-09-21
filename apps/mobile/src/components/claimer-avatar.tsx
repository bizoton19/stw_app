import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

/** Deterministic claimer colors — wine-adjacent, not purple SaaS. */
export const CLAIMER_COLORS = [
  "#6E2E35", // merlot
  "#2F5D50", // bottle green
  "#8B5A2B", // cork
  "#3D4F7C", // evening blue
  "#A33B32", // deep wine
  "#5C6B4A", // olive
  "#7A4054", // rose
  "#4A6670", // slate
] as const;

export function colorForName(name: string): string {
  let h = 0;
  const key = name.trim().toLowerCase() || "?";
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CLAIMER_COLORS[h % CLAIMER_COLORS.length]!;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function ClaimerAvatar({
  name,
  size = 28,
}: {
  name: string;
  size?: number;
}) {
  const bg = colorForName(name);
  const fontSize = Math.max(10, Math.round(size * 0.38));
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
      accessibilityLabel={name}
    >
      <Text style={[styles.initials, { fontSize, lineHeight: fontSize + 2 }]}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.merlotFg,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
