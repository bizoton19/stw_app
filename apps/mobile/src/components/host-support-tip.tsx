import { Linking, StyleSheet, Text } from "react-native";
import { PressScale } from "@/components/press-scale";
import { supportUrl } from "@/lib/config";
import { colors } from "@/lib/theme";

/** Quiet host-only tip after share / settle — opens marketing /support (PayPal). */
export function HostSupportTip() {
  return (
    <PressScale
      onPress={() => void Linking.openURL(supportUrl())}
      accessibilityRole="link"
      accessibilityLabel="Thanks for hosting. Support Split the Wine"
      style={styles.wrap}
      haptic={false}
    >
      <Text style={styles.line}>Thanks for hosting.</Text>
      <Text style={styles.link}>Support Split the Wine</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
  },
  line: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  link: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.merlot,
    textAlign: "center",
  },
});
