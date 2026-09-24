import { Stack } from "expo-router";
import { HostDraftProvider } from "@/context/host-draft";
import { nativeStackScreenOptions } from "@/lib/navigation";

export default function HostLayout() {
  return (
    <HostDraftProvider>
      <Stack screenOptions={nativeStackScreenOptions} />
    </HostDraftProvider>
  );
}
