import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, QuietButton } from "@/components/chrome";
import { LineKindIcon } from "@/components/line-kind-icon";
import { PressScale } from "@/components/press-scale";
import { useHostDraft, type DraftItem } from "@/context/host-draft";
import { t } from "@/lib/i18n";
import { centsToLabel } from "@/lib/money";
import { pourCandidates } from "@/lib/pour";
import type { ParseReviewChoice } from "@/lib/types";
import { colors } from "@/lib/theme";

type MenuSide = "yes" | "no" | null;

function ItemRow({
  item,
  editing,
  highlightTrash,
  onEdit,
  onChange,
  onSoftDelete,
  onUndo,
}: {
  item: DraftItem;
  editing: boolean;
  highlightTrash: boolean;
  onEdit: () => void;
  onChange: (next: DraftItem) => void;
  onSoftDelete: () => void;
  onUndo: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
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
      <LineKindIcon name={item.name} kind={item.kind} style={{ marginBottom: 2 }} />
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
        <TextInput
          value={String(item.qty)}
          keyboardType="number-pad"
          style={styles.numInput}
          accessibilityLabel={t("items.qty")}
          onChangeText={(raw) => {
            const qty = Math.max(1, Math.floor(Number(raw) || 0));
            const prevQty = Math.max(1, item.qty);
            const unitCents = Math.round(item.totalCents / prevQty);
            const totalCents = unitCents * qty;
            onChange({
              ...item,
              qty,
              totalCents,
              totalInput: (totalCents / 100).toFixed(2),
            });
          }}
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
          : `Edit ${item.name.trim() || t("items.line")}`
      }
      accessibilityHint={removed ? undefined : "Tap to edit name, quantity, or amount"}
    >
      <LineKindIcon name={item.name} kind={item.kind} style={{ marginBottom: 2 }} />
      <View style={styles.nameCol}>
        <Text style={[styles.readName, removed && styles.struck]} numberOfLines={2}>
          {item.name.trim() || t("items.itemName")}
        </Text>
        <Text style={styles.readMeta}>
          ×{item.qty} · {centsToLabel(item.totalCents)}
        </Text>
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
  const [menu, setMenu] = useState<MenuSide>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [choice, setChoice] = useState<ParseReviewChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setMenu(null);
    setChoice(next);
    setBusy(true);
    try {
      await draft.recordParseReview(next);
      if (next === "remove_items") setHint(t("items.tipRemove"));
      else if (next === "needs_edits") setHint(t("items.tipInaccuracies"));
      else setHint(null);
      if (opts?.continue) goAfterItems();
    } finally {
      setBusy(false);
    }
  }

  function openMenu(side: MenuSide) {
    stopEditing();
    setMenu((m) => (m === side ? null : side));
  }

  return (
    <AppShell>
      <InterviewChrome
        step={5}
        total={9}
        kicker={t("items.kicker")}
        title={t("items.title")}
        onBack={() => router.back()}
        keyboard={Boolean(editingId)}
        dense
        footer={
          <View>
            {toast ? (
              <View style={styles.toast}>
                <Text style={styles.toastText}>{toast}</Text>
              </View>
            ) : null}
            <Text style={styles.footNote}>
              {t("items.subtotal", { amount: centsToLabel(subtotal) })}
            </Text>
            <Text style={styles.reviewLabel}>{t("items.looksGoodLabel")}</Text>
            {menu === "yes" ? (
              <View style={styles.menu}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !canContinue}
                  onPress={() => void applyChoice("looks_good", { continue: true })}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuText}>{t("items.looksGoodChoice")}</Text>
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void applyChoice("remove_items")}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuText}>{t("items.needRemove")}</Text>
                </Pressable>
              </View>
            ) : null}
            {menu === "no" ? (
              <View style={styles.menu}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void applyChoice("needs_edits")}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuText}>{t("items.needsEdits")}</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.footerRow}>
              <PressScale
                disabled={busy}
                onPress={() => openMenu("yes")}
                style={[
                  styles.halfBtn,
                  choice === "looks_good" || choice === "remove_items"
                    ? styles.halfBtnSelected
                    : null,
                ]}
                accessibilityLabel={t("items.yes")}
              >
                <Text style={styles.halfText}>{t("items.yes")}</Text>
                <ChevronDown
                  size={16}
                  color={colors.ink}
                  style={{ transform: [{ rotate: menu === "yes" ? "180deg" : "0deg" }] }}
                />
              </PressScale>
              <PressScale
                disabled={busy}
                onPress={() => openMenu("no")}
                style={[styles.halfBtn, choice === "needs_edits" ? styles.halfBtnSelected : null]}
                accessibilityLabel={t("items.no")}
              >
                <Text style={styles.halfText}>{t("items.no")}</Text>
                <ChevronDown
                  size={16}
                  color={colors.ink}
                  style={{ transform: [{ rotate: menu === "no" ? "180deg" : "0deg" }] }}
                />
              </PressScale>
            </View>
            {choice === "looks_good" ? null : choice ? (
              <PressScale
                disabled={busy || !canContinue}
                onPress={() => {
                  stopEditing();
                  goAfterItems();
                }}
                style={[styles.continueBtn, (!canContinue || busy) && styles.continueDisabled]}
              >
                <Text style={styles.continueText}>{t("items.continueAfterEdit")}</Text>
              </PressScale>
            ) : null}
          </View>
        }
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
            highlightTrash={choice === "remove_items"}
            onEdit={() => {
              setMenu(null);
              setEditingId(item.id);
            }}
            onChange={(next) =>
              draft.setItems(draft.items.map((row) => (row.id === item.id ? next : row)))
            }
            onSoftDelete={() => softDelete(item.id)}
            onUndo={() => undo(item.id)}
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
            setMenu(null);
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
  qtyCol: { width: 44 },
  amtCol: { width: 64 },
  colLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.inkSoft,
    letterSpacing: 0.15,
    marginBottom: 2,
    textAlign: "left",
  },
  readName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
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
  halfText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  menu: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 14 },
  menuText: { fontSize: 14, fontWeight: "600", color: colors.ink, lineHeight: 20 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  continueBtn: {
    marginTop: 8,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.merlot,
    alignItems: "center",
    justifyContent: "center",
  },
  continueDisabled: { opacity: 0.4 },
  continueText: { color: colors.merlotFg, fontSize: 15, fontWeight: "700" },
});
