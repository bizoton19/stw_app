import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { PAY_METHODS, validateHostPayments } from "@/lib/host-pay";
import { PAY_METHOD_META } from "@/lib/pay";
import type { PayMethod } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function HostPay() {
  const router = useRouter();
  const draft = useHostDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const unused = useMemo(() => {
    const used = new Set(draft.payments.map((p) => p.method));
    return PAY_METHODS.filter((m) => !used.has(m));
  }, [draft.payments]);

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
          <Text style={styles.lead}>
            Claimers will see these options. A typo here means money goes to the wrong place.
          </Text>
          {rows.map((payment) => (
            <View key={payment.method} style={styles.confirmRow}>
              <PayMethodIcon method={payment.method} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmLabel}>{PAY_METHOD_META[payment.method].label}</Text>
                <Text style={styles.confirmHandle}>{payment.handle}</Text>
              </View>
            </View>
          ))}
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
        footer={
          <PrimaryButton onPress={goConfirm}>Review payment info</PrimaryButton>
        }
      >
        {error ? (
          <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <Text style={styles.lead}>
          Add every app you accept. We check the format for typos, then you confirm before
          publishing.
        </Text>
        {draft.payments.map((payment, index) => (
          <View key={`${payment.method}-${index}`} style={styles.card}>
            <View style={styles.methodRow}>
              {PAY_METHODS.map((method) => {
                const taken = draft.payments.some(
                  (p, i) => i !== index && p.method === method,
                );
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
                payment.method === "zelle" || payment.method === "paypal" ? "email-address" : "default"
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
    default:
      return "how to pay you";
  }
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 14 },
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
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  confirmLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  confirmHandle: { marginTop: 2, fontSize: 18, fontWeight: "700", color: colors.ink },
});
