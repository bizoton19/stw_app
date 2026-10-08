import { StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { stepperLimitPaint } from "@/lib/stepper-limit";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

export function QtyStepper({
  value,
  min = 0,
  max,
  onChange,
  labelledBy,
  variant = "plain",
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  labelledBy?: string;
  /**
   * `plain` is the claim stepper (44pt hits, no field chrome).
   * `field` sits in a dense host line beside name and amount inputs.
   */
  variant?: "plain" | "field";
}) {
  const field = variant === "field";
  const icon = field ? 14 : 16;
  const glyph = field ? colors.inkSoft : colors.ink;
  const atMin = value <= min;
  const atMax = value >= max;
  const fewer = stepperLimitPaint(atMin);
  const more = stepperLimitPaint(atMax);

  function step(delta: number) {
    if (delta < 0) {
      if (value <= min) return;
      onChange(value - 1);
      return;
    }
    if (value >= max) return;
    onChange(value + 1);
  }

  return (
    <View
      style={field ? styles.field : styles.row}
      accessibilityLabel={labelledBy}
    >
      <PressScale
        accessibilityLabel="Decrease quantity"
        disabled={atMin}
        haptic="select"
        onPress={() => step(-1)}
        hitSlop={field ? { top: 6, bottom: 6, left: 6, right: 2 } : undefined}
        style={[
          field ? styles.fieldHit : styles.hit,
          fewer.hairline && {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors[fewer.outline],
            borderRadius: field ? 8 : 22,
          },
        ]}
      >
        <Minus size={icon} color={fewer.glyph === "inkFirm" ? colors.inkFirm : glyph} />
      </PressScale>
      <Text style={field ? styles.fieldValue : styles.value}>{value}</Text>
      <PressScale
        accessibilityLabel="Increase quantity"
        disabled={atMax}
        haptic="select"
        onPress={() => step(1)}
        hitSlop={field ? { top: 6, bottom: 6, left: 2, right: 6 } : undefined}
        style={[
          field ? styles.fieldHit : styles.hit,
          more.hairline && {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors[more.outline],
            borderRadius: field ? 8 : 22,
          },
        ]}
      >
        <Plus size={icon} color={more.glyph === "inkFirm" ? colors.inkFirm : glyph} />
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
  /** Same box as the host line inputs: 36pt, hairline, radius 8, paper. */
  field: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    paddingHorizontal: 2,
  },
  fieldHit: { width: 26, height: 36, alignItems: "center", justifyContent: "center" },
  fieldValue: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: colors.ink,
  },
});
