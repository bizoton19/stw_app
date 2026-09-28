import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { PressScale } from "@/components/press-scale";
import {
  requestAgentTurn,
  type AgentCard,
  type AgentSnapshot,
} from "@/lib/agent-api";
import { hapticImpact } from "@/lib/haptics";
import { colors, space } from "@/lib/theme";

const DISMISS_Y = 120;

export function HostAgentSheet({
  visible,
  onClose,
  receiptId,
  hostToken,
  snapshot,
  onApplyCards,
}: {
  visible: boolean;
  onClose: () => void;
  receiptId: string;
  hostToken: string | null;
  snapshot: AgentSnapshot;
  onApplyCards: (cards: AgentCard[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const sheetTY = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cards, setCards] = useState<AgentCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compose, setCompose] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (userMessage?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await requestAgentTurn({
          receiptId,
          hostToken,
          snapshot,
          message: userMessage,
        });
        setMessage(res.message);
        setCards(res.cards);
        setSelected(new Set(res.cards.map((c) => c.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "request_failed");
      } finally {
        setBusy(false);
      }
    },
    [hostToken, receiptId, snapshot],
  );

  useEffect(() => {
    if (!visible) {
      sheetTY.value = 0;
      setCompose("");
      setError(null);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when opened
  }, [visible]);

  function close() {
    onClose();
  }

  function toggleCard(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    const chosen = cards.filter((c) => selected.has(c.id));
    if (chosen.length) {
      void hapticImpact("medium");
      onApplyCards(chosen);
    }
    close();
  }

  const dismissPan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      sheetTY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_Y || e.velocityY > 900) {
        sheetTY.value = withTiming(600, { duration: 180 }, () => {
          runOnJS(close)();
        });
      } else {
        sheetTY.value = withSpring(0, { damping: 22, stiffness: 280 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTY.value }],
  }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          <GestureDetector gesture={dismissPan}>
            <Animated.View
              style={[
                styles.sheet,
                sheetStyle,
                { paddingBottom: Math.max(insets.bottom, 16) },
              ]}
            >
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.agentLabel}>Assistant</Text>
                <PressScale onPress={close} accessibilityLabel="Close" style={styles.closeBtn}>
                  <X size={18} color={colors.inkSoft} />
                </PressScale>
              </View>

              {busy && !message ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.merlot} />
                </View>
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                >
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  {message ? <Text style={styles.copy}>{message}</Text> : null}
                  {cards.map((card) => {
                    const on = selected.has(card.id);
                    return (
                      <Pressable
                        key={card.id}
                        onPress={() => toggleCard(card.id)}
                        style={[styles.card, on ? styles.cardOn : null]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                      >
                        <Text style={styles.cardTitle}>{card.title}</Text>
                        <Text style={styles.cardDetail}>{card.detail}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.actions}>
                <PressScale onPress={close} style={styles.btnGhost}>
                  <Text style={styles.btnGhostText}>Edit list</Text>
                </PressScale>
                <PressScale
                  onPress={apply}
                  disabled={busy || selected.size === 0}
                  style={[styles.btnPrimary, selected.size === 0 ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnPrimaryText}>Apply</Text>
                </PressScale>
              </View>

              <View style={styles.compose}>
                <TextInput
                  value={compose}
                  onChangeText={setCompose}
                  placeholder="Ask about tip, tax, or a line…"
                  placeholderTextColor={colors.muted}
                  style={styles.composeInput}
                  editable={!busy}
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    const text = compose.trim();
                    if (!text || busy) return;
                    setCompose("");
                    void load(text);
                  }}
                />
                <PressScale
                  disabled={busy || !compose.trim()}
                  onPress={() => {
                    const text = compose.trim();
                    if (!text) return;
                    setCompose("");
                    void load(text);
                  }}
                  style={styles.sendBtn}
                  accessibilityLabel="Send"
                >
                  <Text style={styles.sendText}>↑</Text>
                </PressScale>
              </View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(42, 36, 28, 0.35)",
  },
  keyboard: { width: "100%" },
  sheet: {
    backgroundColor: "#FFFCFA",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxHeight: "78%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  agentLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.merlot,
    letterSpacing: 0.2,
  },
  closeBtn: { padding: 6 },
  loading: { paddingVertical: 36, alignItems: "center" },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: space.sm, gap: space.sm },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    marginBottom: space.sm,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: space.sm,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: space.md,
    backgroundColor: "#fff",
  },
  cardOn: {
    borderColor: colors.merlot,
    backgroundColor: "rgba(110, 46, 53, 0.06)",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 2,
  },
  cardDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkSoft,
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
  },
  btnGhost: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnGhostText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  btnPrimary: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.merlot,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnPrimaryText: { fontSize: 13, fontWeight: "600", color: colors.merlotFg },
  compose: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
  },
  composeInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    backgroundColor: "#fff",
    fontSize: 13,
    color: colors.ink,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
