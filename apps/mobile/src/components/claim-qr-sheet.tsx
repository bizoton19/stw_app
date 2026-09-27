import { useEffect } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
import QRCode from "react-native-qrcode-svg";
import { X } from "lucide-react-native";
import * as Brightness from "expo-brightness";
import { colors } from "@/lib/theme";

const DISMISS_Y = 140;

/**
 * Full-screen bright claim QR — pass the phone around the table.
 * Swipe down or tap close to dismiss. Bumps screen brightness while open.
 */
export function ClaimQrSheet({
  visible,
  url,
  place,
  onClose,
}: {
  visible: boolean;
  url: string;
  place?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qrSize = Math.min(280, Math.max(200, width - 72));
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      translateY.value = 0;
      return;
    }
    let previous: number | null = null;
    let active = true;
    void (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (!active) return;
        await Brightness.setBrightnessAsync(1);
      } catch {
        /* Simulator / permission — white sheet is still bright enough */
      }
    })();
    return () => {
      active = false;
      if (previous == null) return;
      const restore = previous;
      void Brightness.setBrightnessAsync(restore).catch(() => undefined);
    };
  }, [visible, translateY]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_Y || e.velocityY > 900) {
        translateY.value = withTiming(600, { duration: 180 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 280 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              paddingTop: Platform.OS === "ios" ? 12 : Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.handle} accessibilityElementsHidden />
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.kicker}>Share QR</Text>
              <Text style={styles.title} numberOfLines={2}>
                {place?.trim() || "Tonight’s check"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={14}
              style={styles.close}
            >
              <X size={22} color={colors.ink} strokeWidth={2.25} />
            </Pressable>
          </View>

          <View style={styles.qrWrap}>
            <View style={styles.qrCard}>
              {url ? (
                <QRCode
                  value={url}
                  size={qrSize}
                  backgroundColor="#FFFFFF"
                  color="#1A1510"
                  ecl="M"
                />
              ) : null}
            </View>
          </View>

          <Text style={styles.hint}>
            Pass your phone — friends scan to claim what they ordered.
          </Text>
          <Text style={styles.swipeHint}>Swipe down to close</Text>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(42,36,28,0.18)",
    marginBottom: 12,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  headText: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(42,36,28,0.06)",
  },
  qrWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qrCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(42,36,28,0.08)",
  },
  hint: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  swipeHint: {
    textAlign: "center",
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: 8,
  },
});
