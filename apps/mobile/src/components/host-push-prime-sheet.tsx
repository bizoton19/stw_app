import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { PrimaryButton } from "@/components/chrome";
import { HOST_PUSH_PRIME_COPY } from "@/lib/host-push-prime-policy";
import { colors } from "@/lib/theme";

export type PrimeSheetCopy = {
  title: string;
  body: string;
  primary: string;
  secondary: string;
};

const DISMISS_Y = 120;

// Reanimated shared values are updated in place.
/* eslint-disable react-hooks/immutability */

/**
 * Soft paper card. Same family as the host-reach country sheet:
 * transparent modal, slide, 16pt top radius, flex-end. Ink scrim, no blur.
 */
export function HostPushPrimeSheet({
  visible,
  variant,
  busy,
  onPrimary,
  onDismiss,
  icon,
  copy: copyOverride,
}: {
  visible: boolean;
  variant: "undetermined" | "denied";
  busy: boolean;
  onPrimary: () => void;
  onDismiss: () => void;
  /** Defaults to the notification Bell. Location passes MapPin. */
  icon?: ReactNode;
  /** Defaults to the notification copy for `variant`. */
  copy?: PrimeSheetCopy;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const copy = copyOverride ?? HOST_PUSH_PRIME_COPY[variant];

  useEffect(() => {
    if (!visible) translateY.value = 0;
  }, [translateY, visible]);

  function dismiss() {
    if (busy) return;
    onDismiss();
  }

  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_Y || e.velocityY > 900) {
        translateY.value = withTiming(480, { duration: 180 }, () => {
          runOnJS(dismiss)();
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
      transparent
      animationType="slide"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityLabel={copy.secondary}
        />
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.handle} accessibilityElementsHidden />
            <View style={styles.icon} accessibilityElementsHidden>
              {icon ?? <Bell size={30} color={colors.inkSoft} strokeWidth={2} />}
            </View>
            <Text allowFontScaling style={styles.title}>
              {copy.title}
            </Text>
            <Text allowFontScaling style={styles.body}>
              {copy.body}
            </Text>
            <PrimaryButton busy={busy} onPress={onPrimary}>
              {copy.primary}
            </PrimaryButton>
            <Pressable
              accessibilityRole="button"
              onPress={dismiss}
              disabled={busy}
              style={styles.notNow}
            >
              <Text allowFontScaling style={styles.notNowText}>
                {copy.secondary}
              </Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(42, 36, 28, 0.55)",
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(42,36,28,0.18)",
    marginBottom: 18,
  },
  icon: {
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  body: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    marginBottom: 20,
  },
  notNow: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  notNowText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.inkSoft,
  },
});
