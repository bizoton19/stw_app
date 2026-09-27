import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { useHostDraft, resumePathForDraft } from "@/context/host-draft";
import { loadHostDraft } from "@/lib/host-draft-store";
import { colors } from "@/lib/theme";

const BEATS = [
  { n: "1", label: "Snap / upload the check" },
  { n: "2", label: "Confirm the items" },
  { n: "3", label: "Share the claim link" },
];

export default function HostReady() {
  const router = useRouter();
  const draft = useHostDraft();
  const canResume = draft.ready && draft.hasSavedProgress;

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
    if (!canResume) {
      router.push("/host/capture");
      return;
    }
    Alert.alert(
      "Start a new tab?",
      "This clears the unfinished draft saved on this phone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start fresh",
          style: "destructive",
          onPress: () => {
            void draft.clearSavedDraft().then(() => router.push("/host/capture"));
          },
        },
      ],
    );
  }

  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={9}
        title="Ready to split this check?"
        onBack={() => router.back()}
        sparse
        footer={
          <View>
            {canResume ? (
              <>
                <PrimaryButton onPress={() => void resume()}>Continue unfinished tab</PrimaryButton>
                <QuietButton onPress={startFresh}>Start fresh instead</QuietButton>
              </>
            ) : (
              <PrimaryButton onPress={() => router.push("/host/capture")}>
                Yes — start with the receipt
              </PrimaryButton>
            )}
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
            {canResume
              ? "You have an unfinished tab on this phone — pick up where you left off, or start fresh."
              : "One photo, a short review, then a link for the table."}
          </Text>
          <View style={styles.beats}>
            {BEATS.map((beat) => (
              <View key={beat.n} style={styles.beat}>
                <View style={styles.beatN}>
                  <Text style={styles.beatNText}>{beat.n}</Text>
                </View>
                <Text style={styles.beatLabel}>{beat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 4, gap: 18 },
  /** Match the asset (4:3) so the person + full receipt stay in frame. */
  heroFrame: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  lead: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 300,
    fontWeight: "500",
  },
  beats: { width: "100%", gap: 14, marginTop: 4 },
  beat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
  },
  beatN: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(110, 46, 53, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  beatNText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.merlot,
  },
  beatLabel: { fontSize: 16, fontWeight: "600", color: colors.ink, flex: 1 },
});
