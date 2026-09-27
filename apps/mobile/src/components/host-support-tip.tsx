import { Linking, StyleSheet, Text } from "react-native";
import { PressScale } from "@/components/press-scale";
import { supportUrl } from "@/lib/config";
import { colors } from "@/lib/theme";

/** Quiet host-only tip after share / settle — opens marketing /support. */
export function HostSupportTip() {
  return (
    <PressScale
      onPress={() => void Linking.openURL(supportUrl())}
      accessibilityRole="link"
      accessibilityLabel="Support Split the Wine"
      style={styles.wrap}
      haptic={false}
    >
      <Text style={styles.link}>Support Split the Wine</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 6,
  },
  link: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
});
