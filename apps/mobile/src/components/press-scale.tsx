import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { hapticImpact, hapticSelect } from "@/lib/haptics";

type HapticKind = false | "select" | "light" | "medium" | "heavy";

type StyleArg =
  | StyleProp<ViewStyle>
  | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

export function PressScale({
  children,
  disabled,
  /** Default off — enable only for meaningful actions. */
  haptic = false,
  /** When set, replaces the default opacity fade for disabled controls. */
  disabledStyle,
  style,
  onPress,
  ...props
}: PressableProps & {
  haptic?: HapticKind;
  style?: StyleArg;
  disabledStyle?: StyleProp<ViewStyle>;
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
        disabled ? (disabledStyle ?? { opacity: 0.35 }) : null,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
