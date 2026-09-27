import { StyleSheet, Text, View } from "react-native";
import { DoorOpen, Home, RotateCcw, Utensils } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

type Tab = {
  key: string;
  label: string;
  accessibilityLabel?: string;
  icon: "home" | "claims" | "close" | "reopen";
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

/**
 * Compact host live-board nav — icon + small label, shorter than stacked buttons.
 */
export function HostLiveTabBar({
  onHome,
  onClaims,
  closed,
  busy,
  onClose,
  onReopen,
}: {
  onHome: () => void;
  onClaims: () => void;
  closed: boolean;
  busy?: boolean;
  onClose: () => void;
  onReopen: () => void;
}) {
  const tabs: Tab[] = [
    {
      key: "home",
      label: "Home",
      accessibilityLabel: "Host desk",
      icon: "home",
      onPress: onHome,
    },
    {
      key: "claims",
      label: "My Claims",
      icon: "claims",
      onPress: onClaims,
    },
    closed
      ? {
          key: "reopen",
          label: "Reopen",
          accessibilityLabel: "Reopen claiming",
          icon: "reopen",
          onPress: onReopen,
          disabled: busy,
        }
      : {
          key: "close",
          label: "Close",
          accessibilityLabel: "Close claiming — leftovers on me",
          icon: "close",
          onPress: onClose,
          disabled: busy,
          danger: true,
        },
  ];

  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((tab) => (
        <PressScale
          key={tab.key}
          onPress={tab.onPress}
          disabled={tab.disabled}
          haptic="light"
          style={styles.tab}
          accessibilityLabel={tab.accessibilityLabel ?? tab.label}
          accessibilityRole="button"
        >
          <TabIcon name={tab.icon} danger={tab.danger} />
          <Text
            style={[styles.label, tab.danger && styles.labelDanger]}
            numberOfLines={1}
          >
            {tab.label}
          </Text>
        </PressScale>
      ))}
    </View>
  );
}

function TabIcon({
  name,
  danger,
}: {
  name: Tab["icon"];
  danger?: boolean;
}) {
  const color = danger ? colors.merlot : colors.ink;
  const size = 22;
  const stroke = 2.1;
  if (name === "home") return <Home size={size} color={color} strokeWidth={stroke} />;
  if (name === "claims") return <Utensils size={size} color={color} strokeWidth={stroke} />;
  if (name === "reopen") return <RotateCcw size={size} color={color} strokeWidth={stroke} />;
  return <DoorOpen size={size} color={color} strokeWidth={stroke} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-around",
    paddingTop: 6,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginHorizontal: -4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 52,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.inkSoft,
    letterSpacing: 0.1,
  },
  labelDanger: { color: colors.merlot },
});
