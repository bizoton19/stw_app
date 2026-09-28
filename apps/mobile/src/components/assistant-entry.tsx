import { StyleSheet, Text, View } from "react-native";
import { Bot } from "lucide-react-native";
import { PressScale } from "@/components/press-scale";
import { colors, space } from "@/lib/theme";

/**
 * Welcoming entry to the host co-pilot — fits the QuietButton slot
 * under Add line / Add fee without looking like a second primary CTA.
 */
export function AssistantEntry({ onPress }: { onPress: () => void }) {
  return (
    <PressScale
      onPress={onPress}
      haptic="select"
      accessibilityRole="button"
      accessibilityLabel="Ask the check assistant"
      style={styles.wrap}
    >
      <View style={styles.iconWrap}>
        <Bot size={22} color={colors.merlot} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Need a hand with this check?</Text>
        <Text style={styles.sub}>Ask about fees, tip, tax, or a line</Text>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(110, 46, 53, 0.22)",
    backgroundColor: "rgba(110, 46, 53, 0.05)",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(110, 46, 53, 0.18)",
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.1,
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkSoft,
  },
});
