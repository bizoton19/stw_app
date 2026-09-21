import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { centsToLabel } from "@/lib/money";
import { colors } from "@/lib/theme";

export default function HostFees() {
  const router = useRouter();
  const draft = useHostDraft();
  const itemSubtotal = draft.items.reduce((s, i) => s + i.totalCents, 0);
  const feeTotal = draft.fees.reduce((s, f) => s + f.amountCents, 0);

  return (
    <AppShell>
      <InterviewChrome
        step={6}
        total={8}
        kicker="Tax & tip"
        title="These follow what people ordered."
        onBack={() => router.back()}
        keyboard
        footer={
          <View>
            <Text style={styles.footNote}>Grand {centsToLabel(itemSubtotal + feeTotal)}</Text>
            <PrimaryButton onPress={() => router.push("/host/pay")}>Continue</PrimaryButton>
          </View>
        }
      >
        <Text style={styles.lead}>Admin, gratuity, tax — never an even split by headcount.</Text>
        {draft.fees.map((fee) => (
          <View key={fee.id} style={styles.row}>
            <View style={{ alignItems: "flex-end" }}>
              <PressScale
                accessibilityLabel={`Remove ${fee.name || "fee"}`}
                onPress={() => draft.setFees(draft.fees.filter((row) => row.id !== fee.id))}
                style={styles.trash}
              >
                <Trash2 size={16} color={colors.ink} />
              </PressScale>
            </View>
            <Field
              value={fee.name}
              placeholder="Fee name"
              onChangeText={(name) =>
                draft.setFees(draft.fees.map((row) => (row.id === fee.id ? { ...row, name } : row)))
              }
            />
            <Field
              value={fee.amountInput}
              keyboardType="decimal-pad"
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
          Add a fee
        </QuietButton>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  row: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  trash: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  footNote: {
    textAlign: "center",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
});
