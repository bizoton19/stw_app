import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, QuietButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { t } from "@/lib/i18n";
import { centsToLabel } from "@/lib/money";
import type { ParseReviewChoice } from "@/lib/types";
import { colors } from "@/lib/theme";

type MenuSide = "yes" | "no" | null;

export default function HostItems() {
  const router = useRouter();
  const draft = useHostDraft();
  const subtotal = draft.items.reduce((s, i) => s + i.totalCents, 0);
  const [menu, setMenu] = useState<MenuSide>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [choice, setChoice] = useState<ParseReviewChoice | null>(null);
  const [busy, setBusy] = useState(false);

  const canContinue =
    draft.items.length > 0 && !draft.items.some((i) => !i.name.trim() || i.qty < 1);

  async function applyChoice(next: ParseReviewChoice, opts?: { continue?: boolean }) {
    setMenu(null);
    setChoice(next);
    setBusy(true);
    try {
      await draft.recordParseReview(next);
      if (next === "remove_items") setHint(t("items.tipRemove"));
      else if (next === "needs_edits") setHint(t("items.tipInaccuracies"));
      else setHint(null);
      if (opts?.continue) router.push("/host/fees");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <InterviewChrome
        step={5}
        total={8}
        kicker={t("items.kicker")}
        title={t("items.title")}
        onBack={() => router.back()}
        keyboard
        dense
        footer={
          <View>
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
                onPress={() => setMenu((m) => (m === "yes" ? null : "yes"))}
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
                onPress={() => setMenu((m) => (m === "no" ? null : "no"))}
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
                onPress={() => router.push("/host/fees")}
                style={[styles.continueBtn, (!canContinue || busy) && styles.continueDisabled]}
              >
                <Text style={styles.continueText}>{t("items.continueAfterEdit")}</Text>
              </PressScale>
            ) : null}
          </View>
        }
      >
        {hint ? (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}
        {draft.items.length === 0 ? <Text style={styles.lead}>{t("items.empty")}</Text> : null}
        {draft.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.nameCol}>
              <Text style={styles.colLabel}>{t("items.nameLabel")}</Text>
              <TextInput
                value={item.name}
                placeholder={t("items.itemName")}
                placeholderTextColor={colors.muted}
                style={styles.nameInput}
                autoCorrect={false}
                onChangeText={(name) =>
                  draft.setItems(
                    draft.items.map((row) => (row.id === item.id ? { ...row, name } : row)),
                  )
                }
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
                  draft.setItems(
                    draft.items.map((row) => (row.id === item.id ? { ...row, qty } : row)),
                  );
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
                  draft.setItems(
                    draft.items.map((row) =>
                      row.id === item.id ? { ...row, totalInput, totalCents } : row,
                    ),
                  );
                }}
              />
            </View>
            <PressScale
              accessibilityLabel={t("items.remove", {
                name: item.name.trim() || t("items.line"),
              })}
              onPress={() => draft.setItems(draft.items.filter((row) => row.id !== item.id))}
              style={[styles.trash, choice === "remove_items" ? styles.trashHighlight : null]}
            >
              <Trash2
                size={13}
                color={choice === "remove_items" ? colors.merlot : colors.inkSoft}
              />
            </PressScale>
          </View>
        ))}
        <QuietButton
          onPress={() =>
            draft.setItems([
              ...draft.items,
              {
                id: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                name: "",
                qty: 1,
                totalCents: 0,
                totalInput: "0.00",
              },
            ])
          }
        >
          {t("items.addLine")}
        </QuietButton>
      </InterviewChrome>
    </AppShell>
  );
}

const INPUT_H = 30;

const styles = StyleSheet.create({
  lead: { fontSize: 12, color: colors.muted, marginBottom: 6 },
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
    alignItems: "flex-end",
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  nameCol: { flex: 1, minWidth: 0 },
  qtyCol: { width: 40 },
  amtCol: { width: 58 },
  colLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.inkSoft,
    letterSpacing: 0.15,
    marginBottom: 2,
    textAlign: "left",
  },
  nameInput: {
    height: INPUT_H,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "left",
  },
  numInput: {
    height: INPUT_H,
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    textAlign: "left",
  },
  trash: {
    width: 28,
    height: INPUT_H,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -2,
  },
  trashHighlight: {
    borderRadius: 6,
    backgroundColor: "rgba(110, 46, 53, 0.08)",
  },
  footNote: {
    textAlign: "center",
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
    fontVariant: ["tabular-nums"],
  },
  reviewLabel: {
    textAlign: "center",
    fontSize: 13,
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
