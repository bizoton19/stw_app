import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, Plus, Trash2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiBar } from "@/components/api-bar";
import { AppShell, PrimaryButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import {
  clearHostedReceipt,
  getActiveHostReceiptId,
  hostedStatusLabel,
  refreshHostedReceiptStatuses,
  type HostedReceiptSummary,
} from "@/lib/host-tabs";
import { api } from "@/lib/api";
import { getHostToken } from "@/lib/session";
import { colors } from "@/lib/theme";

function receiptDate(isoDay?: string, updatedAt?: string): string {
  const raw = isoDay && /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? isoDay : updatedAt?.slice(0, 10);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "Open check";
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return "Open check";
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isToday(isoDay?: string, updatedAt?: string): boolean {
  const raw = isoDay && /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? isoDay : updatedAt?.slice(0, 10);
  if (!raw) return false;
  return raw === new Date().toISOString().slice(0, 10);
}

export default function HomeScreen() {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hosted, setHosted] = useState<HostedReceiptSummary[]>([]);

  const refresh = useCallback(() => {
    void (async () => {
      setActiveId(await getActiveHostReceiptId());
      setHosted(await refreshHostedReceiptStatuses());
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

  const active = useMemo(
    () => hosted.find((row) => row.id === activeId) ?? hosted[0] ?? null,
    [activeId, hosted],
  );
  const others = useMemo(
    () => (active ? hosted.filter((row) => row.id !== active.id) : hosted),
    [active, hosted],
  );

  function openBoard(id: string) {
    router.push({
      pathname: "/r/[id]/settle",
      params: { id, host: "1" },
    });
  }

  function confirmRemove(row: HostedReceiptSummary) {
    const closed = row.status === "finalized";
    if (!closed) {
      Alert.alert(
        "Remove from this phone?",
        `${row.restaurant || "This tab"} leaves your list. Close it first if you want to delete it for everyone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              void clearHostedReceipt(row.id).then(refresh);
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      "Delete closed tab?",
      `${row.restaurant || "This tab"} will be permanently deleted. Claim links will stop working.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                const hostToken = getHostToken(row.id);
                if (!hostToken) throw new Error("Missing host token");
                await api(`/api/receipts/${row.id}`, {
                  method: "DELETE",
                  hostToken,
                });
              } catch (err) {
                const e = err as { message?: string; code?: string };
                if (e.code !== "not_found") {
                  Alert.alert(
                    "Couldn't delete",
                    e.message || "Close the tab, then try again.",
                  );
                  return;
                }
              }
              await clearHostedReceipt(row.id);
              refresh();
            })();
          },
        },
      ],
    );
  }

  return (
    <AppShell>
      <SafeAreaView edges={["bottom"]} style={styles.main}>
        <View style={styles.top}>
          <View style={styles.topText}>
            <Text style={styles.kicker}>Host desk</Text>
            <Text style={styles.title} numberOfLines={1}>
              {active ? "Your tabs" : "Ready when you are"}
            </Text>
          </View>
          <PressScale
            haptic="select"
            accessibilityLabel="Create a new tab"
            onPress={() => router.push("/host")}
            style={styles.newBtn}
          >
            <Plus size={18} color={colors.merlotFg} strokeWidth={2.5} />
            <Text style={styles.newBtnText}>New</Text>
          </PressScale>
        </View>

        <FlatList
          data={others}
          keyExtractor={(row) => row.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          bounces={Platform.OS === "ios"}
          ListHeaderComponent={
            <View>
              {active ? (
                <View style={styles.heroWrap}>
                  <PressScale
                    haptic="select"
                    onPress={() => openBoard(active.id)}
                    style={styles.heroCard}
                    accessibilityLabel={`${hostedStatusLabel(active.status)} tab for ${receiptDate(active.receiptDay, active.updatedAt)}`}
                  >
                    <View style={styles.heroMetaRow}>
                      <Text style={styles.heroEyebrow}>
                        {isToday(active.receiptDay, active.updatedAt)
                          ? "Tonight’s tab"
                          : "Recent tab"}
                      </Text>
                      <View
                        style={[
                          styles.statusPill,
                          active.status === "finalized"
                            ? styles.statusPillClosed
                            : styles.statusPillOpen,
                        ]}
                      >
                        {active.status !== "finalized" ? (
                          <View style={styles.liveDot} />
                        ) : null}
                        <Text
                          style={[
                            styles.statusPillText,
                            active.status === "finalized" && styles.statusPillTextClosed,
                          ]}
                        >
                          {hostedStatusLabel(active.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.heroDate}>
                      {receiptDate(active.receiptDay, active.updatedAt)}
                    </Text>
                    <Text style={styles.heroPlace} numberOfLines={2}>
                      {active.restaurant || "Open check"}
                    </Text>
                    <Text style={styles.heroCta}>
                      Tap for who owes what · claimed & remaining
                    </Text>
                  </PressScale>
                  <PressScale
                    haptic="select"
                    accessibilityLabel={
                      active.status === "finalized"
                        ? "Delete closed tab"
                        : "Remove tab from this phone"
                    }
                    onPress={() => confirmRemove(active)}
                    style={styles.heroRemove}
                  >
                    <Trash2 size={16} color={colors.inkSoft} strokeWidth={2} />
                    <Text style={styles.heroRemoveText}>
                      {active.status === "finalized"
                        ? "Delete closed tab"
                        : "Remove from phone"}
                    </Text>
                  </PressScale>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No open tab yet</Text>
                  <Text style={styles.emptyBody}>
                    Snap the check, confirm the lines, share a claim link. Tax and tip follow what
                    people ordered.
                  </Text>
                  <PrimaryButton onPress={() => router.push("/host")}>
                    Start a tab
                  </PrimaryButton>
                </View>
              )}
              {others.length > 0 ? (
                <Text style={styles.sectionLabel}>Recent</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const closed = item.status === "finalized";
            const label = hostedStatusLabel(item.status);
            return (
              <View style={styles.row}>
                <PressScale
                  haptic="select"
                  onPress={() => openBoard(item.id)}
                  style={styles.rowMain}
                  accessibilityLabel={`${label} · ${receiptDate(item.receiptDay, item.updatedAt)}`}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowTitleRow}>
                      <Text style={styles.rowDate}>
                        {receiptDate(item.receiptDay, item.updatedAt)}
                      </Text>
                      <Text style={[styles.rowStatus, closed && styles.rowStatusClosed]}>
                        ({label})
                      </Text>
                    </View>
                    <Text style={styles.rowPlace} numberOfLines={1}>
                      {item.restaurant || item.id}
                    </Text>
                  </View>
                  <Text style={styles.rowAction}>Board</Text>
                  <ChevronRight size={18} color={colors.inkSoft} strokeWidth={2.25} />
                </PressScale>
                <PressScale
                  haptic="select"
                  accessibilityLabel="Remove from this phone"
                  onPress={() => confirmRemove(item)}
                  style={styles.rowTrash}
                >
                  <Trash2 size={18} color={colors.inkSoft} strokeWidth={2} />
                </PressScale>
              </View>
            );
          }}
          ListEmptyComponent={
            active ? null : (
              <Text style={styles.hint}>Your hosted tabs will show up here.</Text>
            )
          }
          ListFooterComponent={
            <View style={styles.apiWrap}>
              <ApiBar />
            </View>
          }
        />
      </SafeAreaView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, minHeight: 0 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topText: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, letterSpacing: 0.2 },
  title: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.35,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.merlot,
  },
  newBtnText: { fontSize: 14, fontWeight: "700", color: colors.merlotFg },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexGrow: 1 },
  heroWrap: { marginBottom: 8 },
  heroCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
  },
  heroRemove: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  heroRemoveText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  heroEyebrow: { fontSize: 12, fontWeight: "700", color: colors.merlot },
  heroDate: {
    marginTop: 10,
    fontSize: 34,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.7,
    lineHeight: 40,
  },
  heroPlace: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: colors.inkSoft,
    letterSpacing: -0.2,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillOpen: {
    backgroundColor: "rgba(47, 93, 80, 0.12)",
  },
  statusPillClosed: {
    backgroundColor: "rgba(42, 36, 28, 0.08)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.select,
  },
  statusPillText: { fontSize: 12, fontWeight: "700", color: colors.select },
  statusPillTextClosed: { color: colors.inkSoft },
  heroCta: { marginTop: 14, fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  emptyCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
    marginBottom: 8,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  emptyBody: { fontSize: 15, lineHeight: 22, color: colors.muted },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },
  rowTrash: {
    paddingHorizontal: 10,
    paddingVertical: 14,
    justifyContent: "center",
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  rowDate: { fontSize: 20, fontWeight: "800", color: colors.ink, letterSpacing: -0.35 },
  rowStatus: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.select,
  },
  rowStatusClosed: { color: colors.inkSoft },
  rowPlace: { marginTop: 2, fontSize: 14, fontWeight: "500", color: colors.inkSoft },
  rowAction: { fontSize: 14, fontWeight: "700", color: colors.merlot },
  hint: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 14,
    color: colors.muted,
  },
  apiWrap: { marginTop: 28, paddingBottom: 8 },
});
