import { Stack } from "expo-router";
import { HostDraftProvider } from "@/context/host-draft";
import { colors } from "@/lib/theme";

export default function HostLayout() {
  return (
    <HostDraftProvider>
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
    </HostDraftProvider>
  );
}
