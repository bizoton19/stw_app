import { useEffect } from "react";
import {
  Image,
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
import { X } from "lucide-react-native";
import { colors } from "@/lib/theme";

const DISMISS_Y = 120;

// Reanimated shared values are updated in place. The immutability rule treats that as a hook mutation.
/* eslint-disable react-hooks/immutability */

/**
 * Matte paper sheet for one nearby photo. Same chrome as the tab-photo sheet:
 * handle, close, ink scrim, swipe down. No zoom and no save.
 */
export function PlacePhotoSheet({
  visible,
  uri,
  title,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  title: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const imageW = Math.max(220, winW - 32);
  const imageH = Math.min(560, Math.max(300, Math.round(winH * 0.58)));

  useEffect(() => {
    if (!visible) translateY.value = 0;
  }, [visible, translateY]);

  const dismissPan = Gesture.Pan()
    .activeOffsetY(8)
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
      visible={visible && Boolean(uri)}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <GestureDetector gesture={dismissPan}>
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.handle} accessibilityElementsHidden />
            <View style={styles.head}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {title}
              </Text>
              <Pressable
                accessibilityLabel="Close"
                onPress={onClose}
                hitSlop={14}
                style={styles.close}
              >
                <X size={22} color={colors.ink} strokeWidth={2.25} />
              </Pressable>
            </View>
            {uri ? (
              <View style={[styles.frame, { width: imageW, height: imageH }]}>
                {/* Decorative. The sheet title names the place. */}
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  source={{ uri }}
                  style={{ width: imageW, height: imageH }}
                  resizeMode="contain"
                  accessible={false}
                />
              </View>
            ) : null}
            <Text style={styles.hint}>Swipe down to close.</Text>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    gap: 12,
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
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.chrome,
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
