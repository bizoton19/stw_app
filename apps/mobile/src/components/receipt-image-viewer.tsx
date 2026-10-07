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

// Reanimated shared values are updated in place.
/* eslint-disable react-hooks/immutability */

type ReceiptImageSheetProps = {
  visible: boolean;
  onClose: () => void;
} & (
  | { mode?: "receipt"; receiptId: string; uri?: undefined; title?: undefined }
  | { mode: "place"; uri: string | null; title: string; receiptId?: undefined }
);

export function ReceiptImageButton({
  receiptId,
  hasImage,
  onOpenChange,
}: {
  receiptId: string;
  hasImage?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!hasImage) return null;
  function setSheet(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }
  return (
    <>
      <PressScale haptic="select" onPress={() => setSheet(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>View tab photo</Text>
      </PressScale>
      <ReceiptImageSheet
        receiptId={receiptId}
        visible={open}
        onClose={() => setSheet(false)}
      />
    </>
  );
}

/**
 * Full-page paper sheet for one photo. Receipt mode can zoom and save.
 * Place mode is the same chrome, view only.
 */
export function ReceiptImageSheet(props: ReceiptImageSheetProps) {
  const { visible, onClose } = props;
  const placeView = props.mode === "place";
  const receiptId = placeView ? "" : props.receiptId;
  const uri = placeView ? (props.uri ?? "") : `${getApiUrl()}/api/receipts/${props.receiptId}/image`;
  const title = placeView ? props.title.trim() || "Place" : "Tab photo";
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
  const imageW = Math.max(220, winW - 32);
  const imageH = Math.max(220, winH - insets.top - insets.bottom - 148);

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
    if (placeView || sharing || !receiptId) return;
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
      if (!placeView && scale.value > 1.05) return;
      sheetTY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (!placeView && scale.value > 1.05) {
        sheetTY.value = withSpring(0, { damping: 22, stiffness: 280 });
        return;
      }
      if (e.translationY > DISMISS_Y || e.velocityY > 900) {
        sheetTY.value = withTiming(winH, { duration: 180 }, () => {
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

  const header = (
    <>
      <View style={styles.handle} accessibilityElementsHidden />
      <View style={styles.head}>
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {title}
        </Text>
        <Pressable accessibilityLabel="Close" onPress={close} hitSlop={14} style={styles.close}>
          <X size={22} color={colors.ink} strokeWidth={2.25} />
        </Pressable>
      </View>
    </>
  );

  const placeImage = uri ? (
    <View style={[styles.frame, styles.placeFrame, { width: imageW, height: imageH }]}>
      {/* Decorative. The sheet title names the place. */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image
        source={{ uri }}
        style={{ width: imageW, height: imageH }}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  ) : null;

  const receiptImage = (
    <GestureDetector gesture={imageGestures}>
      <Animated.View
        style={[styles.frame, { height: imageH, width: imageW }]}
        accessibilityLabel="Tab photo. Pinch to zoom, double-tap to zoom, hold to save."
      >
        <Animated.View style={[{ width: imageW, height: imageH }, imageStyle]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image source={{ uri }} style={{ width: imageW, height: imageH }} resizeMode="contain" />
        </Animated.View>
        {sharing ? (
          <View style={styles.sharingOverlay}>
            <ActivityIndicator color="#F6F4F1" />
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );

  return (
    <Modal
      visible={visible && (!placeView || Boolean(uri))}
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
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {placeView ? (
            <GestureDetector gesture={dismissPan}>
              <Animated.View style={styles.fill}>
                {header}
                <View style={styles.stage}>{placeImage}</View>
              </Animated.View>
            </GestureDetector>
          ) : (
            <>
              <GestureDetector gesture={dismissPan}>
                <Animated.View>{header}</Animated.View>
              </GestureDetector>
              <View style={styles.stage}>{receiptImage}</View>
            </>
          )}
          <Text style={styles.hint}>
            {placeView
              ? "Swipe down to close."
              : "Pinch or double-tap to zoom · Hold to save · Swipe handle to close"}
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
    backgroundColor: "rgba(42, 36, 28, 0.55)",
  },
  sheet: {
    flex: 1,
    height: "100%",
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
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
  fill: { flex: 1 },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    gap: 12,
    marginBottom: 12,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
  },
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
  },
  placeFrame: {
    borderRadius: 16,
    backgroundColor: colors.chrome,
  },
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
