import { useEffect, useRef } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
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
      let reason: string | null = null;
      let skipRestaurant = false;
      let placeMismatch: { planned: string; scanned: string } | null = null;
      try {
        const result = await draft.runParse();
        reason = result?.reason ?? null;
        skipRestaurant = Boolean(result?.skipRestaurant);
        placeMismatch = result?.placeMismatch ?? null;
      } catch {
        // runParse already maps transport errors; if create/parse throws, still continue.
      }
      if (reason === "not_receipt") {
        router.replace("/host/capture");
        return;
      }

      const goNext = () => {
        if (skipRestaurant) {
          router.replace("/host/items");
          return;
        }
        router.replace("/host/restaurant");
      };

      if (placeMismatch) {
        Alert.alert(
          "Different place on this check?",
          `Looks like ${placeMismatch.scanned}. You planned ${placeMismatch.planned}.`,
          [
            { text: "Retake photo", style: "cancel", onPress: () => router.replace("/host/capture") },
            { text: "Use this check", onPress: goNext },
          ],
        );
        return;
      }

      goNext();
    })();
  }, [draft, router]);

  return (
    <AppShell>
      <InterviewChrome
        step={2}
        total={8}
        hideProgress
        kicker="Reading"
        motif="check-stub"
        title="Looking over every pour…"
        onBack={() => router.back()}
        onHome={goHostDesk}
        sparse
        footer={
          <View>
            <FooterHint>Next: confirm the place on the check.</FooterHint>
            <PrimaryButton disabled>Reading the receipt</PrimaryButton>
          </View>
        }
        supportTip
      >
        <View style={styles.center}>
          <WineMarkBusy size={140} />
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
    marginTop: 40,
    maxWidth: 300,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: colors.inkSoft,
  },
});
