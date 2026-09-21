import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Banknote } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { useClaimFlow } from "@/context/claim-flow";
import { hostPayments, primaryHostPayment } from "@/lib/host-pay";
import { centsToLabel } from "@/lib/money";
import { openHostPay, PAY_METHOD_META } from "@/lib/pay";
import { computeTotals } from "@/lib/totals";
import type { HostPayment, PayMethod } from "@/lib/types";
import { colors } from "@/lib/theme";

function messageFor(name: string, amount: string, payment: HostPayment) {
  return `Hey ${name}, your share is ${amount}. Send it to ${payment.handle} via ${PAY_METHOD_META[payment.method].label}.`;
}

export default function SettleScreen() {
  const router = useRouter();
  const flow = useClaimFlow();
  const receipt = flow.receipt;
  const totals = useMemo(() => (receipt ? computeTotals(receipt) : null), [receipt]);
  const payments = hostPayments(receipt?.hostInfo);
  const [payWith, setPayWith] = useState<PayMethod | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const selected =
    payments.find((p) => p.method === payWith) ?? primaryHostPayment(receipt?.hostInfo);

  if (!receipt || !totals) {
    return (
      <AppShell>
        <Text style={{ textAlign: "center", marginTop: 80, color: colors.muted }}>
          Opening totals…
        </Text>
      </AppShell>
    );
  }

  const leftover = totals.unclaimedItemCents > 0 && receipt.status !== "finalized";
  const mine = flow.guest
    ? totals.people.find((p) => p.personName === flow.guest?.name)
    : undefined;
  const restaurant = receipt.restaurant || "the check";
  const fallbackPayment: HostPayment = selected ?? { method: "other", handle: "the host" };

  return (
    <AppShell>
      <InterviewChrome
        step={3}
        total={3}
        kicker={receipt.restaurant || "The check"}
        title="Who owes what"
        onBack={() => router.back()}
        footer={
          <View>
            <PrimaryButton
              onPress={() => router.replace({ pathname: "/r/[id]", params: { id: receipt.id } })}
            >
              Back to the claim board
            </PrimaryButton>
            {flow.isHost && receipt.status === "finalized" ? (
              <QuietButton
                disabled={flow.busy}
                onPress={() =>
                  void flow.reopen().then((ok) => {
                    if (ok) router.replace({ pathname: "/r/[id]", params: { id: receipt.id } });
                  })
                }
              >
                Reopen claiming
              </QuietButton>
            ) : null}
          </View>
        }
      >
        <Text style={styles.lead}>
          Drinks plus a share of tax and tip. Pay opens the host's app when possible — nothing is
          charged from Split the Wine.
        </Text>
        {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}
        {leftover ? (
          <Text style={styles.muted}>
            {centsToLabel(totals.unclaimedItemCents)} still unclaimed. The host can close claiming
            to take leftovers.
          </Text>
        ) : null}
        <View style={styles.totals}>
          <View style={styles.totalsHead}>
            <Banknote size={14} color={colors.muted} strokeWidth={2} />
            <Text style={styles.totalsLabel}>The tab</Text>
          </View>
          <Row label="Items" value={centsToLabel(totals.itemSubtotalCents)} />
          <Row label="Fees" value={centsToLabel(totals.feeTotalCents)} />
          <Row label="Grand" value={centsToLabel(totals.grandTotalCents)} strong />
        </View>

        {mine && mine.totalCents > 0 ? (
          <View style={styles.youCard}>
            <View style={styles.youHead}>
              <View>
                <Text style={styles.youLabel}>You owe</Text>
                <Text style={styles.youAmount}>{centsToLabel(mine.totalCents)}</Text>
              </View>
              <PayMethodIcon method={fallbackPayment.method} size={80} />
            </View>
            {payments.length > 1 ? (
              <View style={styles.chooser}>
                <Text style={styles.muted}>Pay with</Text>
                <View style={styles.chooserRow}>
                  {payments.map((payment) => {
                    const on = payment.method === fallbackPayment.method;
                    return (
                      <PressScale
                        key={payment.method}
                        onPress={() => setPayWith(payment.method)}
                        style={[styles.chooserChip, on && styles.chooserChipOn]}
                      >
                        <PayMethodIcon method={payment.method} size={48} />
                        <Text style={[styles.chooserLabel, on && { color: colors.ink }]}>
                          {PAY_METHOD_META[payment.method].label}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Text style={styles.muted}>
              To {fallbackPayment.handle} on {PAY_METHOD_META[fallbackPayment.method].label}
            </Text>
            <PressScale
              disabled={paying}
              onPress={() => {
                setPaying(true);
                void openHostPay({
                  method: fallbackPayment.method,
                  handle: fallbackPayment.handle,
                  amountCents: mine.totalCents,
                  note: `${flow.guest?.name ?? "Guest"} · ${restaurant}`,
                }).finally(() => setPaying(false));
              }}
              style={styles.payBtn}
            >
              <PayMethodIcon method={fallbackPayment.method} size={44} />
              <Text style={styles.payBtnText}>
                {paying
                  ? "Opening…"
                  : `Pay with ${PAY_METHOD_META[fallbackPayment.method].label}`}
              </Text>
            </PressScale>
          </View>
        ) : null}

        <View style={styles.peopleHead}>
          <Banknote size={14} color={colors.muted} strokeWidth={2} />
          <Text style={styles.peopleTitle}>Everyone’s share</Text>
        </View>
        {totals.people.length === 0 ? (
          <Text style={[styles.muted, { textAlign: "center", paddingVertical: 32 }]}>
            Nobody has claimed yet.
          </Text>
        ) : (
          totals.people.map((person) => {
            const amount = centsToLabel(person.totalCents);
            const text = messageFor(person.personName, amount, fallbackPayment);
            const isYou = flow.guest?.name === person.personName;
            return (
              <View
                key={`${person.personName}\0${person.personContact ?? ""}`}
                style={styles.person}
              >
                <View style={styles.personHead}>
                  <View style={styles.personId}>
                    <ClaimerAvatar name={person.personName} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {person.personName}
                        {isYou ? " (you)" : ""}
                      </Text>
                      <Text style={styles.muted}>{person.personContact || "no contact"}</Text>
                    </View>
                  </View>
                  <Text style={styles.amount}>{amount}</Text>
                </View>
                {person.lines.map((line) => (
                  <Text key={line.itemId} style={styles.muted}>
                    {line.units}× {line.itemName} · {centsToLabel(line.cents)}
                  </Text>
                ))}
                <Text style={styles.muted}>Share of tax & tip · {centsToLabel(person.feeCents)}</Text>
                {!isYou ? (
                  <>
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
                  </>
                ) : null}
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
  err: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  totals: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 4,
  },
  totalsHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  totalsLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  row: { flexDirection: "row", justifyContent: "space-between" },
  value: { fontVariant: ["tabular-nums"], fontSize: 14, color: colors.ink },
  youCard: {
    marginBottom: 24,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#FBFAF8",
    gap: 8,
  },
  youHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  youLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  youAmount: { marginTop: 2, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  chooser: { gap: 6, marginTop: 4 },
  chooserRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chooserChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chooserChipOn: { borderColor: colors.merlot, backgroundColor: "#FFF" },
  chooserLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  payBtn: {
    marginTop: 6,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.merlot,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  payBtnText: { color: colors.merlotFg, fontSize: 15, fontWeight: "700" },
  peopleHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  peopleTitle: { fontSize: 12, fontWeight: "600", color: colors.muted },
  person: { marginBottom: 28 },
  personHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  personId: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  amount: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: 4, marginTop: 12 },
});
