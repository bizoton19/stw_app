import { Tabs, useRouter } from "expo-router";
import { Home, Plus } from "lucide-react-native";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.merlot,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size ?? 22} color={color} strokeWidth={2.25} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.createIcon, focused && styles.createIconActive]}>
              <Plus size={22} color={focused ? colors.merlotFg : color} strokeWidth={2.5} />
            </View>
          ),
          tabBarButton: ({ style, children }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new receipt"
              onPress={() => router.push("/host")}
              style={[styles.createHit, style]}
            >
              {children}
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.paper,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
    height: Platform.OS === "ios" ? 84 : 64,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.15,
  },
  createHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFFcf8",
  },
  createIconActive: {
    backgroundColor: colors.merlot,
    borderColor: colors.merlot,
  },
});
