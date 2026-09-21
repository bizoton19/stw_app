import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { useClaimFlow } from "@/context/claim-flow";
import { centsToLabel } from "@/lib/money";
import { computeTotals } from "@/lib/totals";
import type { PayMethod } from "@/lib/types";
import { colors } from "@/lib/theme";

const METHOD_LABEL: Record<PayMethod, string> = {
  venmo: "Venmo",
  zelle: "Zelle",
  cashapp: "Cash App",
  other: "their preferred app",
};

function messageFor(name: string, amount: string, handle: string, method: PayMethod) {
  return `Hey ${name}, your share is ${amount}. Send it to ${handle} via ${METHOD_LABEL[method]}.`;
}

export default function SettleScreen() {
  const router = useRouter();
  const flow = useClaimFlow();
  const receipt = flow.receipt;
  const totals = useMemo(() => (receipt ? computeTotals(receipt) : null), [receipt]);
  const [copied, setCopied] = useState<string | null>(null);

  if (!receipt || !totals) {
    return (
      <AppShell>
        <Text style={{ textAlign: "center", marginTop: 80, color: colors.muted }}>
          Opening totals…
        </Text>
      </AppShell>
    );
  }

  const handle = receipt.hostInfo?.handle ?? "the host";
  const method = receipt.hostInfo?.method ?? "other";
  const leftover = totals.unclaimedItemCents > 0 && receipt.status !== "finalized";

  return (
    <AppShell>
      <InterviewChrome
        step={flow.isHost ? 2 : 3}
        total={flow.isHost ? 2 : 3}
        kicker={receipt.restaurant || "The check"}
        title="Who owes what"
        onBack={() => router.back()}
        footer={
          <PrimaryButton
            onPress={() => router.replace({ pathname: "/r/[id]", params: { id: receipt.id } })}
          >
            Back to the claim board
          </PrimaryButton>
        }
      >
        <Text style={styles.lead}>
          Drinks plus a share of tax and tip. These messages are requests — nothing is auto-sent.
        </Text>
        {leftover ? (
          <Text style={styles.muted}>
            {centsToLabel(totals.unclaimedItemCents)} still unclaimed. The host can close claiming
            to take leftovers.
          </Text>
        ) : null}
        <View style={styles.totals}>
          <Row label="Items" value={centsToLabel(totals.itemSubtotalCents)} />
          <Row label="Fees" value={centsToLabel(totals.feeTotalCents)} />
          <Row label="Grand" value={centsToLabel(totals.grandTotalCents)} strong />
        </View>
        {totals.people.length === 0 ? (
          <Text style={[styles.muted, { textAlign: "center", paddingVertical: 32 }]}>
            Nobody has claimed yet.
          </Text>
        ) : (
          totals.people.map((person) => {
            const amount = centsToLabel(person.totalCents);
            const text = messageFor(person.personName, amount, handle, method);
            return (
              <View key={person.personName} style={styles.person}>
                <View style={styles.personHead}>
                  <View>
                    <Text style={styles.name}>{person.personName}</Text>
                    <Text style={styles.muted}>{person.personContact || "no contact"}</Text>
                  </View>
                  <Text style={styles.amount}>{amount}</Text>
                </View>
                {person.lines.map((line) => (
                  <Text key={line.itemName} style={styles.muted}>
                    {line.units}× {line.itemName} · {centsToLabel(line.cents)}
                  </Text>
                ))}
                <Text style={styles.muted}>Share of tax & tip · {centsToLabel(person.feeCents)}</Text>
                <Text style={[styles.muted, { marginTop: 8 }]}>{text}</Text>
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      onPress={() =>
                        void Linking.openURL(`sms:?&body=${encodeURIComponent(text)}`)
                      }
                    >
                      Texts
                    </PrimaryButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <QuietButton
                      onPress={() =>
                        void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`)
                      }
                    >
                      WhatsApp
                    </QuietButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <QuietButton
                      onPress={async () => {
                        await Clipboard.setStringAsync(text);
                        setCopied(person.personName);
                      }}
                    >
                      {copied === person.personName ? "Copied" : "Copy"}
                    </QuietButton>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </InterviewChrome>
    </AppShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.muted, strong && { color: colors.ink, fontWeight: "600" }]}>{label}</Text>
      <Text style={[styles.value, strong && { fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 12 },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  totals: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 4,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  value: { fontVariant: ["tabular-nums"], fontSize: 14, color: colors.ink },
  person: { marginBottom: 28 },
  personHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  amount: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: 4, marginTop: 12 },
});
