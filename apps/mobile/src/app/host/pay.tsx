import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { PAY_METHOD_META } from "@/lib/pay";
import type { PayMethod } from "@/lib/types";
import { colors } from "@/lib/theme";

const ALL_METHODS: PayMethod[] = ["venmo", "zelle", "cashapp", "other"];

export default function HostPay() {
  const router = useRouter();
  const draft = useHostDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = draft.payments.some((p) => p.handle.trim());
  const unused = useMemo(() => {
    const used = new Set(draft.payments.map((p) => p.method));
    return ALL_METHODS.filter((m) => !used.has(m));
  }, [draft.payments]);

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
          <PrimaryButton disabled={!ready} busy={busy} onPress={() => void publish()}>
            Create the claim link
          </PrimaryButton>
        }
      >
        {error ? (
          <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <Text style={styles.lead}>
          Add every app you accept. Claimers pick one and Pay opens it with their share filled in.
        </Text>
        {draft.payments.map((payment, index) => (
          <View key={`${payment.method}-${index}`} style={styles.card}>
            <View style={styles.methodRow}>
              {ALL_METHODS.map((method) => {
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
                    <PayMethodIcon method={method} size={22} />
                  </PressScale>
                );
              })}
              {draft.payments.length > 1 ? (
                <QuietButton onPress={() => draft.removePayment(index)}>Remove</QuietButton>
              ) : null}
            </View>
            <Field
              label={`Your ${PAY_METHOD_META[payment.method].hint}`}
              value={payment.handle}
              onChangeText={(handle) => draft.setPayment(index, { handle })}
              placeholder={
                payment.method === "cashapp"
                  ? "$alex"
                  : payment.method === "venmo"
                    ? "@alex"
                    : "alex@email.com"
              }
              autoCapitalize="none"
            />
          </View>
        ))}
        {unused.length > 0 ? (
          <QuietButton onPress={() => draft.addPayment(unused[0])}>Add another way to pay</QuietButton>
        ) : null}
        <Text style={styles.note}>
          Nobody is charged from Split the Wine — we only hand off to the app they choose.
        </Text>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 14 },
  card: {
    marginBottom: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 8,
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  methodChip: {
    padding: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  methodChipOn: { borderColor: colors.merlot, backgroundColor: "#FBFAF8" },
  note: { marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.muted },
});
