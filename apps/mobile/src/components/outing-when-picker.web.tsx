import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/theme";

type Props = {
  value: Date;
  onChange: (next: Date) => void;
};

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Web fallback. iOS/Android use the system picker in `outing-when-picker.tsx`. */
export function OutingWhenPicker({ value, onChange }: Props) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>When</Text>
      <TextInput
        value={toLocalInput(value)}
        onChangeText={(text) => {
          const next = new Date(text);
          if (!Number.isNaN(next.getTime())) onChange(next);
        }}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={styles.input}
      />
      <Text style={styles.hint}>Local date and time.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 4 },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
  },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
});
