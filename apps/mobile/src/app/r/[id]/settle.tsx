import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Banknote } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { HostSupportTip } from "@/components/host-support-tip";
import { IconActionButton } from "@/components/icon-action-button";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { ReceiptImageButton } from "@/components/receipt-image-viewer";
import { LineKindIcon } from "@/components/line-kind-icon";
import { useClaimFlow } from "@/context/claim-flow";
import { publicClaimUrl } from "@/lib/config";
import { registerHostClaimPush } from "@/lib/host-push";
import { hostPayments } from "@/lib/host-pay";
import { centsToLabel } from "@/lib/money";
import { claimMoneySlice } from "@/lib/pour";
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!flow.isHost || !receipt?.id || receipt.status === "finalized") return;
    void registerHostClaimPush(receipt.id);
  }, [flow.isHost, receipt?.id, receipt?.status]);

  if (!receipt || !totals) {
    return (
      <AppShell>
        <Text style={{ textAlign: "center", marginTop: 80, color: colors.muted }}>
          Opening totals…
        </Text>
      </AppShell>
    );
  }

  const receiptId = receipt.id;
  const claimUrl = publicClaimUrl(receiptId);
  const closed = receipt.status === "finalized";
  const leftover = totals.unclaimedItemCents > 0 && !closed;
  const remainingLines = receipt.items.filter((item) => (receipt.remaining[item.id] ?? 0) > 0);
  const remainingUnits = remainingLines.reduce(
    (sum, item) => sum + (receipt.remaining[item.id] ?? 0),
    0,
  );
  const mine = flow.guest
    ? totals.people.find((p) => p.personName === flow.guest?.name)
    : undefined;
  const restaurant = receipt.restaurant || "the check";
  const place = receipt.restaurant?.trim() || "Tonight’s check";
  const hostName =
    flow.isHost && flow.guest?.name.trim() ? flow.guest.name.trim() : "the host";
  const claimParams = flow.isHost
    ? ({ id: receiptId, host: "1" } as const)
    : ({ id: receiptId } as const);

  async function copyLink() {
    await Clipboard.setStringAsync(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareLink() {
    try {
      await Share.share({
        message: `Claim what you ordered on ${place}: ${claimUrl}`,
        url: claimUrl,
      });
    } catch {
      await copyLink();
    }
  }

  async function payWith(payment: HostPayment, amountCents: number) {
    if (!payMethodIsOpenable(payment.method)) return;
    Alert.alert(
      "Leaving Split the Wine",
      "You are now leaving Split the Wine to open your payment app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            void (async () => {
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
            })();
          },
        },
      ],
    );
  }

  const footer = flow.isHost ? (
    <View>
      <PrimaryButton onPress={() => router.replace("/")}>Back to host desk</PrimaryButton>
      <QuietButton
        onPress={() => router.replace({ pathname: "/r/[id]", params: claimParams })}
      >
        Claim my drinks
      </QuietButton>
      {!closed ? (
        <QuietButton
          disabled={flow.busy}
          onPress={() => void flow.closeOut()}
        >
          Close claiming — leftovers on me
        </QuietButton>
      ) : (
        <QuietButton
          disabled={flow.busy}
          onPress={() => void flow.reopen()}
        >
          Reopen claiming
        </QuietButton>
      )}
      {closed ? (
        <QuietButton
          disabled={flow.busy}
          onPress={() => {
            Alert.alert(
              "Delete closed tab?",
              "This permanently deletes the tab. Claim links will stop working.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    void flow.deleteClosed().then((ok) => {
                      if (ok) router.replace("/");
                    });
                  },
                },
              ],
            );
          }}
        >
          Delete tab
        </QuietButton>
      ) : null}
      <HostSupportTip />
    </View>
  ) : (
    <View>
      <PrimaryButton
        onPress={() => router.replace({ pathname: "/r/[id]", params: claimParams })}
      >
        Back to the claim board
      </PrimaryButton>
    </View>
  );

  return (
    <AppShell>
      <InterviewChrome
        step={3}
        total={3}
        kicker={receipt.restaurant || "The check"}
        title={flow.isHost ? "Live board" : "Settle Payment"}
        onBack={
          flow.isHost
            ? () => router.replace("/")
            : () =>
                router.replace({
                  pathname: "/r/[id]",
                  params: claimParams,
                })
        }
        footer={footer}
      >
        <Text style={styles.lead}>
          {flow.isHost
            ? "Guests claim on their phones. Watch balances fill in here — tax and tip follow what people ordered."
            : "Drinks plus a share of tax and tip. Tapping a payment method opens the host's app when possible — nothing is charged from Split the Wine."}
        </Text>
        <ReceiptImageButton receiptId={receiptId} hasImage={receipt.hasImage} />
        {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}

        {flow.isHost && !closed ? (
          <View style={styles.shareCard}>
            <Text style={styles.shareLabel}>Claim link</Text>
            <Text selectable style={styles.shareUrl} numberOfLines={2}>
              {claimUrl}
            </Text>
            <View style={styles.shareRow}>
              <View style={{ flex: 1 }}>
                <IconActionButton
                  icon="copy"
                  label={copied ? "Copied" : "Copy"}
                  onPress={() => void copyLink()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <IconActionButton
                  icon="share"
                  label="Share again"
                  onPress={() => void shareLink()}
                />
              </View>
            </View>
          </View>
        ) : null}

        {flow.isHost ? (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, closed && { color: colors.inkSoft }]}>
                {closed ? "Claiming closed" : "Open for claims"}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Guests claimed</Text>
              <Text style={styles.statusValue}>{totals.people.length}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Still unclaimed</Text>
              <Text
                style={[
                  styles.statusValue,
                  leftover ? { color: colors.merlot } : null,
                ]}
              >
                {leftover
                  ? `${centsToLabel(totals.unclaimedItemCents)} still on the table · ${remainingUnits} left`
                  : closed
                    ? "None — assigned"
                    : "All claimed"}
              </Text>
            </View>
          </View>
        ) : leftover ? (
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
          <FeesRow value={centsToLabel(totals.feeTotalCents)} />
          <Row label="Grand Total" value={centsToLabel(totals.grandTotalCents)} strong />
        </View>

        {!flow.isHost && mine && mine.totalCents > 0 ? (
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

        {flow.isHost && leftover && remainingLines.length > 0 ? (
          <View style={styles.remainBlock}>
            <Text style={styles.peopleTitle}>Still on the table</Text>
            {remainingLines.map((item) => {
              const left = receipt.remaining[item.id] ?? 0;
              const money = claimMoneySlice(item, left);
              return (
              <View key={item.id} style={styles.remainRow}>
                <View style={styles.remainNameRow}>
                  <LineKindIcon name={item.name} kind={item.kind} size={12} />
                  <Text style={styles.remainName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text style={styles.remainLeft}>
                  {centsToLabel(money.unitCents)} × {left}
                  {money.glasses ? (left === 1 ? " glass" : " glasses") : ""} ·{" "}
                  {centsToLabel(money.remainingCents)}
                </Text>
              </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.peopleHead}>
          <Banknote size={14} color={colors.muted} strokeWidth={2} />
          <Text style={styles.peopleTitle}>
            {flow.isHost ? "Who owes what" : "Everyone’s share"}
          </Text>
        </View>
        {totals.people.length === 0 ? (
          <Text style={[styles.muted, { textAlign: "center", paddingVertical: 32 }]}>
            {flow.isHost
              ? "Nobody has claimed yet. Share the claim link and watch this fill in."
              : "Nobody has claimed yet."}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.personCards}
            style={styles.personScroller}
          >
            {totals.people.map((person) => {
              const amount = centsToLabel(person.totalCents);
              const isYou = flow.guest?.name === person.personName;
              return (
                <View
                  key={`${person.personName}\0${person.personContact ?? ""}`}
                  style={styles.personCard}
                >
                  <View style={styles.personCardHead}>
                    <ClaimerAvatar name={person.personName} size={34} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {person.personName}
                        {isYou ? " (you)" : ""}
                      </Text>
                      <Text style={styles.personContact} numberOfLines={1}>
                        {person.personContact || "no contact"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.amount}>{amount}</Text>
                  <View style={styles.personLines}>
                    {person.lines.map((line) => (
                      <Text key={line.itemId} style={styles.personLine} numberOfLines={2}>
                        {line.units}× {line.itemName}
                      </Text>
                    ))}
                    <Text style={styles.personLine}>
                      Tax & tip · {centsToLabel(person.feeCents)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {flow.isHost && payments.length > 0 ? (
          <View style={styles.payHostNote}>
            <Text style={styles.peopleTitle}>Your pay handles</Text>
            {payments.map((payment) => (
              <Text key={payment.method} style={styles.muted}>
                {PAY_METHOD_META[payment.method].label} · {payment.handle}
              </Text>
            ))}
          </View>
        ) : null}
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

function FeesRow({ value }: { value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>
        Fees{" "}
        <Text style={styles.feesHint}>(taxes, tips, etc)</Text>
      </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 12 },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  feesHint: { fontWeight: "700", color: colors.ink },
  err: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  shareCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    gap: 8,
  },
  shareLabel: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, letterSpacing: 0.2 },
  shareUrl: { fontFamily: "monospace", fontSize: 13, lineHeight: 18, color: colors.ink },
  shareRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statusCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
    gap: 10,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  statusLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  statusValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
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
  remainBlock: { marginBottom: 20, gap: 8 },
  remainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  remainNameRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  remainName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  remainLeft: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.merlot,
    fontVariant: ["tabular-nums"],
  },
  peopleHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  peopleTitle: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 },
  personScroller: { marginHorizontal: -20, marginBottom: 16 },
  personCards: { paddingHorizontal: 20, gap: 10 },
  personCard: {
    width: 196,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
    gap: 10,
  },
  personCardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  personContact: { marginTop: 2, fontSize: 12, color: colors.muted },
  personLines: { gap: 4 },
  personLine: { fontSize: 12, lineHeight: 17, color: colors.inkSoft, fontWeight: "500" },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  amount: { fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"], color: colors.ink },
  payHostNote: { marginTop: 8, marginBottom: 16, gap: 4 },
});
