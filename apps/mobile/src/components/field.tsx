import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/lib/theme";

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {hint ? <Text style={styles.hint}> {hint}</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 8 },
  hint: { fontWeight: "400", color: colors.muted },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "transparent",
  },
});
