import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { useHostDraft } from "@/context/host-draft";
import { colors } from "@/lib/theme";

export default function HostParsing() {
  const router = useRouter();
  const draft = useHostDraft();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        await draft.runParse();
      } catch {
        // runParse already maps transport errors; if create/parse throws, still continue.
      }
      router.replace("/host/restaurant");
    })();
  }, [draft, router]);

  return (
    <AppShell>
      <InterviewChrome
        step={3}
        total={8}
        kicker="Reading"
        title="Looking over every pour…"
        onBack={() => router.back()}
        footer={<PrimaryButton disabled>Reading the receipt</PrimaryButton>}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.merlot} />
          <Text style={styles.copy}>
            This can take a few seconds. You will review every line next and can fix anything.
          </Text>
        </View>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: 48 },
  copy: {
    marginTop: 24,
    maxWidth: 280,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
