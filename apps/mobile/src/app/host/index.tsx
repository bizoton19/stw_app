import { Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { colors } from "@/lib/theme";

const BEATS = [
  { n: "1", label: "Snap / upload the check" },
  { n: "2", label: "Confirm the items" },
  { n: "3", label: "Share the claim link" },
];

export default function HostReady() {
  const router = useRouter();
  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={9}
        title="Ready to split this check?"
        onBack={() => router.back()}
        sparse
        footer={
          <PrimaryButton onPress={() => router.push("/host/capture")}>
            Yes — start with the receipt
          </PrimaryButton>
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroFrame}>
            <Image
              source={require("../../../assets/images/table-ready.jpg")}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel="Illustrated round table of friends — one person reading the check"
            />
          </View>
          <Text style={styles.lead}>
            One photo, a short review, then a link for the table.
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
  /** Crop toward the top so the person with the receipt reads clearly. */
  heroFrame: {
    width: "100%",
    height: 228,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  heroImage: {
    width: "100%",
    height: "118%",
    marginTop: "-6%",
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
