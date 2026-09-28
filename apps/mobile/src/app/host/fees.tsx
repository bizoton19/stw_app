import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
import { Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { AssistantEntry } from "@/components/assistant-entry";
import { HostAgentSheet } from "@/components/host-agent-sheet";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import type { AgentCard } from "@/lib/agent-api";
import { t } from "@/lib/i18n";
import { centsToLabel } from "@/lib/money";
import { getHostToken } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function HostFees() {
  const router = useRouter();
  const draft = useHostDraft();
  const [agentOpen, setAgentOpen] = useState(false);
  const itemSubtotal = draft.items
    .filter((i) => !i.removed)
    .reduce((s, i) => s + i.totalCents, 0);
  const feeTotal = draft.fees.reduce((s, f) => s + f.amountCents, 0);

  const agentSnapshot = useMemo(
    () => ({
      restaurant: draft.restaurant,
      items: draft.items
        .filter((i) => !i.removed)
        .map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          totalCents: i.totalCents,
          kind: i.kind ?? null,
          pour: i.pour ?? null,
        })),
      fees: draft.fees.map((f) => ({
        id: f.id,
        name: f.name,
        amountCents: f.amountCents,
      })),
    }),
    [draft.fees, draft.items, draft.restaurant],
  );

  function applyAgentCards(cards: AgentCard[]) {
    for (const card of cards) {
      if (card.kind !== "set_tip") continue;
      const amountCents = Math.max(0, Math.floor(Number(card.payload.amountCents) || 0));
      const name =
        typeof card.payload.name === "string" && card.payload.name.trim()
          ? card.payload.name.trim()
          : "Tip";
      const amountInput = (amountCents / 100).toFixed(2);
      draft.setFees((prev) => {
        const tipIdx = prev.findIndex((f) => /\b(tip|gratuity)\b/i.test(f.name));
        if (tipIdx >= 0) {
          return prev.map((f, i) =>
            i === tipIdx ? { ...f, name, amountCents, amountInput } : f,
          );
        }
        return [
          ...prev,
          {
            id: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            amountCents,
            amountInput,
          },
        ];
      });
    }
  }

  return (
    <AppShell>
      <InterviewChrome
        step={6}
        total={8}
        kicker={t("fees.kicker")}
        title={t("fees.title")}
        onBack={() => router.back()}
        onHome={goHostDesk}
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
        supportTip
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
        {draft.receiptId ? (
          <AssistantEntry onPress={() => setAgentOpen(true)} />
        ) : null}
      </InterviewChrome>
      {draft.receiptId ? (
        <HostAgentSheet
          visible={agentOpen}
          onClose={() => setAgentOpen(false)}
          receiptId={draft.receiptId}
          hostToken={getHostToken(draft.receiptId)}
          snapshot={agentSnapshot}
          onApplyCards={applyAgentCards}
        />
      ) : null}
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
