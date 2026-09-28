import { useEffect } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { useHostDraft, resumePathForDraft } from "@/context/host-draft";
import { loadHostDraft } from "@/lib/host-draft-store";
import { colors } from "@/lib/theme";

/**
 * Resume gate only — new tabs start from Home (camera / upload).
 * Keeps the table graphic when an unfinished draft needs Continue vs Start fresh.
 */
export default function HostReady() {
  const router = useRouter();
  const draft = useHostDraft();
  const canResume = draft.ready && draft.hasSavedProgress;

  useEffect(() => {
    if (!draft.ready || canResume) return;
    router.replace("/host/capture");
  }, [draft.ready, canResume, router]);

  async function resume() {
    const saved = await loadHostDraft();
    const path = resumePathForDraft(
      saved ?? {
        version: 1,
        updatedAt: "",
        receiptId: draft.receiptId,
        restaurant: draft.restaurant,
        venue: draft.venue,
        receiptDate: draft.receiptDate,
        items: draft.items,
        fees: draft.fees,
        payments: draft.payments,
        note: draft.note,
        imageUri: draft.image?.uri ?? null,
        pickMode: draft.pickMode,
        resumePath: null,
      },
    );
    router.push(path as never);
  }

  function startFresh() {
    Alert.alert(
      "Start a new tab?",
      "This clears the unfinished draft saved on this phone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start fresh",
          style: "destructive",
          onPress: () => {
            void draft.clearSavedDraft().then(() => router.replace("/host/capture"));
          },
        },
      ],
    );
  }

  if (!draft.ready) {
    return (
      <AppShell>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Opening…</Text>
        </View>
      </AppShell>
    );
  }

  if (!canResume) {
    return <Redirect href="/host/capture" />;
  }

  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={8}
        title="Ready to split this check?"
        onBack={() => router.back()}
        onHome={goHostDesk}
        sparse
        footer={
          <View>
            <PrimaryButton onPress={() => void resume()}>Continue unfinished tab</PrimaryButton>
            <QuietButton onPress={startFresh}>Start fresh instead</QuietButton>
          </View>
        }
        supportTip
      >
        <View style={styles.hero}>
          <View style={styles.heroFrame}>
            <Image
              source={require("../../../assets/images/table-ready.jpg")}
              style={styles.heroImage}
              resizeMode="contain"
              accessibilityLabel="Illustrated round table of friends — one person reading the check"
            />
          </View>
          <Text style={styles.lead}>
            You have an unfinished tab on this phone — pick up where you left off, or start fresh.
          </Text>
        </View>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 14, color: colors.muted },
  hero: { alignItems: "center", gap: 20 },
  heroFrame: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EDE8E1",
  },
  heroImage: { width: "100%", height: "100%" },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: colors.inkSoft,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
