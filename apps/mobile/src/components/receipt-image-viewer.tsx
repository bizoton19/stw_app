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
const MIN_SCALE = 1;
const MAX_SCALE = 4;

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
 * Bottom sheet for the tab photo — swipe handle / ✕ to close.
 * Pinch or double-tap to zoom; long-press to save/share (no download button).
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
  const { height: winH, width: winW } = useWindowDimensions();
  const sheetTY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const [sharing, setSharing] = useState(false);
  const uri = `${getApiUrl()}/api/receipts/${receiptId}/image`;
  const imageH = Math.min(560, Math.max(300, winH * 0.58));

  function resetZoom() {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }

  useEffect(() => {
    if (!visible) {
      sheetTY.value = 0;
      resetZoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open/close
  }, [visible]);

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

  const dismissPan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      // Only dismiss when not zoomed in.
      if (scale.value > 1.05) return;
      sheetTY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (scale.value > 1.05) {
        sheetTY.value = withSpring(0, { damping: 22, stiffness: 280 });
        return;
      }
      if (e.translationY > DISMISS_Y || e.velocityY > 900) {
        sheetTY.value = withTiming(600, { duration: 180 }, () => {
          runOnJS(close)();
        });
      } else {
        sheetTY.value = withSpring(0, { damping: 22, stiffness: 280 });
      }
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const imagePan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1.02) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withSpring(2.4);
        savedScale.value = 2.4;
      }
    });

  const longPress = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      runOnJS(holdToSave)();
    });

  const imageGestures = Gesture.Simultaneous(
    pinch,
    imagePan,
    Gesture.Exclusive(doubleTap, longPress),
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTY.value }],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
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
          <GestureDetector gesture={dismissPan}>
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

          <GestureDetector gesture={imageGestures}>
            <Animated.View
              style={[styles.frame, { height: imageH, width: winW - 32 }]}
              accessibilityLabel="Tab photo. Pinch to zoom, double-tap to zoom, hold to save."
            >
              <Animated.View style={[styles.imageWrap, imageStyle]}>
                <Image source={{ uri }} style={styles.image} resizeMode="contain" />
              </Animated.View>
              {sharing ? (
                <View style={styles.sharingOverlay}>
                  <ActivityIndicator color="#F6F4F1" />
                </View>
              ) : null}
            </Animated.View>
          </GestureDetector>

          <Text style={styles.hint}>
            Pinch or double-tap to zoom · Hold to save · Swipe handle to close
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
    alignSelf: "center",
  },
  imageWrap: {
    width: "100%",
    height: "100%",
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
