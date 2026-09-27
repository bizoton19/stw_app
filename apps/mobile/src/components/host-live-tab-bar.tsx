import { StyleSheet, Text, View } from "react-native";
import { DoorOpen, Home, LayoutList, RotateCcw, Trash2, Utensils } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { PressScale } from "./press-scale";

type Tab = {
  key: string;
  label: string;
  accessibilityLabel?: string;
  icon: "home" | "claims" | "live" | "close" | "reopen" | "delete";
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

/**
 * Compact host live-board nav — icon + small label, shorter than stacked buttons.
 * On the claims screen (`mode="claims"`), the middle tab returns to the live board.
 */
export function HostLiveTabBar({
  onHome,
  onClaims,
  onLiveBoard,
  mode = "live",
  closed,
  busy,
  onClose,
  onReopen,
  onDelete,
}: {
  onHome: () => void;
  onClaims: () => void;
  /** When `mode` is claims, middle tab uses this to return to the live board. */
  onLiveBoard?: () => void;
  mode?: "live" | "claims";
  closed: boolean;
  busy?: boolean;
  onClose: () => void;
  onReopen: () => void;
  /** Shown next to Reopen when the tab is closed. */
  onDelete?: () => void;
}) {
  const middle: Tab =
    mode === "claims"
      ? {
          key: "live",
          label: "Live board",
          accessibilityLabel: "Live board",
          icon: "live",
          onPress: onLiveBoard ?? onClaims,
        }
      : {
          key: "claims",
          label: "My Claims",
          icon: "claims",
          onPress: onClaims,
        };

  const tabs: Tab[] = [
    {
      key: "home",
      label: "Home",
      accessibilityLabel: "Host desk",
      icon: "home",
      onPress: onHome,
    },
    middle,
  ];

  if (closed) {
    tabs.push({
      key: "reopen",
      label: "Reopen",
      accessibilityLabel: "Reopen claiming",
      icon: "reopen",
      onPress: onReopen,
      disabled: busy,
    });
    if (onDelete) {
      tabs.push({
        key: "delete",
        label: "Delete",
        accessibilityLabel: "Delete closed tab",
        icon: "delete",
        onPress: onDelete,
        disabled: busy,
        danger: true,
      });
    }
  } else {
    tabs.push({
      key: "close",
      label: "Close tab",
      accessibilityLabel: "Close tab — leftovers on me",
      icon: "close",
      onPress: onClose,
      disabled: busy,
      danger: true,
    });
  }

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
  if (name === "live") return <LayoutList size={size} color={color} strokeWidth={stroke} />;
  if (name === "reopen") return <RotateCcw size={size} color={color} strokeWidth={stroke} />;
  if (name === "delete") return <Trash2 size={size} color={color} strokeWidth={stroke} />;
  return <DoorOpen size={size} color={color} strokeWidth={stroke} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-around",
    marginHorizontal: -20,
    marginBottom: -4,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#EDE8E1",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D4CDC3",
    // Soft lift so it reads as chrome, not page content.
    shadowColor: "#2A241C",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
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
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: 0.1,
  },
  labelDanger: { color: colors.merlot },
});
