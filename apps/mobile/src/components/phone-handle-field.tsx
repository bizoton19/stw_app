import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import { PressScale } from "@/components/press-scale";
import {
  DIAL_CODES,
  DEFAULT_DIAL,
  digitsOnly,
  findDialByIso,
  validatePhoneNational,
  type DialCode,
} from "@/lib/contact";
import { colors } from "@/lib/theme";

function splitE164(raw: string, fallbackIso: string): { iso: string; national: string } {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed);
    const sorted = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
    for (const code of sorted) {
      const prefix = digitsOnly(code.dial);
      if (digits.startsWith(prefix)) {
        return { iso: code.iso, national: digits.slice(prefix.length) };
      }
    }
  }
  return { iso: fallbackIso, national: digitsOnly(trimmed) };
}

/**
 * Country-code + national number → writes E.164 into `value` / `onChange`.
 */
export function PhoneHandleField({
  label,
  value,
  onChange,
  defaultIso = DEFAULT_DIAL.iso,
  error,
}: {
  label: string;
  value: string;
  onChange: (e164: string) => void;
  defaultIso?: string;
  error?: string | null;
}) {
  const initial = splitE164(value, defaultIso);
  const [iso, setIso] = useState(initial.iso || defaultIso);
  const [national, setNational] = useState(initial.national);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dial = useMemo(() => findDialByIso(iso), [iso]);

  useEffect(() => {
    const next = splitE164(value, defaultIso);
    setIso(next.iso || defaultIso);
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from parent handle only
  }, [value]);

  function emit(nextIso: string, nextNational: string) {
    const check = validatePhoneNational(nextNational, nextIso);
    onChange(check.ok ? check.e164 : nextNational ? `${findDialByIso(nextIso).dial}${digitsOnly(nextNational)}` : "");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <PressScale
          onPress={() => setPickerOpen(true)}
          style={styles.dialBtn}
          accessibilityLabel="Country code"
        >
          <Text style={styles.dialText}>{dial.dial}</Text>
          <ChevronDown size={14} color={colors.inkSoft} />
        </PressScale>
        <TextInput
          value={national}
          onChangeText={(text) => {
            const n = digitsOnly(text).slice(0, 15);
            setNational(n);
            emit(iso, n);
          }}
          placeholder="Phone number"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoComplete="tel"
          style={styles.input}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Country code</Text>
            <FlatList
              data={DIAL_CODES}
              keyExtractor={(item) => item.iso + item.dial}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }: { item: DialCode }) => (
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => {
                    setIso(item.iso);
                    setPickerOpen(false);
                    emit(item.iso, national);
                  }}
                >
                  <Text style={styles.sheetName}>
                    {item.name} ({item.iso})
                  </Text>
                  <Text style={styles.sheetDial}>{item.dial}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.inkSoft,
    marginBottom: 6,
  },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  dialBtn: {
    height: 44,
    minWidth: 76,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dialText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  input: {
    flex: 1,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#fff",
  },
  error: { marginTop: 6, fontSize: 12, color: colors.danger },
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(42, 36, 28, 0.35)",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sheetName: { fontSize: 15, color: colors.ink },
  sheetDial: { fontSize: 15, fontWeight: "600", color: colors.inkSoft },
});
