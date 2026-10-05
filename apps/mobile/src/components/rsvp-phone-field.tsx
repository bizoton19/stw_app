import { StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  CALLING_COUNTRIES,
  countryById,
  nationalPlaceholder,
} from "@/lib/phone-e164";
import { colors } from "@/lib/theme";

export function RsvpPhoneField({
  countryId,
  nationalNumber,
  onCountryId,
  onNationalNumber,
}: {
  countryId: string;
  nationalNumber: string;
  onCountryId: (id: string) => void;
  onNationalNumber: (value: string) => void;
}) {
  const country = countryById(countryId);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Phone</Text>
      <View style={styles.row}>
        <View style={styles.country}>
          <Text style={styles.countryText} importantForAccessibility="no">
            {country.abbr} {country.callingCode}
          </Text>
          <Picker
            selectedValue={countryId}
            onValueChange={onCountryId}
            mode="dropdown"
            accessibilityLabel="Country"
            style={styles.picker}
            dropdownIconColor="transparent"
          >
            {CALLING_COUNTRIES.map((row) => (
              <Picker.Item
                key={row.id}
                label={`${row.name} ${row.callingCode}`}
                value={row.id}
                color={colors.ink}
              />
            ))}
          </Picker>
        </View>
        <TextInput
          value={nationalNumber}
          onChangeText={onNationalNumber}
          placeholder={nationalPlaceholder(countryId)}
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoCorrect={false}
          style={styles.national}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  country: {
    height: 48,
    width: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "transparent",
    justifyContent: "center",
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  countryText: { fontSize: 16, color: colors.ink },
  picker: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
  },
  national: {
    flex: 1,
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
