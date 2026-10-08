import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { hapticImpact, hapticSelect } from "@/lib/haptics";
import { pressAccessibilityState } from "@/lib/press-accessibility";

type HapticKind = false | "select" | "light" | "medium" | "heavy";

export function PressScale({
  children,
  disabled,
  busy,
  /** Default off — enable only for meaningful actions. */
  haptic = false,
  style,
  onPress,
  accessibilityState,
  ...props
}: PressableProps & {
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  /** In-flight. Reported to VoiceOver even when the label has become a spinner. */
  busy?: boolean;
}) {
  return (
    <Pressable
      {...props}
      accessibilityRole={props.accessibilityRole ?? "button"}
      accessibilityState={pressAccessibilityState(accessibilityState, disabled, busy)}
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
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
