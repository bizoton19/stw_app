import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Bell, ChevronDown } from "lucide-react-native";
import { PressScale } from "@/components/press-scale";
import { colors } from "@/lib/theme";

/** Expandable host note for claimers. Renders nothing when empty. */
export function HostMessage({ note }: { note: string | null | undefined }) {
  const text = note?.trim();
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <View style={styles.wrap}>
      <PressScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Host message"
        onPress={() => setOpen((v) => !v)}
        style={styles.head}
        haptic="select"
      >
        <Bell size={16} color={colors.merlot} strokeWidth={2.25} />
        <Text style={styles.title}>Host message</Text>
        <ChevronDown
          size={16}
          color={colors.inkSoft}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </PressScale>
      {open ? <Text style={styles.body}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(110, 46, 53, 0.22)",
    backgroundColor: "rgba(110, 46, 53, 0.05)",
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  title: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.ink },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(110, 46, 53, 0.14)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
});
