import { useRouter } from "expo-router";
import { Text } from "react-native";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { colors } from "@/lib/theme";

export default function HostReady() {
  const router = useRouter();
  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={8}
        kicker="Fair split"
        title="Got the check in front of you?"
        onBack={() => router.back()}
        footer={
          <PrimaryButton onPress={() => router.push("/host/capture")}>
            Yes — start with the receipt
          </PrimaryButton>
        }
      >
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted }}>
          One photo, a short review, then a link. Whole glasses only — no splitting a pour in
          half.
        </Text>
      </InterviewChrome>
    </AppShell>
  );
}
