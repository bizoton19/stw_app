import { Tabs } from "expo-router";

/**
 * Host desk lives at `(tabs)/index`. Create is a button on that screen —
 * the old Receipts tab did nothing while already on home.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="create" options={{ href: null }} />
    </Tabs>
  );
}
