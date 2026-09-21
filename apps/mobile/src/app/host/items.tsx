import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
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
        kicker="The drinks"
        title="Does this look right?"
        onBack={() => router.back()}
        keyboard
        footer={
          <View>
            <Text style={styles.footNote}>Items {centsToLabel(subtotal)}</Text>
            <PrimaryButton
              disabled={
                draft.items.length === 0 || draft.items.some((i) => !i.name.trim() || i.qty < 1)
              }
              onPress={() => router.push("/host/fees")}
            >
              Looks good
            </PrimaryButton>
          </View>
        }
      >
        <Text style={styles.lead}>
          {draft.items.length === 0
            ? "Nothing came through. Add what was on the check."
            : "Fix misreads. Quantities stay whole numbers."}
        </Text>
        {draft.items.map((item, index) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.line}>Line {index + 1}</Text>
              <PressScale
                accessibilityLabel={`Remove ${item.name || "line"}`}
                onPress={() => draft.setItems(draft.items.filter((row) => row.id !== item.id))}
                style={styles.trash}
              >
                <Trash2 size={16} color={colors.ink} />
              </PressScale>
            </View>
            <Field
              value={item.name}
              placeholder="Item name"
              onChangeText={(name) =>
                draft.setItems(draft.items.map((row) => (row.id === item.id ? { ...row, name } : row)))
              }
            />
            <View style={styles.grid}>
              <View style={{ flex: 1 }}>
                <Field
                  value={String(item.qty)}
                  keyboardType="number-pad"
                  onChangeText={(raw) => {
                    const qty = Math.max(1, Math.floor(Number(raw) || 0));
                    draft.setItems(
                      draft.items.map((row) => (row.id === item.id ? { ...row, qty } : row)),
                    );
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  value={item.totalInput}
                  keyboardType="decimal-pad"
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
          Add a line
        </QuietButton>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  row: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  line: { fontSize: 12, color: colors.muted },
  trash: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", gap: 8 },
  footNote: {
    textAlign: "center",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
});
