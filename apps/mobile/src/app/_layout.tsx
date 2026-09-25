import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ShareIntentProvider } from "expo-share-intent";
import { ShareIntentGate } from "@/components/share-intent-gate";
import { useClaimPushNavigation } from "@/hooks/use-claim-push-navigation";
import { colors } from "@/lib/theme";
import { hydrateApiUrl } from "@/lib/config";
import { refreshLocaleFromDevice } from "@/lib/i18n";
import { nativeStackScreenOptions } from "@/lib/navigation";
import { hydrateSession } from "@/lib/session";
import { useEffect } from "react";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useClaimPushNavigation();

  useEffect(() => {
    void (async () => {
      refreshLocaleFromDevice();
      await hydrateApiUrl();
      await hydrateSession();
      await SplashScreen.hideAsync().catch(() => {});
    })();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshLocaleFromDevice();
    });
    return () => sub.remove();
  }, []);

  return (
    <ShareIntentProvider
      options={{
        debug: false,
        resetOnBackground: true,
      }}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <ShareIntentGate />
          <Stack screenOptions={nativeStackScreenOptions} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
