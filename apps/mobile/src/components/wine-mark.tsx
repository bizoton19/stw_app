import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/theme";

const TILT = "16deg";

/** Brand mark matching the app icon: merlot bottle, tilted, four jagged splits. */
export function WineMark({ size = 24 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessibilityRole="image">
      <View style={{ transform: [{ rotate: TILT }] }}>
        <BottleSvg size={size} />
      </View>
    </View>
  );
}

/**
 * Parsing / busy mark: jagged segments drift apart then snap back together.
 * Replaces the system spinner — no halo.
 */
export function WineMarkBusy({ size = 64 }: { size?: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 780, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 780, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    );
  }, [t]);

  const cork = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * t.value }, { rotate: TILT }],
  }));
  const seg1 = useAnimatedStyle(() => ({
    transform: [{ translateX: -5 * t.value }, { translateY: -2 * t.value }, { rotate: TILT }],
  }));
  const seg2 = useAnimatedStyle(() => ({
    transform: [{ translateX: 6 * t.value }, { translateY: 1 * t.value }, { rotate: TILT }],
  }));
  const seg3 = useAnimatedStyle(() => ({
    transform: [{ translateX: -6 * t.value }, { translateY: 3 * t.value }, { rotate: TILT }],
  }));
  const seg4 = useAnimatedStyle(() => ({
    transform: [{ translateX: 5 * t.value }, { translateY: 6 * t.value }, { rotate: TILT }],
  }));

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Reading the receipt"
    >
      <Animated.View style={[styles.layer, cork]}>
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M22.2 3.5h3.6v3.2h-3.6V3.5Z" fill={colors.merlot} />
          <Path d="M21.4 6.7h5.2v6.8h-5.2V6.7Z" fill={colors.merlot} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, seg1]}>
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M16.5 13.5h15v5.2l-2.2 1.1-2.4-1.3-2.6 1.4-2.5-1.2-2.3 1.2-3-1.2V13.5Z"
            fill={colors.merlot}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, seg2]}>
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M16.5 21.2l3 .9 2.3-1.1 2.5 1.2 2.6-1.3 2.4 1.2 2.2-1 0 5.4-2.1 1.1-2.5-1.2-2.5 1.3-2.6-1.2-2.4 1.1-2.9-1.1v-5.3Z"
            fill={colors.merlot}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, seg3]}>
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M16.5 28.8l2.9.9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.1-.9v5.5l-2 .9-2.6-1.1-2.5 1.2-2.6-1.2-2.4 1.1-2.9-.9v-5.4Z"
            fill={colors.merlot}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, seg4]}>
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d="M16.5 36.4l2.9.8 2.4-1 2.6 1.1 2.5-1.1 2.6 1.1 2-.8v5.2a3 3 0 0 1-3 3H19.5a3 3 0 0 1-3-3v-5.3Z"
            fill={colors.merlot}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

function BottleSvg({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path d="M22.2 3.5h3.6v3.2h-3.6V3.5Z" fill={colors.merlot} />
      <Path d="M21.4 6.7h5.2v6.8h-5.2V6.7Z" fill={colors.merlot} />
      <Path
        d="M16.5 13.5h15v5.2l-2.2 1.1-2.4-1.3-2.6 1.4-2.5-1.2-2.3 1.2-3-1.2V13.5Z"
        fill={colors.merlot}
      />
      <Path
        d="M16.5 21.2l3 .9 2.3-1.1 2.5 1.2 2.6-1.3 2.4 1.2 2.2-1 0 5.4-2.1 1.1-2.5-1.2-2.5 1.3-2.6-1.2-2.4 1.1-2.9-1.1v-5.3Z"
        fill={colors.merlot}
      />
      <Path
        d="M16.5 28.8l2.9.9 2.4-1.1 2.6 1.2 2.5-1.2 2.5 1.1 2.1-.9v5.5l-2 .9-2.6-1.1-2.5 1.2-2.6-1.2-2.4 1.1-2.9-.9v-5.4Z"
        fill={colors.merlot}
      />
      <Path
        d="M16.5 36.4l2.9.8 2.4-1 2.6 1.1 2.5-1.1 2.6 1.1 2-.8v5.2a3 3 0 0 1-3 3H19.5a3 3 0 0 1-3-3v-5.3Z"
        fill={colors.merlot}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
