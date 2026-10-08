import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
import { Swipeable } from "react-native-gesture-handler";
import { RotateCcw, Trash2 } from "lucide-react-native";
import {
  AppShell,
  FOOTER_PADDING_KEYBOARD_BOTTOM,
  FOOTER_PADDING_TOP,
  InterviewChrome,
  QuietButton,
} from "@/components/chrome";
import { LineKindIcon } from "@/components/line-kind-icon";
import { PressScale } from "@/components/press-scale";
import { QtyStepper } from "@/components/qty-stepper";
import { useHostDraft, type DraftItem } from "@/context/host-draft";
import { t } from "@/lib/i18n";
import { HOST_LINE_QTY_MAX, HOST_LINE_QTY_MIN, rescaleLineTotal } from "@/lib/host-line-qty";
import { centsToLabel, unitPriceCents } from "@/lib/money";
import { pourCandidates } from "@/lib/pour";
import { revealScrollDelta } from "@/lib/reveal-in-scroll";
import type { ParseReviewChoice } from "@/lib/types";
import { colors } from "@/lib/theme";

/** Footer padding outside this screen's footer slot once the keyboard is open. */
const FOOTER_CHROME_WHILE_KEYBOARD = FOOTER_PADDING_TOP + FOOTER_PADDING_KEYBOARD_BOTTOM;

function revealRowAboveFooter(
  row: View,
  scroll: ScrollView,
  scrollOffsetRef: RefObject<number>,
  footerHeight: number,
  keyboardTop: number | null,
  isCancelled: () => boolean,
) {
  row.measureInWindow((_x, rowY, _w, rowH) => {
    if (isCancelled()) return;
    scroll.measureInWindow((_sx, scrollY, _sw, scrollH) => {
      if (isCancelled() || scrollH < 1 || rowH < 1) return;
      const bar = (footerHeight > 0 ? footerHeight : 150) + FOOTER_CHROME_WHILE_KEYBOARD;
      const predictedBottom =
        keyboardTop != null && keyboardTop > 0 ? keyboardTop - bar : scrollY + scrollH;
      const visibleBottom = Math.min(scrollY + scrollH, predictedBottom);
      const delta = revealScrollDelta(
        { y: rowY, height: rowH },
        { y: scrollY, height: Math.max(0, visibleBottom - scrollY) },
      );
      if (Math.abs(delta) < 1) return;
      scroll.scrollTo({
        y: Math.max(0, scrollOffsetRef.current + delta),
        animated: true,
      });
    });
  });
}

function ItemRow({
  item,
  editing,
  highlightTrash,
  onEdit,
  onChange,
  onSoftDelete,
  onUndo,
  scrollRef,
  scrollOffsetRef,
  footerHeightRef,
}: {
  item: DraftItem;
  editing: boolean;
  highlightTrash: boolean;
  onEdit: () => void;
  onChange: (next: DraftItem) => void;
  onSoftDelete: () => void;
  onUndo: () => void;
  scrollRef: RefObject<ScrollView | null>;
  scrollOffsetRef: RefObject<number>;
  footerHeightRef: RefObject<number>;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const rowRef = useRef<View>(null);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const isCancelled = () => cancelled;

    const reveal = (keyboardTop: number | null) => {
      const row = rowRef.current;
      const scroll = scrollRef.current;
      if (cancelled || !row || !scroll) return;
      revealRowAboveFooter(
        row,
        scroll,
        scrollOffsetRef,
        footerHeightRef.current,
        keyboardTop,
        isCancelled,
      );
    };

    const fromMetrics = () => {
      reveal(Keyboard.metrics()?.screenY ?? null);
    };

    const onShow = (event: { endCoordinates: { screenY: number } }) => {
      reveal(event.endCoordinates.screenY);
    };

    // Already open: switching rows does not emit another show event.
    if (Keyboard.isVisible()) {
      const soon = setTimeout(fromMetrics, 50);
      const later = setTimeout(fromMetrics, 200);
      return () => {
        cancelled = true;
        clearTimeout(soon);
        clearTimeout(later);
      };
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, onShow);
    // willShow can scroll before the list has shrunk, which clamps. Measure
    // again after the avoiding padding and the keyboard animation settle.
    const did =
      Platform.OS === "ios" ? Keyboard.addListener("keyboardDidShow", onShow) : null;
    const backupSoon = setTimeout(fromMetrics, 320);
    const backupLate = setTimeout(fromMetrics, 640);
    return () => {
      cancelled = true;
      sub.remove();
      did?.remove();
      clearTimeout(backupSoon);
      clearTimeout(backupLate);
    };
  }, [editing, footerHeightRef, scrollOffsetRef, scrollRef]);

  const removed = Boolean(item.removed);

  const renderRight = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const opacity = dragX.interpolate({
      inputRange: [-84, -40, 0],
      outputRange: [1, 0.6, 0],
      extrapolate: "clamp",
    });
    return (
      <Animated.View style={[styles.swipeDelete, { opacity }]}>
        <Pressable
          style={styles.swipeDeleteBtn}
          onPress={() => {
            swipeRef.current?.close();
            onSoftDelete();
          }}
          accessibilityLabel={t("items.remove", {
            name: item.name.trim() || t("items.line"),
          })}
        >
          <Trash2 size={18} color={colors.merlotFg} />
          <Text style={styles.swipeDeleteText}>Remove</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const body = editing && !removed ? (
    <View style={[styles.row, styles.rowEditing]}>
      <LineKindIcon
        name={item.name}
        kind={item.kind}
        pour={item.pour}
        style={{ marginBottom: 2 }}
      />
      <View style={styles.nameCol}>
        <Text style={styles.colLabel}>{t("items.nameLabel")}</Text>
        <TextInput
          value={item.name}
          placeholder={t("items.itemName")}
          placeholderTextColor={colors.muted}
          style={styles.nameInput}
          autoCorrect={false}
          autoFocus
          onChangeText={(name) => onChange({ ...item, name })}
        />
      </View>
      <View style={styles.qtyCol}>
        <Text style={styles.colLabel}>{t("items.qty")}</Text>
        <QtyStepper
          variant="field"
          value={item.qty}
          min={HOST_LINE_QTY_MIN}
          max={HOST_LINE_QTY_MAX}
          labelledBy={t("items.qty")}
          onChange={(qty) =>
            onChange({ ...item, ...rescaleLineTotal(item.totalCents, item.qty, qty) })
          }
        />
      </View>
      <View style={styles.amtCol}>
        <Text style={styles.colLabel}>{t("items.amt")}</Text>
        <TextInput
          value={item.totalInput}
          keyboardType="decimal-pad"
          style={styles.numInput}
          accessibilityLabel={t("items.amt")}
          onChangeText={(totalInput) => {
            const totalCents = Math.round((Number(totalInput) || 0) * 100);
            onChange({ ...item, totalInput, totalCents });
          }}
        />
      </View>
      <PressScale
        accessibilityLabel={t("items.remove", {
          name: item.name.trim() || t("items.line"),
        })}
        onPress={onSoftDelete}
        style={[styles.trash, highlightTrash ? styles.trashHighlight : null]}
      >
        <Trash2 size={13} color={highlightTrash ? colors.merlot : colors.inkSoft} />
      </PressScale>
    </View>
  ) : (
    <Pressable
      onPress={() => {
        if (removed) return;
        onEdit();
      }}
      disabled={removed}
      style={[styles.row, removed && styles.rowRemoved]}
      accessibilityRole="button"
      accessibilityLabel={
        removed
          ? item.name.trim() || t("items.line")
          : (() => {
              const name = item.name.trim() || t("items.itemName");
              const total = centsToLabel(item.totalCents);
              if (item.qty > 1) {
                const unit = centsToLabel(unitPriceCents(item.totalCents, item.qty));
                return `Edit ${name}, ${item.qty} times ${unit}, ${total}`;
              }
              return `Edit ${name}, ${total}`;
            })()
      }
      accessibilityHint={removed ? undefined : "Tap to edit name, quantity, or amount"}
    >
      <LineKindIcon
        name={item.name}
        kind={item.kind}
        pour={item.pour}
        style={{ marginBottom: 2 }}
      />
      <View style={styles.nameCol}>
        <View style={styles.readTop}>
          <Text style={[styles.readName, removed && styles.struck]} numberOfLines={2}>
            {item.name.trim() || t("items.itemName")}
          </Text>
          <Text style={[styles.readTotal, removed && styles.struck]}>{centsToLabel(item.totalCents)}</Text>
        </View>
        {item.qty > 1 ? (
          <Text style={styles.readMeta}>
            {item.qty} × {centsToLabel(unitPriceCents(item.totalCents, item.qty))}
          </Text>
        ) : null}
      </View>
      {removed ? (
        <PressScale accessibilityLabel="Undo remove" onPress={onUndo} style={styles.undoBtn}>
          <RotateCcw size={14} color={colors.merlot} />
        </PressScale>
      ) : (
        <PressScale
          accessibilityLabel={t("items.remove", {
            name: item.name.trim() || t("items.line"),
          })}
          onPress={onSoftDelete}
          style={[styles.trash, highlightTrash ? styles.trashHighlight : null]}
        >
          <Trash2 size={13} color={highlightTrash ? colors.merlot : colors.inkSoft} />
        </PressScale>
      )}
    </Pressable>
  );

  return (
    <View ref={rowRef} collapsable={false}>
      <Swipeable
        ref={swipeRef}
        friction={2}
        overshootRight={false}
        enabled={!removed && !editing}
        renderRightActions={renderRight}
        onSwipeableOpen={(dir) => {
          if (dir === "right") {
            swipeRef.current?.close();
            onSoftDelete();
          }
        }}
      >
        {body}
      </Swipeable>
    </View>
  );
}

export default function HostItems() {
  const router = useRouter();
  const draft = useHostDraft();
  const activeItems = useMemo(
    () => draft.items.filter((i) => !i.removed),
    [draft.items],
  );
  const subtotal = activeItems.reduce((s, i) => s + i.totalCents, 0);
  const [hint, setHint] = useState<string | null>(null);
  const [choice, setChoice] = useState<ParseReviewChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const footerHeightRef = useRef(0);

  const canContinue =
    activeItems.length > 0 && !activeItems.some((i) => !i.name.trim() || i.qty < 1);

  function stopEditing() {
    setEditingId(null);
    Keyboard.dismiss();
  }

  function flashToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function softDelete(id: string) {
    const row = draft.items.find((i) => i.id === id);
    if (editingId === id) stopEditing();
    draft.setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, removed: true } : i)),
    );
    flashToast(`Removed ${row?.name.trim() || "line"} · tap undo on the row`);
  }

  function undo(id: string) {
    draft.setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, removed: false } : i)),
    );
    setToast(null);
  }

  function goAfterItems() {
    const next = pourCandidates(draft.items);
    if (next.length > 0) router.push("/host/pour");
    else router.push("/host/fees");
  }

  async function applyChoice(next: ParseReviewChoice, opts?: { continue?: boolean }) {
    stopEditing();
    setChoice(next);
    setBusy(true);
    try {
      await draft.recordParseReview(next);
      if (next === "needs_edits") setHint(t("items.tipInaccuracies"));
      else setHint(null);
      if (opts?.continue) goAfterItems();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <InterviewChrome
        step={4}
        total={8}
        kicker={t("items.kicker")}
        motif="stem"
        title={t("items.title")}
        onBack={() => router.back()}
        onHome={goHostDesk}
        // Stay mounted. Gating this on editingId mounts avoiding in the same
        // commit as autoFocus, so keyboardWillShow is easy to miss and the
        // Yes/No bar never moves above the keyboard.
        scrollRef={scrollRef}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        dense
        footer={
          <View
            onLayout={(event) => {
              footerHeightRef.current = event.nativeEvent.layout.height;
            }}
          >
            {toast ? (
              <View style={styles.toast}>
                <Text style={styles.toastText}>{toast}</Text>
              </View>
            ) : null}
            <Text style={styles.footNote}>
              {t("items.subtotal", { amount: centsToLabel(subtotal) })}
            </Text>
            <Text style={styles.reviewLabel}>{t("items.looksGoodLabel")}</Text>
            <View style={styles.footerRow}>
              <PressScale
                disabled={busy || !canContinue}
                onPress={() => void applyChoice("looks_good", { continue: true })}
                style={[
                  styles.halfBtn,
                  choice === "looks_good" && canContinue ? styles.halfBtnSelected : null,
                  !canContinue && styles.halfBtnDisabled,
                ]}
                accessibilityLabel={t("items.yes")}
                accessibilityRole="button"
              >
                <Text style={[styles.halfText, !canContinue && styles.halfTextDisabled]}>
                  {t("items.yes")}
                </Text>
              </PressScale>
              <PressScale
                disabled={busy}
                onPress={() => void applyChoice("needs_edits")}
                style={[
                  styles.halfBtn,
                  choice === "needs_edits" ? styles.halfBtnSelected : null,
                ]}
                accessibilityLabel={t("items.no")}
                accessibilityRole="button"
              >
                <Text style={styles.halfText}>{t("items.no")}</Text>
              </PressScale>
            </View>
            {choice === "needs_edits" ? (
              <PressScale
                disabled={busy || !canContinue}
                onPress={() => {
                  stopEditing();
                  goAfterItems();
                }}
                style={[styles.continueBtn, !canContinue && styles.continueDisabled]}
              >
                <Text style={[styles.continueText, !canContinue && styles.continueTextDisabled]}>
                  {t("items.continueAfterEdit")}
                </Text>
              </PressScale>
            ) : null}
          </View>
        }
        supportTip
      >
        {hint ? (
          <Pressable onPress={stopEditing}>
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          </Pressable>
        ) : null}
        {draft.items.length === 0 ? <Text style={styles.lead}>{t("items.empty")}</Text> : null}
        <Text style={styles.swipeHint}>
          Tap a line to edit · swipe left to remove · undo anytime
        </Text>
        {draft.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            editing={editingId === item.id}
            highlightTrash={false}
            onEdit={() => setEditingId(item.id)}
            onChange={(next) =>
              draft.setItems(draft.items.map((row) => (row.id === item.id ? next : row)))
            }
            onSoftDelete={() => softDelete(item.id)}
            onUndo={() => undo(item.id)}
            scrollRef={scrollRef}
            scrollOffsetRef={scrollOffsetRef}
            footerHeightRef={footerHeightRef}
          />
        ))}
        <QuietButton
          onPress={() => {
            const id = `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            draft.setItems([
              ...draft.items,
              {
                id,
                name: "",
                qty: 1,
                totalCents: 0,
                totalInput: "0.00",
              },
            ]);
            setEditingId(id);
          }}
        >
          {t("items.addLine")}
        </QuietButton>
      </InterviewChrome>
    </AppShell>
  );
}

const INPUT_H = 36;

const styles = StyleSheet.create({
  lead: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  swipeHint: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  hintBox: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#E6E0D8",
  },
  hintText: { fontSize: 13, lineHeight: 18, color: colors.ink, fontWeight: "500" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
    minHeight: 56,
  },
  rowEditing: {
    alignItems: "flex-end",
    paddingVertical: 10,
    backgroundColor: "#FFFcf8",
    borderRadius: 10,
    borderTopWidth: 0,
    marginVertical: 4,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.merlot,
  },
  rowRemoved: { opacity: 0.72 },
  nameCol: { flex: 1, minWidth: 0 },
  qtyCol: { width: 76 },
  amtCol: { width: 64 },
  colLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.inkSoft,
    letterSpacing: 0.15,
    marginBottom: 2,
    textAlign: "left",
  },
  readTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  readName: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 22,
  },
  readTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    lineHeight: 22,
  },
  readMeta: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    color: colors.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  nameInput: {
    height: INPUT_H,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "left",
    backgroundColor: colors.paper,
  },
  numInput: {
    height: INPUT_H,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    textAlign: "left",
    backgroundColor: colors.paper,
  },
  struck: {
    textDecorationLine: "line-through",
    color: colors.muted,
  },
  trash: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  trashHighlight: {
    borderRadius: 8,
    backgroundColor: "rgba(110, 46, 53, 0.08)",
  },
  undoBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(110, 46, 53, 0.08)",
  },
  swipeDelete: {
    width: 84,
    marginVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.merlot,
    justifyContent: "center",
  },
  swipeDeleteBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  swipeDeleteText: { color: colors.merlotFg, fontSize: 11, fontWeight: "700" },
  toast: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.ink,
  },
  toastText: { color: colors.merlotFg, fontSize: 12, fontWeight: "600", textAlign: "center" },
  footNote: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSoft,
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
  reviewLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 8,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  halfBtn: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  halfBtnSelected: {
    borderColor: colors.merlot,
    backgroundColor: "rgba(110, 46, 53, 0.06)",
  },
  halfBtnDisabled: {
    backgroundColor: colors.chromeBorder,
    borderColor: colors.chromeBorder,
  },
  halfText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  halfTextDisabled: { color: colors.inkFirm },
  continueBtn: {
    marginTop: 8,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.merlot,
    alignItems: "center",
    justifyContent: "center",
  },
  continueDisabled: { backgroundColor: colors.chromeBorder },
  continueText: { color: colors.merlotFg, fontSize: 15, fontWeight: "700" },
  continueTextDisabled: { color: colors.inkFirm },
});
