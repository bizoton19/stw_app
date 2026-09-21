import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { PAY_METHOD_META } from "@/lib/pay";
import type { PayMethod } from "@/lib/types";
import { colors } from "@/lib/theme";

const PAY_OPTIONS: PayMethod[] = ["venmo", "zelle", "cashapp", "other"];

export default function HostPay() {
  const router = useRouter();
  const draft = useHostDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hint = PAY_METHOD_META[draft.method].hint;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await draft.publish();
      router.push("/host/share");
    } catch {
      setError("Couldn't publish. Check the API URL on the home screen — localhost won't work from a phone.");
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
          <PrimaryButton
            disabled={!draft.handle.trim()}
            busy={busy}
            onPress={() => void publish()}
          >
            Create the claim link
          </PrimaryButton>
        }
      >
        {error ? <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text> : null}
        <View style={styles.grid}>
          {PAY_OPTIONS.map((method) => {
            const on = draft.method === method;
            const meta = PAY_METHOD_META[method];
            return (
              <PressScale
                key={method}
                onPress={() => draft.setMethod(method)}
                style={[styles.cell, on && styles.cellOn]}
              >
                <PayMethodIcon method={method} size={28} />
                <Text style={[styles.label, !on && { color: colors.muted }]}>{meta.label}</Text>
              </PressScale>
            );
          })}
        </View>
        <Field
          label={`Your ${hint}`}
          value={draft.handle}
          onChangeText={draft.setHandle}
          placeholder="@alex"
          autoCapitalize="none"
        />
        <Text style={styles.note}>
          Claimers get a Pay button that opens this app with the amount filled in when possible.
          Nobody is charged from Split the Wine.
        </Text>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  cell: {
    width: "48%",
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
  },
  cellOn: { borderColor: colors.merlot, backgroundColor: "#FBFAF8" },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  note: { marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.muted },
});
