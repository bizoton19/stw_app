import { Text } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { Field } from "@/components/field";
import { useHostDraft } from "@/context/host-draft";
import { colors } from "@/lib/theme";

export default function HostRestaurant() {
  const router = useRouter();
  const draft = useHostDraft();
  return (
    <AppShell>
      <InterviewChrome
        step={4}
        total={8}
        kicker="The place"
        title="What's the name on the check?"
        onBack={() => router.back()}
        keyboard
        footer={
          <PrimaryButton
            disabled={!draft.restaurant.trim()}
            onPress={() => router.push("/host/items")}
          >
            Continue
          </PrimaryButton>
        }
      >
        {draft.error ? (
          <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 16 }}>{draft.error}</Text>
        ) : null}
        <Field
          label="Restaurant or bar"
          value={draft.restaurant}
          onChangeText={draft.setRestaurant}
          placeholder="The Bar"
          autoCapitalize="words"
          autoComplete="organization"
        />
      </InterviewChrome>
    </AppShell>
  );
}
