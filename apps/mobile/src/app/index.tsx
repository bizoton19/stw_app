import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiBar } from "@/components/api-bar";
import { AppShell, PrimaryButton, QuietButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import { WineMark } from "@/components/wine-mark";
import {
  getActiveHostReceiptId,
  listHostedReceipts,
  type HostedReceiptSummary,
} from "@/lib/host-tabs";
import { colors } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hosted, setHosted] = useState<HostedReceiptSummary[]>([]);

  const refresh = useCallback(() => {
    void (async () => {
      setActiveId(await getActiveHostReceiptId());
      setHosted(await listHostedReceipts());
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = hosted.find((row) => row.id === activeId) ?? hosted[0] ?? null;

  return (
    <AppShell>
      <SafeAreaView edges={["bottom"]} style={styles.main}>
        <View style={styles.copy}>
          <View style={styles.heroMark}>
            <WineMark size={88} />
          </View>
          <Text style={styles.kicker}>Fair split</Text>
          <Text style={styles.title}>Ready to split this check?</Text>
          <Text style={styles.body}>
            Photograph the tab — or share a receipt photo from Camera/Photos straight into the
            app. Friends claim what they actually ordered. Tax and tip follow the drinks — not
            the headcount.
          </Text>

          {active ? (
            <View style={styles.resume}>
              <Text style={styles.resumeLabel}>Tonight’s tab</Text>
              <Text style={styles.resumeName} numberOfLines={1}>
                {active.restaurant || "Open check"}
              </Text>
              <PrimaryButton
                onPress={() =>
                  router.push({
                    pathname: "/r/[id]",
                    params: { id: active.id, host: "1" },
                  })
                }
              >
                Open live board
              </PrimaryButton>
            </View>
          ) : null}

          {hosted.length > 1 ? (
            <View style={styles.recent}>
              <Text style={styles.resumeLabel}>Recent tabs</Text>
              {hosted.slice(0, 5).map((row) => (
                <PressScale
                  key={row.id}
                  haptic="select"
                  onPress={() =>
                    router.push({
                      pathname: "/r/[id]",
                      params: { id: row.id, host: "1" },
                    })
                  }
                  style={styles.recentRow}
                >
                  <Text style={styles.recentName} numberOfLines={1}>
                    {row.restaurant || row.id}
                  </Text>
                  <Text style={styles.recentMeta}>Open</Text>
                </PressScale>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          <PrimaryButton onPress={() => router.push("/host")}>Start with the receipt</PrimaryButton>
          {active ? (
            <QuietButton onPress={() => router.push("/host")}>Start a new receipt</QuietButton>
          ) : null}
          <ApiBar />
        </View>
      </SafeAreaView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  copy: { flex: 1 },
  heroMark: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    minHeight: 120,
  },
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
  resume: {
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
    gap: 10,
  },
  resumeLabel: { fontSize: 12, fontWeight: "700", color: colors.inkSoft },
  resumeName: { fontSize: 18, fontWeight: "700", color: colors.ink },
  recent: { marginTop: 20, gap: 4 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentName: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  recentMeta: { fontSize: 13, fontWeight: "600", color: colors.merlot },
  actions: { gap: 4, paddingTop: 24 },
});
