import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, Trash2 } from "lucide-react-native";
import { AppShell, InterviewChrome, PrimaryButton, QuietButton } from "@/components/chrome";
import { PressScale } from "@/components/press-scale";
import { useHostDraft } from "@/context/host-draft";
import { t } from "@/lib/i18n";
import { centsToLabel } from "@/lib/money";
import { colors } from "@/lib/theme";

export default function HostItems() {
  const router = useRouter();
  const draft = useHostDraft();
  const subtotal = draft.items.reduce((s, i) => s + i.totalCents, 0);
  const [noOpen, setNoOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const listRef = useRef<View>(null);

  function onLooksGood() {
    setNoOpen(false);
    router.push("/host/fees");
  }

  function onInaccuracies() {
    setNoOpen(false);
    setHint(t("items.tipInaccuracies"));
  }

  function onNeedRemove() {
    setNoOpen(false);
    setHint(t("items.tipRemove"));
  }

  const canContinue =
    draft.items.length > 0 && !draft.items.some((i) => !i.name.trim() || i.qty < 1);

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
            {noOpen ? (
              <View style={styles.menu}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onInaccuracies}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuText}>{t("items.inaccuracies")}</Text>
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable
                  accessibilityRole="button"
                  onPress={onNeedRemove}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuText}>{t("items.needRemove")}</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.footerRow}>
              <PressScale
                onPress={() => setNoOpen((v) => !v)}
                style={styles.noBtn}
                accessibilityLabel={t("items.no")}
              >
                <Text style={styles.noText}>{t("items.no")}</Text>
                <ChevronDown
                  size={16}
                  color={colors.ink}
                  style={{ transform: [{ rotate: noOpen ? "180deg" : "0deg" }] }}
                />
              </PressScale>
              <View style={styles.looksWrap}>
                <PrimaryButton disabled={!canContinue} onPress={onLooksGood}>
                  {t("items.looksGood")}
                </PrimaryButton>
              </View>
            </View>
          </View>
        }
      >
        {hint ? (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}
        <View ref={listRef}>
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
                style={[styles.trash, hint ? styles.trashHighlight : null]}
              >
                <Trash2 size={13} color={hint ? colors.merlot : colors.inkSoft} />
              </PressScale>
            </View>
          ))}
        </View>
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
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  noBtn: {
    height: 48,
    minWidth: 88,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  noText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  looksWrap: { flex: 1 },
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
});
