import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { hapticImpact, hapticSelect } from "@/lib/haptics";

type HapticKind = false | "select" | "light" | "medium" | "heavy";

export function PressScale({
  children,
  disabled,
  /** Default off — enable only for meaningful actions. */
  haptic = false,
  style,
  onPress,
  ...props
}: PressableProps & {
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(event) => {
        if (haptic && !disabled) {
          if (haptic === "select") void hapticSelect();
          else if (haptic === "light" || haptic === "medium" || haptic === "heavy") {
            void hapticImpact(haptic);
          }
        }
        onPress?.(event);
      }}
      style={({ pressed }) => [
        { transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] },
        disabled ? { opacity: 0.35 } : null,
        style,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
