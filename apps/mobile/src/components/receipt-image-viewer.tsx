import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
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
import { getApiUrl } from "@/lib/config";
import { hapticImpact } from "@/lib/haptics";
import { colors } from "@/lib/theme";

const DISMISS_Y = 120;

export function ReceiptImageButton({
  receiptId,
  hasImage,
}: {
  receiptId: string;
  hasImage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!hasImage) return null;
  return (
    <>
      <PressScale haptic="select" onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>View tab photo</Text>
      </PressScale>
      <ReceiptImageSheet
        receiptId={receiptId}
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Bottom sheet for the tab photo — swipe down or ✕ to close.
 * No download button; long-press the image to save/share via the system sheet.
 */
export function ReceiptImageSheet({
  receiptId,
  visible,
  onClose,
}: {
  receiptId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const [sharing, setSharing] = useState(false);
  const uri = `${getApiUrl()}/api/receipts/${receiptId}/image`;
  const imageH = Math.min(520, Math.max(280, winH * 0.55));

  useEffect(() => {
    if (!visible) translateY.value = 0;
  }, [visible, translateY]);

  function close() {
    onClose();
  }

  async function holdToSave() {
    if (sharing) return;
    setSharing(true);
    try {
      void hapticImpact("medium");
      const target = `${FileSystem.cacheDirectory ?? ""}tab-${receiptId}.jpg`;
      const result = await FileSystem.downloadAsync(uri, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "image/jpeg",
          dialogTitle: "Tab photo",
          UTI: "public.jpeg",
        });
      }
    } finally {
      setSharing(false);
    }
  }

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_Y || e.velocityY > 900) {
        translateY.value = withTiming(600, { duration: 180 }, () => {
          runOnJS(close)();
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
      transparent
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <GestureDetector gesture={pan}>
            <Animated.View>
              <View style={styles.handle} accessibilityElementsHidden />
              <View style={styles.head}>
                <Text style={styles.sheetTitle}>Tab photo</Text>
                <Pressable
                  accessibilityLabel="Close"
                  onPress={close}
                  hitSlop={14}
                  style={styles.close}
                >
                  <X size={22} color={colors.ink} strokeWidth={2.25} />
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>

          <Pressable
            onLongPress={() => void holdToSave()}
            delayLongPress={350}
            accessibilityLabel="Tab photo. Hold to save or share."
            accessibilityHint="Long press to save or share"
            style={[styles.frame, { height: imageH }]}
          >
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
            {sharing ? (
              <View style={styles.sharingOverlay}>
                <ActivityIndicator color="#F6F4F1" />
              </View>
            ) : null}
          </Pressable>

          <Text style={styles.hint}>
            Hold the photo to save it · Swipe down or tap ✕ to close
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** @deprecated Use ReceiptImageSheet */
export const ReceiptImageModal = ReceiptImageSheet;

const styles = StyleSheet.create({
  trigger: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
  },
  triggerText: { fontSize: 13, fontWeight: "700", color: colors.merlot },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(42, 36, 28, 0.55)",
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "92%",
    ...Platform.select({
      ios: {
        shadowColor: "#1A1510",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(42,36,28,0.18)",
    marginBottom: 10,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(42,36,28,0.06)",
  },
  frame: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1a1612",
    width: "100%",
  },
  image: { width: "100%", height: "100%" },
  sharingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26,22,18,0.45)",
  },
  hint: {
    marginTop: 12,
    marginBottom: 4,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.inkSoft,
  },
});
