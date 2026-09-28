import { useMemo, useState } from "react";
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
  type DialCode,
  type GuestContactKind,
  validateOptionalGuestContact,
} from "@/lib/contact";
import { colors, space } from "@/lib/theme";

export type ContactFieldValue = {
  kind: GuestContactKind;
  email: string;
  phoneNational: string;
  dialIso: string;
};

export function emptyContactField(): ContactFieldValue {
  return { kind: "", email: "", phoneNational: "", dialIso: DEFAULT_DIAL.iso };
}

export function parseContactField(stored: string): ContactFieldValue {
  const v = stored.trim();
  if (!v) return emptyContactField();
  if (v.includes("@")) {
    return { kind: "email", email: v, phoneNational: "", dialIso: DEFAULT_DIAL.iso };
  }
  if (v.startsWith("+")) {
    const digits = digitsOnly(v);
    const sorted = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
    for (const code of sorted) {
      const prefix = digitsOnly(code.dial);
      if (digits.startsWith(prefix)) {
        return {
          kind: "phone",
          email: "",
          phoneNational: digits.slice(prefix.length),
          dialIso: code.iso,
        };
      }
    }
  }
  return { kind: "phone", email: "", phoneNational: digitsOnly(v), dialIso: DEFAULT_DIAL.iso };
}

export function GuestContactField({
  value,
  onChange,
  error,
}: {
  value: ContactFieldValue;
  onChange: (next: ContactFieldValue) => void;
  error?: string | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const dial = useMemo(() => findDialByIso(value.dialIso), [value.dialIso]);

  function setKind(kind: GuestContactKind) {
    onChange({ ...value, kind });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Contact <Text style={styles.hint}>(optional)</Text>
      </Text>
      <View style={styles.kindRow}>
        <KindChip label="None" active={value.kind === ""} onPress={() => setKind("")} />
        <KindChip label="Email" active={value.kind === "email"} onPress={() => setKind("email")} />
        <KindChip label="Phone" active={value.kind === "phone"} onPress={() => setKind("phone")} />
      </View>

      {value.kind === "email" ? (
        <TextInput
          value={value.email}
          onChangeText={(email) => onChange({ ...value, email })}
          placeholder="alex@email.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          style={styles.input}
        />
      ) : null}

      {value.kind === "phone" ? (
        <View style={styles.phoneRow}>
          <PressScale
            onPress={() => setPickerOpen(true)}
            style={styles.dialBtn}
            accessibilityLabel="Country code"
          >
            <Text style={styles.dialText}>{dial.dial}</Text>
            <ChevronDown size={14} color={colors.inkSoft} />
          </PressScale>
          <TextInput
            value={value.phoneNational}
            onChangeText={(phoneNational) =>
              onChange({ ...value, phoneNational: digitsOnly(phoneNational).slice(0, 15) })
            }
            placeholder="Phone number"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            style={[styles.input, styles.phoneInput]}
          />
        </View>
      ) : null}

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
                    onChange({ ...value, dialIso: item.iso });
                    setPickerOpen(false);
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

export function resolveGuestContact(
  value: ContactFieldValue,
): { ok: true; contact: string } | { ok: false; message: string } {
  return validateOptionalGuestContact({
    kind: value.kind,
    email: value.email,
    phoneNational: value.phoneNational,
    dialIso: value.dialIso,
  });
}

function KindChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      style={[styles.chip, active ? styles.chipOn : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active ? styles.chipTextOn : null]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: space.sm,
  },
  hint: { fontWeight: "400", color: colors.muted },
  kindRow: { flexDirection: "row", gap: 8, marginBottom: space.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  chipOn: {
    borderColor: colors.merlot,
    backgroundColor: "rgba(110, 46, 53, 0.08)",
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  chipTextOn: { color: colors.merlot },
  input: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#fff",
  },
  phoneRow: { flexDirection: "row", gap: 8, alignItems: "center" },
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
  phoneInput: { flex: 1 },
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
