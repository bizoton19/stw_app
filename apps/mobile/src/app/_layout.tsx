import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { hydrateApiUrl } from "@/lib/config";
import { refreshLocaleFromDevice } from "@/lib/i18n";
import { hydrateSession } from "@/lib/session";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    void (async () => {
      refreshLocaleFromDevice();
      await hydrateApiUrl();
      await hydrateSession();
    })();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshLocaleFromDevice();
    });
    return () => sub.remove();
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
