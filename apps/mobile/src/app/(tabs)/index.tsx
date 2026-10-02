import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, Camera, ImageIcon, Trash2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiBar } from "@/components/api-bar";
import { AppShell, PrimaryButton, QuietButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import { VenueMapThumb } from "@/components/venue-map-thumb";
import {
  clearHostDraft,
  draftHasProgress,
  loadHostDraft,
  resumePathForDraft,
  type PersistedHostDraft,
} from "@/lib/host-draft-store";
import {
  clearHostedReceipt,
  getActiveHostReceiptId,
  hostedStatusLabel,
  listHostedReceipts,
  refreshHostedReceiptStatuses,
  type HostedReceiptSummary,
} from "@/lib/host-tabs";
import { api } from "@/lib/api";
import { getHostToken } from "@/lib/session";
import { venueLocationKey } from "@/lib/venue-day";
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

function draftPlaceLabel(draft: PersistedHostDraft): string {
  return draft.venue?.name?.trim() || draft.restaurant.trim() || "Unfinished check";
}

/** Skip hammering GET /api/receipts/:id for every hosted tab on every focus. */
const STATUS_REFRESH_MIN_MS = 20_000;
let lastHostedStatusRefreshAt = 0;

export default function HomeScreen() {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hosted, setHosted] = useState<HostedReceiptSummary[]>([]);
  const [draft, setDraft] = useState<PersistedHostDraft | null>(null);

  const refresh = useCallback(() => {
    void (async () => {
      // Paint AsyncStorage first so a just-published / just-closed tab shows immediately.
      setActiveId(await getActiveHostReceiptId());
      const local = await listHostedReceipts();
      setHosted(local);
      const saved = await loadHostDraft();
      setDraft(saved && draftHasProgress(saved) ? saved : null);
      const now = Date.now();
      if (now - lastHostedStatusRefreshAt < STATUS_REFRESH_MIN_MS) return;
      lastHostedStatusRefreshAt = now;
      setHosted(await refreshHostedReceiptStatuses(local));
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const active = useMemo(
    () => hosted.find((row) => row.id === activeId) ?? hosted[0] ?? null,
    [activeId, hosted],
  );
  const others = useMemo(
    () => (active ? hosted.filter((row) => row.id !== active.id) : hosted),
    [active, hosted],
  );

  function openBoard(id: string) {
    const row = hosted.find((r) => r.id === id);
    // Planned outings (and draft after event-day promotion) stay on the plan board
    // until the check is uploaded / published.
    if (row?.status === "planning" || (row?.status === "draft" && row.receiptDay)) {
      router.push(`/host/plan/${id}`);
      return;
    }
    router.push({
      pathname: "/r/[id]/settle",
      params: { id, host: "1" },
    });
  }

  function continueDraft() {
    if (!draft) return;
    router.push(resumePathForDraft(draft) as never);
  }

  function startWith(launch: "camera" | "library") {
    const go = () => {
      void clearHostDraft().then(() => {
        setDraft(null);
        router.push({ pathname: "/host/capture", params: { launch } });
      });
    };
    if (!draft) {
      go();
      return;
    }
    Alert.alert(
      "Start a new tab?",
      "This clears the unfinished draft saved on this phone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start fresh", style: "destructive", onPress: go },
      ],
    );
  }

  function confirmDiscardDraft() {
    Alert.alert(
      "Discard draft?",
      "This clears the unfinished tab saved on this phone. A server draft (if any) is left alone until you publish or delete a published tab.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void clearHostDraft().then(() => {
              setDraft(null);
              refresh();
            });
          },
        },
      ],
    );
  }

  function confirmRemove(row: HostedReceiptSummary) {
    const closed = row.status === "finalized";
    Alert.alert(
      closed ? "Delete closed tab?" : "Delete this tab?",
      closed
        ? `${row.restaurant || "This tab"} will be permanently deleted. Claim links will stop working.`
        : `${row.restaurant || "This tab"} will be deleted for everyone and free that place for today so you can publish again.`,
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
                    e.message || "Try again in a moment.",
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

  const showEmpty = !active && !draft;

  return (
    <AppShell>
      <SafeAreaView edges={["bottom"]} style={styles.main}>
        <View style={styles.top}>
          <View style={styles.topText}>
            <Text style={styles.kicker}>Host desk</Text>
            <Text style={styles.title} numberOfLines={1}>
              {active || draft ? "Your tabs" : "Ready when you are"}
            </Text>
          </View>
          <View style={styles.topActions}>
            <PressScale
              haptic="select"
              accessibilityLabel="Upload receipt from library"
              onPress={() => startWith("library")}
              style={styles.iconBtn}
            >
              <ImageIcon size={22} color={colors.ink} strokeWidth={2.25} />
            </PressScale>
            <PressScale
              haptic="select"
              accessibilityLabel="Snap a receipt photo"
              onPress={() => startWith("camera")}
              style={[styles.iconBtn, styles.iconBtnPrimary]}
            >
              <Camera size={22} color={colors.merlotFg} strokeWidth={2.25} />
            </PressScale>
          </View>
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
              {draft ? (
                <View style={styles.heroWrap}>
                  <PressScale
                    haptic="select"
                    onPress={continueDraft}
                    style={styles.heroCard}
                    accessibilityLabel={`Draft tab for ${draftPlaceLabel(draft)}`}
                  >
                    <View style={styles.heroMetaRow}>
                      <Text style={styles.heroEyebrow}>Unfinished</Text>
                      <View style={[styles.statusPill, styles.statusPillDraft]}>
                        <Text style={[styles.statusPillText, styles.statusPillTextDraft]}>
                          {hostedStatusLabel("draft")}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.heroBody}>
                      <VenueMapThumb
                        lat={draft.venue?.lat}
                        lng={draft.venue?.lng}
                        placeKey={venueLocationKey(draft.venue, draft.restaurant)}
                        category={draft.venue?.category}
                        label={draftPlaceLabel(draft)}
                        size={64}
                      />
                      <View style={styles.heroTextCol}>
                        <Text style={styles.heroDate}>
                          {receiptDate(draft.receiptDate ?? undefined, draft.updatedAt)}
                        </Text>
                        <Text style={styles.heroPlace} numberOfLines={2}>
                          {draftPlaceLabel(draft)}
                        </Text>
                        <Text style={styles.heroCta}>Tap to continue where you left off</Text>
                      </View>
                    </View>
                  </PressScale>
                  <PressScale
                    haptic="select"
                    accessibilityLabel="Discard draft"
                    onPress={confirmDiscardDraft}
                    style={styles.heroRemove}
                  >
                    <Trash2 size={16} color={colors.inkSoft} strokeWidth={2} />
                    <Text style={styles.heroRemoveText}>Discard draft</Text>
                  </PressScale>
                </View>
              ) : null}

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
                            : active.status === "planning"
                              ? styles.statusPillDraft
                              : styles.statusPillOpen,
                        ]}
                      >
                        {active.status !== "finalized" && active.status !== "planning" ? (
                          <View style={styles.liveDot} />
                        ) : null}
                        <Text
                          style={[
                            styles.statusPillText,
                            active.status === "finalized" && styles.statusPillTextClosed,
                            active.status === "planning" && styles.statusPillTextDraft,
                          ]}
                        >
                          {hostedStatusLabel(active.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.heroBody}>
                      <VenueMapThumb
                        lat={active.venueLat}
                        lng={active.venueLng}
                        placeKey={active.placeKey}
                        category={active.venueCategory}
                        label={active.restaurant || "Open check"}
                        size={64}
                      />
                      <View style={styles.heroTextCol}>
                        <Text style={styles.heroDate}>
                          {receiptDate(active.receiptDay, active.updatedAt)}
                        </Text>
                        <Text style={styles.heroPlace} numberOfLines={2}>
                          {active.restaurant || "Open check"}
                        </Text>
                        <Text style={styles.heroCta}>
                          {active.status === "planning"
                            ? "Tap to share invite & see RSVPs"
                            : active.status === "draft"
                              ? "Tap to upload the check"
                              : "Tap for who owes what · claimed & remaining"}
                        </Text>
                      </View>
                    </View>
                  </PressScale>
                  <PressScale
                    haptic="select"
                    accessibilityLabel="Delete tab"
                    onPress={() => confirmRemove(active)}
                    style={styles.heroRemove}
                  >
                    <Trash2 size={16} color={colors.inkSoft} strokeWidth={2} />
                    <Text style={styles.heroRemoveText}>
                      {active.status === "finalized" ? "Delete closed tab" : "Delete tab"}
                    </Text>
                  </PressScale>
                </View>
              ) : null}

              {showEmpty ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No open tab yet</Text>
                  <Text style={styles.emptyBody}>
                    Snap the check tonight — or plan an outing and invite people before the bill.
                  </Text>
                  <PrimaryButton onPress={() => router.push("/host")}>
                    Start a tab
                  </PrimaryButton>
                  <QuietButton onPress={() => router.push("/host/plan")}>
                    Plan an outing?
                  </QuietButton>
                </View>
              ) : (
                <View style={styles.startTabWrap}>
                  <PrimaryButton onPress={() => router.push("/host")}>Start a tab</PrimaryButton>
                  <QuietButton onPress={() => router.push("/host/plan")}>
                    Plan an outing?
                  </QuietButton>
                  <Text style={styles.startTabHint}>
                    Guided path — or use the camera / upload icons above for a quick snap.
                  </Text>
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
                  <VenueMapThumb
                    lat={item.venueLat}
                    lng={item.venueLng}
                    placeKey={item.placeKey}
                    category={item.venueCategory}
                    label={item.restaurant || item.id}
                    size={44}
                  />
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
                  accessibilityLabel="Delete tab"
                  onPress={() => confirmRemove(item)}
                  style={styles.rowTrash}
                >
                  <Trash2 size={18} color={colors.inkSoft} strokeWidth={2} />
                </PressScale>
              </View>
            );
          }}
          ListEmptyComponent={
            active || draft ? null : (
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
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFcf8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconBtnPrimary: {
    backgroundColor: colors.merlot,
    borderColor: colors.merlot,
  },
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
  heroBody: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroDate: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.7,
    lineHeight: 34,
  },
  heroPlace: {
    marginTop: 4,
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
    backgroundColor: colors.selectWash,
  },
  statusPillClosed: {
    backgroundColor: "rgba(42, 36, 28, 0.08)",
  },
  statusPillDraft: {
    backgroundColor: "rgba(110, 46, 53, 0.12)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.select,
  },
  statusPillText: { fontSize: 12, fontWeight: "700", color: colors.select },
  statusPillTextClosed: { color: colors.inkSoft },
  statusPillTextDraft: { color: colors.merlot },
  heroCta: { marginTop: 8, fontSize: 13, fontWeight: "600", color: colors.inkSoft },
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
  startTabWrap: { marginTop: 8, marginBottom: 4, gap: 8 },
  startTabHint: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: colors.inkSoft,
    paddingHorizontal: 8,
  },
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
