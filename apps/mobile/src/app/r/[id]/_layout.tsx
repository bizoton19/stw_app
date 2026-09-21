import { Stack } from "expo-router";
import { ClaimFlowProvider } from "@/context/claim-flow";
import { colors } from "@/lib/theme";

export default function ReceiptLayout() {
  return (
    <ClaimFlowProvider>
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
    </ClaimFlowProvider>
  );
}
