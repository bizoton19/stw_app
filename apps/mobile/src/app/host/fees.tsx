import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { t } from "@/lib/i18n";
import { centsToLabel } from "@/lib/money";
import { colors } from "@/lib/theme";

export default function HostFees() {
  const router = useRouter();
  const draft = useHostDraft();
  const itemSubtotal = draft.items
    .filter((i) => !i.removed)
    .reduce((s, i) => s + i.totalCents, 0);
  const feeTotal = draft.fees.reduce((s, f) => s + f.amountCents, 0);

  return (
    <AppShell>
      <InterviewChrome
        step={7}
        total={9}
        kicker={t("fees.kicker")}
        title={t("fees.title")}
        onBack={() => router.back()}
        keyboard
        dense
        footer={
          <View>
            <Text style={styles.footBreak}>
              Items {centsToLabel(itemSubtotal)}
              {"  ·  "}
              Fees {centsToLabel(feeTotal)}
            </Text>
            <Text style={styles.footNote}>
              {t("fees.grand", { amount: centsToLabel(itemSubtotal + feeTotal) })}
            </Text>
            <PrimaryButton onPress={() => router.push("/host/pay")}>
              {t("fees.continue")}
            </PrimaryButton>
          </View>
        }
      >
        <Text style={styles.lead}>{t("fees.lead")}</Text>
        {draft.fees.map((fee) => (
          <View key={fee.id} style={styles.row}>
            <View style={styles.nameCol}>
              <Text style={styles.colLabel}>{t("fees.nameLabel")}</Text>
              <TextInput
                value={fee.name}
                placeholder={t("fees.feeName")}
                placeholderTextColor={colors.muted}
                style={styles.nameInput}
                autoCorrect={false}
                onChangeText={(name) =>
                  draft.setFees(draft.fees.map((row) => (row.id === fee.id ? { ...row, name } : row)))
                }
              />
            </View>
            <View style={styles.amtCol}>
              <Text style={styles.colLabel}>{t("fees.amt")}</Text>
              <TextInput
                value={fee.amountInput}
                keyboardType="decimal-pad"
                style={styles.numInput}
                accessibilityLabel={t("fees.amt")}
                onChangeText={(amountInput) => {
                  const amountCents = Math.round((Number(amountInput) || 0) * 100);
                  draft.setFees(
                    draft.fees.map((row) =>
                      row.id === fee.id ? { ...row, amountInput, amountCents } : row,
                    ),
                  );
                }}
              />
            </View>
            <PressScale
              accessibilityLabel={t("fees.remove", {
                name: fee.name.trim() || t("fees.fee"),
              })}
              onPress={() => draft.setFees(draft.fees.filter((row) => row.id !== fee.id))}
              style={styles.trash}
            >
              <Trash2 size={13} color={colors.inkSoft} />
            </PressScale>
          </View>
        ))}
        <QuietButton
          onPress={() =>
            draft.setFees([
              ...draft.fees,
              {
                id: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                name: "",
                amountCents: 0,
                amountInput: "0.00",
              },
            ])
          }
        >
          {t("fees.add")}
        </QuietButton>
      </InterviewChrome>
    </AppShell>
  );
}

const INPUT_H = 30;

const styles = StyleSheet.create({
  lead: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  nameCol: { flex: 1, minWidth: 0 },
  amtCol: { width: 64 },
  colLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.inkSoft,
    letterSpacing: 0.15,
    marginBottom: 2,
    textAlign: "left",
  },
  nameInput: {
    height: INPUT_H,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "left",
  },
  numInput: {
    height: INPUT_H,
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    textAlign: "left",
  },
  trash: {
    width: 28,
    height: INPUT_H,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -2,
  },
  footBreak: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkSoft,
    marginBottom: 4,
    fontVariant: ["tabular-nums"],
  },
  footNote: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 10,
    fontVariant: ["tabular-nums"],
  },
});
