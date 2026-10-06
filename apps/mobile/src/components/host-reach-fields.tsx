import { StyleSheet, Text, TextInput, View } from "react-native";
import { PressScale } from "@/components/press-scale";
import { HOST_REACH_CHANNELS, HOST_REACH_LABEL } from "@/lib/host-reach";
import type { HostReachChannel } from "@/lib/types";
import { colors } from "@/lib/theme";

type Props = {
  channel: HostReachChannel;
  value: string;
  onChangeChannel: (channel: HostReachChannel) => void;
  onChangeValue: (value: string) => void;
};

const PLACEHOLDER: Record<HostReachChannel, string> = {
  imessage: "+1 555 123 4567",
  sms: "+1 555 123 4567",
  whatsapp: "+1 555 123 4567",
  email: "you@example.com",
  signal: "+1 555 123 4567",
  other: "Link or how to reach you",
};

export function HostReachFields({ channel, value, onChangeChannel, onChangeValue }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>How can people reach you? (optional)</Text>
      <View style={styles.chips}>
        {HOST_REACH_CHANNELS.map((c) => {
          const on = c === channel;
          return (
            <PressScale
              key={c}
              haptic={false}
              onPress={() => onChangeChannel(c)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{HOST_REACH_LABEL[c]}</Text>
            </PressScale>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeValue}
        placeholder={PLACEHOLDER[channel]}
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoComplete={channel === "email" ? "email" : "tel"}
        keyboardType={channel === "email" ? "email-address" : "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  chipOn: {
    borderColor: colors.merlot,
    backgroundColor: "rgba(110, 46, 53, 0.08)",
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextOn: { color: colors.merlot },
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
