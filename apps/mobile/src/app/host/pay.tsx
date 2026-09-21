import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import type { PayMethod } from "@/lib/types";
import { colors } from "@/lib/theme";

const PAY_OPTIONS: { method: PayMethod; label: string; hint: string }[] = [
  { method: "venmo", label: "Venmo", hint: "@handle" },
  { method: "zelle", label: "Zelle", hint: "email or phone" },
  { method: "cashapp", label: "Cash App", hint: "$cashtag" },
  { method: "other", label: "Other", hint: "how to pay you" },
];

export default function HostPay() {
  const router = useRouter();
  const draft = useHostDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hint = PAY_OPTIONS.find((o) => o.method === draft.method)?.hint;

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
          {PAY_OPTIONS.map((option) => {
            const on = draft.method === option.method;
            return (
              <PressScale
                key={option.method}
                onPress={() => draft.setMethod(option.method)}
                style={styles.cell}
              >
                <View style={[styles.dot, on && styles.dotOn]} />
                <Text style={[styles.label, !on && { color: colors.muted }]}>{option.label}</Text>
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
        <Text style={styles.note}>A pre-filled message. Nobody is charged from this app.</Text>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cell: {
    width: "50%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.merlot },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  note: { marginTop: 8, fontSize: 12, color: colors.muted },
});
