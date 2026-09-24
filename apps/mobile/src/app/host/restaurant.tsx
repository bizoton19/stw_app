import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { VenueTypeahead } from "@/components/venue-typeahead";
import { useHostDraft } from "@/context/host-draft";
import { colors } from "@/lib/theme";

export default function HostRestaurant() {
  const router = useRouter();
  const draft = useHostDraft();
  const placeLocked = draft.venue?.source === "places" && Boolean(draft.venue.name.trim());

  return (
    <AppShell>
      <InterviewChrome
        step={4}
        total={8}
        kicker="The place"
        title="What's the name on the check?"
        onBack={() => router.back()}
        keyboard
        sparse={placeLocked}
        footer={
          <View>
            <FooterHint>
              {placeLocked
                ? "This place pins on the claim board for your guests."
                : draft.restaurant.trim()
                  ? "Matching the name from your receipt…"
                  : "Start typing — nearby matches appear as you go."}
            </FooterHint>
            <PrimaryButton
              disabled={!draft.restaurant.trim()}
              onPress={() => router.push("/host/items")}
            >
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
