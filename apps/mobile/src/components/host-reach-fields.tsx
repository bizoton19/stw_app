import { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import { PressScale } from "@/components/press-scale";
import {
  HOST_REACH_CHANNELS,
  HOST_REACH_LABEL,
  isPhoneReachChannel,
} from "@/lib/host-reach";
import { deviceRegionCode } from "@/lib/pay-region";
import {
  DIAL_COUNTRIES,
  dialCountryForRegion,
  validatePhoneParts,
  type DialCountry,
} from "@/lib/phone";
import type { HostReach, HostReachChannel } from "@/lib/types";
import { colors } from "@/lib/theme";

type Props = {
  channel: HostReachChannel;
  /** National digits only when phone channel; full value for email/other. */
  value: string;
  country: DialCountry;
  onChangeChannel: (channel: HostReachChannel) => void;
  onChangeValue: (value: string) => void;
  onChangeCountry: (country: DialCountry) => void;
  error?: string | null;
};

/**
 * Builds the HostReach payload from the form fields.
 * Returns null when the host left reach blank (optional).
 */
export function buildHostReach(
  channel: HostReachChannel,
  value: string,
  country: DialCountry,
): { ok: true; reach: HostReach | null } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, reach: null };

  if (isPhoneReachChannel(channel)) {
    const phone = validatePhoneParts(country.dial, trimmed);
    if (!phone.ok) return phone;
    return { ok: true, reach: { channel, value: phone.e164 } };
  }

  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, message: "That email doesn’t look right." };
    }
    return { ok: true, reach: { channel, value: trimmed } };
  }

  if (trimmed.length < 2) return { ok: false, message: "Add a bit more detail." };
  return { ok: true, reach: { channel, value: trimmed } };
}

export function defaultDialCountry(): DialCountry {
  return dialCountryForRegion(deviceRegionCode());
}

export function HostReachFields({
  channel,
  value,
  country,
  onChangeChannel,
  onChangeValue,
  onChangeCountry,
  error,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const phone = isPhoneReachChannel(channel);

  const dialLabel = useMemo(() => `+${country.dial}`, [country.dial]);

  function openCountryPicker() {
    if (Platform.OS === "ios") {
      const labels = [...DIAL_COUNTRIES.map((c) => c.label), "Cancel"];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: labels,
          cancelButtonIndex: labels.length - 1,
          title: "Country code",
        },
        (index) => {
          if (index == null || index >= DIAL_COUNTRIES.length) return;
          onChangeCountry(DIAL_COUNTRIES[index]);
        },
      );
      return;
    }
    setPickerOpen(true);
  }

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

      {phone ? (
        <View style={styles.phoneRow}>
          <PressScale haptic={false} onPress={openCountryPicker} style={styles.dialBtn}>
            <Text style={styles.dialText}>{dialLabel}</Text>
            <ChevronDown size={16} color={colors.muted} strokeWidth={2} />
          </PressScale>
          <TextInput
            value={value}
            onChangeText={onChangeValue}
            placeholder={country.region === "HT" ? "3812 3456" : "555 123 4567"}
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.phoneInput]}
            autoComplete="tel"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          placeholder={channel === "email" ? "you@example.com" : "Link or how to reach you"}
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoComplete={channel === "email" ? "email" : "off"}
          keyboardType={channel === "email" ? "email-address" : "default"}
          autoCapitalize="none"
        />
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {Platform.OS !== "ios" ? (
        <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={styles.sheetScrim} onPress={() => setPickerOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Country code</Text>
              <ScrollView style={styles.sheetList}>
                {DIAL_COUNTRIES.map((c) => (
                  <Pressable
                    key={`${c.region}-${c.dial}`}
                    style={styles.sheetRow}
                    onPress={() => {
                      onChangeCountry(c);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={styles.sheetRowText}>{c.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
  phoneRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  dialBtn: {
    height: 48,
    minWidth: 76,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dialText: { fontSize: 16, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
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
  phoneInput: { flex: 1 },
  err: { marginTop: 8, fontSize: 13, color: colors.danger },
  sheetScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetList: { paddingHorizontal: 8 },
  sheetRow: { paddingHorizontal: 12, paddingVertical: 14 },
  sheetRowText: { fontSize: 16, color: colors.ink },
});
