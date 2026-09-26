import { Stack } from "expo-router";
import { ClaimFlowProvider } from "@/context/claim-flow";
import { useGuestClaimBackLock } from "@/hooks/use-guest-claim-back-lock";
import { nativeStackScreenOptions } from "@/lib/navigation";

function GuestBackLock() {
  useGuestClaimBackLock();
  return null;
}

export default function ReceiptLayout() {
  return (
    <ClaimFlowProvider>
      <GuestBackLock />
      <Stack screenOptions={nativeStackScreenOptions} />
    </ClaimFlowProvider>
  );
}
