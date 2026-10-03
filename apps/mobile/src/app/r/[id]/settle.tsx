import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { Field } from "@/components/field";
import { HostLiveTabBar } from "@/components/host-live-tab-bar";
import { IconActionButton } from "@/components/icon-action-button";
import { ClaimQrSheet } from "@/components/claim-qr-sheet";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { ReceiptImageButton } from "@/components/receipt-image-viewer";
import { LineKindIcon } from "@/components/line-kind-icon";
import { Motif } from "@/components/motifs";
import { useClaimFlow } from "@/context/claim-flow";
import { api } from "@/lib/api";
import { publicClaimUrl } from "@/lib/config";
import { registerHostClaimPush } from "@/lib/host-push";
import { hostPayments, validateHostPayments } from "@/lib/host-pay";
import { centsToLabel } from "@/lib/money";
import { claimMoneySlice } from "@/lib/pour";
import { openHostPay, PAY_METHOD_META, payMethodIsOpenable } from "@/lib/pay";
import { getHostToken } from "@/lib/session";
import { computeTotals } from "@/lib/totals";
import type { HostPayment, PublicReceipt } from "@/lib/types";
import { goHostDesk } from "@/lib/navigation";
import { colors } from "@/lib/theme";

export default function SettleScreen() {
  const router = useRouter();
  const flow = useClaimFlow();
  const receipt = flow.receipt;
  const totals = useMemo(() => (receipt ? computeTotals(receipt) : null), [receipt]);
  const payments = hostPayments(receipt?.hostInfo);
  const [paying, setPaying] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [showTotalDetails, setShowTotalDetails] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [editingPay, setEditingPay] = useState(false);
  const [payDraft, setPayDraft] = useState<HostPayment[]>([]);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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
  const hostNote = receipt.hostInfo?.note;
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

  function beginEditPay() {
    setPayDraft(payments.map((p) => ({ ...p })));
    setPayError(null);
    setEditingPay(true);
  }

  async function savePayHandles() {
    const checked = validateHostPayments(payDraft);
    if (!checked.ok) {
      setPayError(checked.message);
      return;
    }
    const token = getHostToken(receiptId);
    if (!token) {
      setPayError("Host session missing — reopen this tab from Home.");
      return;
    }
    setPayBusy(true);
    setPayError(null);
    try {
      const note = hostNote;
      await api<{ receipt: PublicReceipt }>(`/api/receipts/${receiptId}/host-info`, {
        method: "PUT",
        hostToken: token,
        body: JSON.stringify({
          payments: checked.payments,
          ...(note ? { note } : {}),
        }),
      });
      await flow.refresh();
      setEditingPay(false);
    } catch (err) {
      setPayError((err as Error).message || "Couldn't save pay handles.");
    } finally {
      setPayBusy(false);
    }
  }

  const footer = flow.isHost ? (
    <HostLiveTabBar
      mode="live"
      onHome={goHostDesk}
      onClaims={() => router.replace({ pathname: "/r/[id]", params: claimParams })}
      onLiveBoard={() => undefined}
      closed={closed}
      busy={flow.busy}
      onClose={() => void flow.closeOut()}
      onReopen={() => void flow.reopen()}
      onDelete={() => {
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
                  if (ok) goHostDesk();
                });
              },
            },
          ],
        );
      }}
    />
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
        hideProgress={flow.isHost}
        kicker={flow.isHost ? receipt.restaurant || "The check" : "Your share"}
        motif={flow.isHost ? "label-band" : "check-stub"}
        title={flow.isHost ? "Live board" : "What you owe"}
        onBack={
          flow.isHost
            ? goHostDesk
            : () =>
                router.replace({
                  pathname: "/r/[id]",
                  params: claimParams,
                })
        }
        footer={footer}
        supportTip={flow.isHost}
        keyboard={editingPay}
      >
        {flow.isHost ? (
          <Text style={styles.lead}>
            Guests claim on their phones. Watch balances fill in here — tax and tip follow what
            people ordered.
          </Text>
        ) : null}
        <ReceiptImageButton receiptId={receiptId} hasImage={receipt.hasImage} />
        {flow.message ? <Text style={styles.err}>{flow.message}</Text> : null}

        {flow.isHost && !closed ? (
          <View style={styles.shareCard}>
            <Text style={styles.shareLabel}>Claim link</Text>
            <Text selectable style={styles.shareUrl} numberOfLines={2}>
              {claimUrl}
            </Text>
            <View style={styles.shareRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <IconActionButton
                  icon="copy"
                  label={copied ? "Copied" : "Copy"}
                  onPress={() => void copyLink()}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <IconActionButton
                  icon="share"
                  label="Share"
                  onPress={() => void shareLink()}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <IconActionButton
                  icon="qr"
                  label="QR"
                  accessibilityLabel="Share QR"
                  onPress={() => setQrOpen(true)}
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
            <Motif name="check-stub" size={14} color={colors.merlot} opacity={0.8} />
            <Text style={styles.totalsLabel}>The tab</Text>
          </View>
          <Row label="Items" value={centsToLabel(totals.itemSubtotalCents)} />
          <FeesRow value={centsToLabel(totals.feeTotalCents)} />
          <Row label="Grand Total" value={centsToLabel(totals.grandTotalCents)} strong />
        </View>

        {!flow.isHost && mine && mine.totalCents > 0 ? (
          <View style={styles.youCard}>
            <View style={styles.youPourMark} pointerEvents="none">
              <Motif name="pour" size={30} color={colors.merlot} opacity={0.26} />
            </View>
            <Text style={styles.youLabel}>You owe</Text>
            <Text style={styles.youAmount}>{centsToLabel(mine.totalCents)}</Text>
            <Text style={styles.youMeta}>
              {mine.lines.length} {mine.lines.length === 1 ? "item" : "items"}
              {" · "}plus your share of tax and tip
            </Text>
            {payments.length > 0 ? (
              <>
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
                <Text style={styles.payFoot}>
                  Tapping a method opens {hostName}'s app — nothing is charged here.
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>The host hasn't added a payment method yet.</Text>
            )}
          </View>
        ) : null}

        {flow.isHost && leftover && remainingLines.length > 0 ? (
          <View style={styles.remainBlock}>
            <View style={styles.detailToggle}>
              <Text style={styles.peopleTitle}>Still on the table</Text>
              <View style={styles.detailToggleRight}>
                <Text style={styles.detailToggleLabel}>Show total details</Text>
                <Switch
                  value={showTotalDetails}
                  onValueChange={setShowTotalDetails}
                  trackColor={{ false: colors.border, true: "rgba(47,93,80,0.45)" }}
                  thumbColor={showTotalDetails ? colors.select : "#f4f3f0"}
                  ios_backgroundColor={colors.border}
                  accessibilityLabel="Show total details"
                />
              </View>
            </View>
            {remainingLines.map((item) => {
              const left = receipt.remaining[item.id] ?? 0;
              const money = claimMoneySlice(item, left);
              return (
                <View key={item.id} style={styles.remainRow}>
                  <View style={styles.remainNameRow}>
                    <LineKindIcon
                      name={item.name}
                      kind={item.kind}
                      pour={item.pour}
                      size={12}
                    />
                    <Text style={styles.remainName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={styles.remainLeft}>
                    {showTotalDetails
                      ? `${centsToLabel(money.unitCents)} × ${left}${
                          money.glasses ? (left === 1 ? " glass" : " glasses") : ""
                        } · ${centsToLabel(money.remainingCents)}`
                      : `${centsToLabel(money.remainingCents)} (${left})`}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.peopleHead}>
          <Motif name="coupe-pair" size={15} color={colors.merlot} opacity={0.8} />
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
              const personKey = `${person.personName}\0${person.personContact ?? ""}`;
              const open = expandedPerson === personKey;
              return (
                <View key={personKey} style={styles.personCard}>
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
                  {open ? (
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
                  ) : null}
                  <PressScale
                    haptic="select"
                    onPress={() => setExpandedPerson(open ? null : personKey)}
                    style={styles.personDetailsBtn}
                    accessibilityLabel={open ? "Hide details" : "Show details"}
                  >
                    <Text style={styles.personDetailsLabel}>
                      {open ? "Hide details" : "Details"}
                    </Text>
                    {open ? (
                      <ChevronUp size={16} color={colors.merlot} strokeWidth={2.25} />
                    ) : (
                      <ChevronDown size={16} color={colors.merlot} strokeWidth={2.25} />
                    )}
                  </PressScale>
                </View>
              );
            })}
          </ScrollView>
        )}

        {flow.isHost && (payments.length > 0 || editingPay) ? (
          <View style={styles.payHostNote}>
            <View style={styles.payHostHead}>
              <Text style={styles.peopleTitle}>Your pay handles</Text>
              {!editingPay ? (
                <PressScale haptic="select" onPress={beginEditPay} accessibilityLabel="Edit pay handles">
                  <Text style={styles.payEditLink}>Edit</Text>
                </PressScale>
              ) : null}
            </View>
            {editingPay ? (
              <View style={{ gap: 8 }}>
                {payDraft.map((payment) => (
                  <View key={payment.method} style={styles.payHandleRow}>
                    <PayMethodIcon method={payment.method} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Field
                        label={PAY_METHOD_META[payment.method].label}
                        value={payment.handle}
                        onChangeText={(handle) => {
                          setPayDraft((prev) =>
                            prev.map((row) =>
                              row.method === payment.method ? { ...row, handle } : row,
                            ),
                          );
                        }}
                        autoCapitalize="none"
                        placeholder={PAY_METHOD_META[payment.method].hint}
                      />
                    </View>
                  </View>
                ))}
                {payError ? <Text style={styles.err}>{payError}</Text> : null}
                <PrimaryButton busy={payBusy} onPress={() => void savePayHandles()}>
                  Save handles
                </PrimaryButton>
                <QuietButton
                  disabled={payBusy}
                  onPress={() => {
                    setEditingPay(false);
                    setPayError(null);
                  }}
                >
                  Cancel
                </QuietButton>
              </View>
            ) : (
              payments.map((payment) => (
                <View key={payment.method} style={styles.payHandleRow}>
                  <PayMethodIcon method={payment.method} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.payHandleLabel}>
                      {PAY_METHOD_META[payment.method].label}
                    </Text>
                    <Text style={styles.payHandleValue} numberOfLines={1}>
                      {payment.handle}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </InterviewChrome>
      <ClaimQrSheet
        visible={qrOpen}
        url={claimUrl}
        place={place}
        onClose={() => setQrOpen(false)}
      />
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
    overflow: "hidden",
    position: "relative",
  },
  youPourMark: { position: "absolute", right: 14, top: 12 },
  youLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
  },
  youAmount: { marginTop: 2, fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"] },
  youMeta: { fontSize: 13, color: colors.inkSoft },
  payFoot: {
    marginTop: 8,
    fontSize: 11.5,
    textAlign: "center",
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
  detailToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },
  detailToggleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  detailToggleLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
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
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 8,
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
  personDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 2,
  },
  personDetailsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.merlot,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  amount: { fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"], color: colors.ink },
  payHostNote: { marginTop: 8, marginBottom: 16, gap: 10 },
  payHostHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  payEditLink: { fontSize: 14, fontWeight: "700", color: colors.merlot },
  payHandleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  payHandleLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  payHandleValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    color: colors.inkSoft,
  },
});
