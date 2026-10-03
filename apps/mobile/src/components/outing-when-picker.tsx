import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { PressScale } from "@/components/press-scale";
import { colors } from "@/lib/theme";

type Props = {
  value: Date;
  onChange: (next: Date) => void;
};

const compactWidth = Math.min(280, Math.max(200, Dimensions.get("window").width - 80));

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function applyDate(prev: Date, picked: Date): Date {
  const next = new Date(prev);
  next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return next;
}

function applyTime(prev: Date, picked: Date): Date {
  const next = new Date(prev);
  next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return next;
}

/**
 * System date and time controls for planning an outing.
 *
 * iOS UIDatePicker lays out at 0×0 inside a ScrollView unless width and height
 * are set, which is why a picker on this screen can be present in the tree and
 * still not show. The calendar is inline (tap, not wheels) so it stays visible
 * and doesn't fight the page scroll. Light theme keeps it readable on paper.
 */
export function OutingWhenPicker({ value, onChange }: Props) {
  if (Platform.OS === "ios") {
    return (
      <View style={styles.block}>
        <Text style={styles.label}>When</Text>
        <Text style={styles.readout}>
          {formatDate(value)} · {formatTime(value)}
        </Text>
        <View style={styles.calendarSlot} collapsable={false}>
          <DateTimePicker
            testID="outing-date-picker"
            value={value}
            mode="date"
            display="inline"
            themeVariant="light"
            textColor={colors.ink}
            accentColor={colors.merlot}
            onValueChange={(_event, selected) => {
              onChange(applyDate(value, selected));
            }}
            style={styles.calendar}
          />
        </View>
        <View style={styles.timeRow} collapsable={false}>
          <Text style={styles.timeLabel}>Time</Text>
          <DateTimePicker
            testID="outing-time-picker"
            value={value}
            mode="time"
            display="compact"
            themeVariant="light"
            textColor={colors.ink}
            accentColor={colors.merlot}
            onValueChange={(_event, selected) => {
              onChange(applyTime(value, selected));
            }}
            style={[styles.timePicker, { width: compactWidth }]}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>When</Text>
      <PressScale
        accessibilityLabel={`Outing date, ${formatDate(value)}`}
        onPress={() => {
          DateTimePickerAndroid.open({
            value,
            mode: "date",
            onValueChange: (_event, selected) => {
              onChange(applyDate(value, selected));
            },
          });
        }}
        style={styles.field}
      >
        <Text style={styles.fieldText}>{formatDate(value)}</Text>
      </PressScale>
      <PressScale
        accessibilityLabel={`Outing time, ${formatTime(value)}`}
        onPress={() => {
          DateTimePickerAndroid.open({
            value,
            mode: "time",
            onValueChange: (_event, selected) => {
              onChange(applyTime(value, selected));
            },
          });
        }}
        style={styles.field}
      >
        <Text style={styles.fieldText}>{formatTime(value)}</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 8 },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
  },
  readout: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 8,
  },
  calendarSlot: {
    height: 330,
    width: "100%",
    alignSelf: "stretch",
  },
  calendar: { height: 330, width: "100%" },
  timeRow: {
    minHeight: 44,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeLabel: { fontSize: 15, fontWeight: "600", color: colors.ink },
  timePicker: { height: 40, alignSelf: "flex-start" },
  field: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.paper,
    marginBottom: 8,
  },
  fieldText: { fontSize: 16, fontWeight: "600", color: colors.ink },
});
