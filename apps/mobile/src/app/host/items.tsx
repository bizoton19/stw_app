import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { t } from "@/lib/i18n";
import { centsToLabel } from "@/lib/money";
import { colors } from "@/lib/theme";

export default function HostItems() {
  const router = useRouter();
  const draft = useHostDraft();
  const subtotal = draft.items.reduce((s, i) => s + i.totalCents, 0);

  return (
    <AppShell>
      <InterviewChrome
        step={5}
        total={8}
        kicker={t("items.kicker")}
        title={t("items.title")}
        onBack={() => router.back()}
        keyboard
        dense
        footer={
          <View>
            <Text style={styles.footNote}>
              {t("items.subtotal", { amount: centsToLabel(subtotal) })}
            </Text>
            <PrimaryButton
              disabled={
                draft.items.length === 0 || draft.items.some((i) => !i.name.trim() || i.qty < 1)
              }
              onPress={() => router.push("/host/fees")}
            >
              {t("items.looksGood")}
            </PrimaryButton>
          </View>
        }
      >
        {draft.items.length === 0 ? <Text style={styles.lead}>{t("items.empty")}</Text> : null}
        {draft.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.nameRow}>
              <TextInput
                value={item.name}
                placeholder={t("items.itemName")}
                placeholderTextColor={colors.muted}
                style={styles.nameInput}
                autoCorrect={false}
                onChangeText={(name) =>
                  draft.setItems(
                    draft.items.map((row) => (row.id === item.id ? { ...row, name } : row)),
                  )
                }
              />
              <PressScale
                accessibilityLabel={t("items.remove", {
                  name: item.name.trim() || t("items.line"),
                })}
                onPress={() => draft.setItems(draft.items.filter((row) => row.id !== item.id))}
                style={styles.trash}
              >
                <Trash2 size={15} color={colors.inkSoft} />
              </PressScale>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaField}>
                <Text style={styles.metaLabel}>{t("items.qty")}</Text>
                <TextInput
                  value={String(item.qty)}
                  keyboardType="number-pad"
                  style={styles.metaValue}
                  accessibilityLabel={t("items.qty")}
                  onChangeText={(raw) => {
                    const qty = Math.max(1, Math.floor(Number(raw) || 0));
                    draft.setItems(
                      draft.items.map((row) => (row.id === item.id ? { ...row, qty } : row)),
                    );
                  }}
                />
              </View>
              <View style={[styles.metaField, styles.metaFieldAmt]}>
                <Text style={styles.metaLabel}>{t("items.amt")}</Text>
                <TextInput
                  value={item.totalInput}
                  keyboardType="decimal-pad"
                  style={styles.metaValue}
                  accessibilityLabel={t("items.amt")}
                  onChangeText={(totalInput) => {
                    const totalCents = Math.round((Number(totalInput) || 0) * 100);
                    draft.setItems(
                      draft.items.map((row) =>
                        row.id === item.id ? { ...row, totalInput, totalCents } : row,
                      ),
                    );
                  }}
                />
              </View>
            </View>
          </View>
        ))}
        <QuietButton
          onPress={() =>
            draft.setItems([
              ...draft.items,
              {
                id: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                name: "",
                qty: 1,
                totalCents: 0,
                totalInput: "0.00",
              },
            ])
          }
        >
          {t("items.addLine")}
        </QuietButton>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  row: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 6,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  nameInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  trash: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 2 },
  metaField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 72,
  },
  metaFieldAmt: { flex: 1 },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.inkSoft,
    letterSpacing: 0.2,
  },
  metaValue: {
    flexGrow: 0,
    minWidth: 44,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  footNote: {
    textAlign: "center",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
});
