import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function PressScale({
  children,
  disabled,
  haptic = true,
  style,
  onPress,
  ...props
}: PressableProps & {
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(event) => {
        if (haptic && Platform.OS !== "web") {
          void Haptics.selectionAsync();
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
