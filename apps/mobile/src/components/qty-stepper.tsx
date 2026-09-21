import { StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

export function QtyStepper({
  value,
  min = 0,
  max,
  onChange,
  labelledBy,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  labelledBy?: string;
}) {
  return (
    <View style={styles.row} accessibilityLabel={labelledBy}>
      <PressScale
        accessibilityLabel="Decrease quantity"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={styles.hit}
      >
        <Minus size={16} color={colors.ink} />
      </PressScale>
      <Text style={styles.value}>{value}</Text>
      <PressScale
        accessibilityLabel="Increase quantity"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={styles.hit}
      >
        <Plus size={16} color={colors.ink} />
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  hit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  value: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: colors.ink,
  },
});
