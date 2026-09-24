import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Banknote } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { useClaimFlow } from "@/context/claim-flow";
import { hostPayments } from "@/lib/host-pay";
import { centsToLabel } from "@/lib/money";
import { openHostPay, PAY_METHOD_META, payMethodIsOpenable } from "@/lib/pay";
import { computeTotals } from "@/lib/totals";
import type { HostPayment } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function SettleScreen() {
  const router = useRouter();
  const flow = useClaimFlow();
  const receipt = flow.receipt;
  const totals = useMemo(() => (receipt ? computeTotals(receipt) : null), [receipt]);
  const payments = hostPayments(receipt?.hostInfo);
  const [paying, setPaying] = useState<string | null>(null);

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
  const hostName =
    flow.isHost && flow.guest?.name.trim() ? flow.guest.name.trim() : "the host";

  async function payWith(payment: HostPayment, amountCents: number) {
    if (!payMethodIsOpenable(payment.method)) return;
    setPaying(payment.method);
    try {
      await openHostPay({
        method: payment.method,
        handle: payment.handle,
        amountCents,
        note: `${flow.guest?.name ?? "Guest"} · ${restaurant}`,
      });
    } finally {
      setPaying(null);
    }
  }

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
          Drinks plus a share of tax and tip. Tapping a payment method opens the host's app when
          possible — nothing is charged from Split the Wine.
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
            <Text style={styles.youLabel}>You owe</Text>
            <Text style={styles.youAmount}>{centsToLabel(mine.totalCents)}</Text>
            {payments.length > 0 ? (
              <>
                <Text style={styles.payIntro}>
                  You can pay your share of {centsToLabel(mine.totalCents)} to the host
                  {hostName !== "the host" ? `, ${hostName},` : ""} via the following payment
                  method{payments.length === 1 ? "" : "s"}:
                </Text>
                <View style={styles.payList}>
                  {payments.map((payment) => {
                    const openable = payMethodIsOpenable(payment.method);
                    const meta = PAY_METHOD_META[payment.method];
                    const body = (
                      <>
                        <PayMethodIcon method={payment.method} size={48} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.payLabel}>{meta.label}</Text>
                          <Text style={styles.muted}>{payment.handle}</Text>
                        </View>
                      </>
                    );
                    if (openable) {
                      return (
                        <PressScale
                          key={payment.method}
                          disabled={paying === payment.method}
                          onPress={() => void payWith(payment, mine.totalCents)}
                          style={styles.payRow}
                        >
                          {body}
                          <Text style={styles.payCta}>
                            {paying === payment.method ? "Opening…" : "Pay"}
                          </Text>
                        </PressScale>
                      );
                    }
                    return (
                      <View key={payment.method} style={styles.payRow}>
                        {body}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.muted}>The host hasn't added a payment method yet.</Text>
            )}
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
    gap: 6,
  },
  youLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  youAmount: { marginTop: 2, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  payIntro: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  payList: { marginTop: 8, gap: 8 },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFF",
  },
  payLabel: { fontSize: 15, fontWeight: "600", color: colors.ink },
  payCta: { fontSize: 12, fontWeight: "700", color: colors.merlot },
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
});
