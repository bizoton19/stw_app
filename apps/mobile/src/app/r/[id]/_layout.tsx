import { Stack } from "expo-router";
import { ClaimFlowProvider } from "@/context/claim-flow";
import { nativeStackScreenOptions } from "@/lib/navigation";

export default function ReceiptLayout() {
  return (
    <ClaimFlowProvider>
      <Stack screenOptions={nativeStackScreenOptions} />
    </ClaimFlowProvider>
  );
}
