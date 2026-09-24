import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { WineMarkBusy } from "@/components/wine-mark";
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
        sparse
        footer={
          <View>
            <FooterHint>Next: confirm the place on the check.</FooterHint>
            <PrimaryButton disabled>Reading the receipt</PrimaryButton>
          </View>
        }
      >
        <View style={styles.center}>
          <WineMarkBusy size={72} />
          <Text style={styles.copy}>
            Reading the check. You’ll review every line next — and pick the place yourself.
          </Text>
        </View>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    minHeight: 280,
  },
  copy: {
    marginTop: 32,
    maxWidth: 300,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: colors.inkSoft,
  },
});
