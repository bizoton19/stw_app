import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { hydrateApiUrl } from "@/lib/config";
import { hydrateSession } from "@/lib/session";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    void (async () => {
      await hydrateApiUrl();
      await hydrateSession();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animationDuration: 320,
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
