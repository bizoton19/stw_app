import { Linking, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { validateHostPayments } from "@/lib/host-pay";
import { PAY_METHOD_META, payVerifyUrl } from "@/lib/pay";
import { deviceRegionCode, payMethodsForRegion, payRegionBucket } from "@/lib/pay-region";
import type { PayMethod } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function HostPay() {
  const router = useRouter();
  const draft = useHostDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const methods = useMemo(() => payMethodsForRegion(), []);
  const regionHint = useMemo(() => {
    const region = deviceRegionCode();
    const bucket = payRegionBucket(region);
    if (!region) return null;
    if (bucket === "us") return `Suggested first for ${region}: Venmo, Cash App, Zelle`;
    if (bucket === "eu") return `Suggested first for ${region}: PayPal or bank details (Other)`;
    if (bucket === "latam") return `Suggested first for ${region}: PayPal or Other`;
    if (bucket === "ca") return `Suggested first for ${region}: PayPal`;
    if (bucket === "ht") return `Suggested first for ${region}: MonCash, Natcash`;
    return null;
  }, []);

  const selected = useMemo(
    () => new Set(draft.payments.map((p) => p.method)),
    [draft.payments],
  );

  /** Keep handle fields in catalog order. */
  const handleRows = useMemo(
    () => methods.map((m) => draft.payments.find((p) => p.method === m)).filter(Boolean) as {
      method: PayMethod;
      handle: string;
    }[],
    [draft.payments, methods],
  );

  function toggleMethod(method: PayMethod) {
    setError(null);
    draft.togglePaymentMethod(method);
  }

  function goConfirm() {
    if (draft.payments.length === 0) {
      setError("Tap at least one way people can pay you.");
      return;
    }
    const result = validateHostPayments(draft.payments);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await draft.publish();
      router.push("/host/share");
    } catch {
      setError(
        "Couldn't publish. Check the API URL on the home screen — localhost won't work from a phone.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    const cleaned = validateHostPayments(draft.payments);
    const rows = cleaned.ok ? cleaned.payments : draft.payments;
    return (
      <AppShell>
        <InterviewChrome
          step={8}
          total={9}
          kicker="Getting paid"
          title="Look right?"
          onBack={() => setConfirming(false)}
          footer={
            <View>
              <FooterHint>A quick glance now beats chasing people later.</FooterHint>
              <PrimaryButton busy={busy} onPress={() => void publish()}>
                Looks good — create link
              </PrimaryButton>
              <QuietButton onPress={() => setConfirming(false)}>Edit</QuietButton>
            </View>
          }
        >
          {error ? (
            <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
          ) : null}
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Guests pay exactly what you enter</Text>
            <Text style={styles.noticeBody}>
              Wrong handle or number means the payment won’t reach you — we can’t verify accounts
              live. Double-check each line.
            </Text>
          </View>
          {rows.map((payment) => {
            const verify = payVerifyUrl(payment.method, payment.handle);
            return (
              <View key={payment.method} style={styles.confirmRow}>
                <PayMethodIcon method={payment.method} size={56} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.confirmLabel}>{PAY_METHOD_META[payment.method].label}</Text>
                  <Text style={styles.confirmHandle} selectable>
                    {payment.handle}
                  </Text>
                  {verify ? (
                    <PressScale
                      onPress={() => void Linking.openURL(verify)}
                      style={styles.checkLink}
                      accessibilityLabel={`Open ${PAY_METHOD_META[payment.method].label} to check`}
                    >
                      <Text style={styles.checkLinkText}>
                        Open {PAY_METHOD_META[payment.method].label} to check
                      </Text>
                    </PressScale>
                  ) : null}
                </View>
              </View>
            );
          })}
        </InterviewChrome>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <InterviewChrome
        step={8}
        total={9}
        kicker="Getting paid"
        title="How should people pay you?"
        onBack={() => router.back()}
        keyboard
        footer={
          <PrimaryButton onPress={goConfirm} disabled={draft.payments.length === 0}>
            {handleRows.length === 0 ? "Select a payment method" : "Review payment info"}
          </PrimaryButton>
        }
      >
        {error ? (
          <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <Text style={styles.lead}>
          Tap every app you accept. Then add your handle for each.
          {regionHint ? `\n${regionHint}` : ""}
        </Text>

        <View style={styles.methodGrid}>
          {methods.map((method) => {
            const on = selected.has(method);
            return (
              <PressScale
                key={method}
                haptic="select"
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${PAY_METHOD_META[method].label}${on ? ", selected" : ""}`}
                onPress={() => toggleMethod(method)}
                style={[styles.methodTile, on && styles.methodTileOn]}
              >
                <PayMethodIcon method={method} size={48} />
                <Text style={[styles.methodLabel, on && styles.methodLabelOn]} numberOfLines={1}>
                  {PAY_METHOD_META[method].label}
                </Text>
              </PressScale>
            );
          })}
        </View>

        {handleRows.length > 0 ? (
          <View style={styles.handlesBlock}>
            <Text style={styles.handlesTitle}>Your handles</Text>
            {handleRows.map((payment) => (
              <View key={payment.method} style={styles.handleCard}>
                <View style={styles.handleHead}>
                  <PayMethodIcon method={payment.method} size={40} />
                  <Text style={styles.handleMethod}>{PAY_METHOD_META[payment.method].label}</Text>
                </View>
                <Field
                  label={`Your ${PAY_METHOD_META[payment.method].hint}`}
                  value={payment.handle}
                  onChangeText={(handle) => {
                    setError(null);
                    draft.setPaymentHandle(payment.method, handle);
                  }}
                  placeholder={placeholderFor(payment.method)}
                  autoCapitalize="none"
                  keyboardType={
                    payment.method === "moncash" || payment.method === "natcash"
                      ? "phone-pad"
                      : payment.method === "zelle" || payment.method === "paypal"
                        ? "email-address"
                        : "default"
                  }
                />
              </View>
            ))}
          </View>
        ) : null}
      </InterviewChrome>
    </AppShell>
  );
}

function placeholderFor(method: PayMethod): string {
  switch (method) {
    case "cashapp":
      return "$alex";
    case "venmo":
      return "@alex";
    case "paypal":
      return "paypal.me/alex";
    case "zelle":
      return "alex@email.com";
    case "moncash":
    case "natcash":
      return "+509 3XXX XXXX";
    default:
      return "how to pay you";
  }
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 14 },
  notice: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(110, 46, 53, 0.28)",
    backgroundColor: "rgba(110, 46, 53, 0.06)",
    gap: 6,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  methodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  methodTile: {
    width: "30%",
    flexGrow: 1,
    minWidth: 96,
    maxWidth: "48%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  methodTileOn: {
    borderColor: colors.select,
    backgroundColor: colors.selectWash,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkSoft,
    textAlign: "center",
  },
  methodLabelOn: {
    color: colors.select,
    fontWeight: "700",
  },
  handlesBlock: { marginTop: 18, gap: 12 },
  handlesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  handleCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 10,
    backgroundColor: "#FFFcf8",
  },
  handleHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  handleMethod: { fontSize: 15, fontWeight: "700", color: colors.ink },
  confirmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  confirmLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  confirmHandle: { marginTop: 2, fontSize: 18, fontWeight: "700", color: colors.ink },
  checkLink: { marginTop: 8, alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  checkLinkText: { fontSize: 13, fontWeight: "700", color: colors.merlot },
});
