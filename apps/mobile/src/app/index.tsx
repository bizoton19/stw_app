import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiBar } from "@/components/api-bar";
import { AppShell, PrimaryButton, QuietButton } from "@/components/chrome";
import { colors } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  return (
    <AppShell>
      <SafeAreaView edges={["bottom"]} style={styles.main}>
        <View style={styles.copy}>
          <Text style={styles.kicker}>Fair split</Text>
          <Text style={styles.title}>Ready to split this check?</Text>
          <Text style={styles.body}>
            Photograph the tab. Friends claim what they actually ordered. Tax and tip follow
            the drinks — not the headcount.
          </Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton onPress={() => router.push("/host")}>Start with the receipt</PrimaryButton>
          <QuietButton onPress={() => router.push("/r/demo")}>Open the sample tab</QuietButton>
          <QuietButton onPress={() => router.push("/r/demo?host=1")}>Host tools</QuietButton>
          <ApiBar />
        </View>
      </SafeAreaView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  copy: { flex: 1 },
  kicker: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  title: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  body: { marginTop: 16, fontSize: 15, lineHeight: 22, color: colors.muted },
  actions: { gap: 4, paddingTop: 24 },
});
