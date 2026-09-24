import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { VenueTypeahead } from "@/components/venue-typeahead";
import { useHostDraft } from "@/context/host-draft";
import { isValidatedVenue } from "@/lib/venue-day";
import { colors } from "@/lib/theme";

export default function HostRestaurant() {
  const router = useRouter();
  const draft = useHostDraft();
  const placeLocked = isValidatedVenue(draft.venue);

  return (
    <AppShell>
      <InterviewChrome
        step={4}
        total={8}
        kicker="The place"
        title="Confirm the place on the check"
        onBack={() => router.back()}
        keyboard
        sparse={placeLocked}
        footer={
          <View>
            <FooterHint>
              {placeLocked
                ? "This place pins on the claim board for your guests."
                : draft.restaurant.trim()
                  ? "Pick a match from the list — we won’t continue until you tap one."
                  : "Start typing — nearby matches appear as you go."}
            </FooterHint>
            <PrimaryButton disabled={!placeLocked} onPress={() => router.push("/host/items")}>
              Continue
            </PrimaryButton>
          </View>
        }
      >
        {draft.error ? (
          <Text style={{ color: colors.danger, fontSize: 15, marginBottom: 16 }}>{draft.error}</Text>
        ) : null}
        <VenueTypeahead
          value={draft.restaurant}
          venue={draft.venue}
          receiptDate={draft.receiptDate}
          onChangeName={draft.setRestaurant}
          onChangeVenue={draft.setVenue}
        />
      </InterviewChrome>
    </AppShell>
  );
}
