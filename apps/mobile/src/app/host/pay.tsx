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

  const unused = useMemo(() => {
    const used = new Set(draft.payments.map((p) => p.method));
    return methods.filter((m) => !used.has(m));
  }, [draft.payments, methods]);

  function goConfirm() {
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
          step={7}
          total={8}
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
        step={7}
        total={8}
        kicker="Getting paid"
        title="How should people pay you?"
        onBack={() => router.back()}
        keyboard
        footer={<PrimaryButton onPress={goConfirm}>Review payment info</PrimaryButton>}
      >
        {error ? (
          <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <Text style={styles.lead}>
          Add every app you accept. We check the format for typos, then you confirm before
          publishing.
          {regionHint ? `\n${regionHint}` : ""}
        </Text>
        {draft.payments.map((payment, index) => (
          <View key={`${payment.method}-${index}`} style={styles.card}>
            <View style={styles.methodRow}>
              {methods.map((method) => {
                const taken = draft.payments.some((p, i) => i !== index && p.method === method);
                const on = payment.method === method;
                if (taken) return null;
                return (
                  <PressScale
                    key={method}
                    onPress={() => draft.setPayment(index, { method })}
                    style={[styles.methodChip, on && styles.methodChipOn]}
                  >
                    <PayMethodIcon method={method} size={44} />
                  </PressScale>
                );
              })}
            </View>
            <Field
              label={`Your ${PAY_METHOD_META[payment.method].hint}`}
              value={payment.handle}
              onChangeText={(handle) => {
                setError(null);
                draft.setPayment(index, { handle });
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
            {draft.payments.length > 1 ? (
              <QuietButton onPress={() => draft.removePayment(index)}>Remove</QuietButton>
            ) : null}
          </View>
        ))}
        {unused.length > 0 ? (
          <QuietButton onPress={() => draft.addPayment(unused[0])}>Add another way to pay</QuietButton>
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
  card: {
    marginBottom: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 10,
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  methodChip: {
    padding: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  methodChipOn: { borderColor: colors.merlot, backgroundColor: "#FBFAF8" },
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
