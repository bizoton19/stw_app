import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { VenueTypeahead } from "@/components/venue-typeahead";
import { useHostDraft } from "@/context/host-draft";
import { colors } from "@/lib/theme";

export default function HostRestaurant() {
  const router = useRouter();
  const draft = useHostDraft();
  // Require a Places pin with coords (map) — never continue on name/placeId alone.
  const placeLocked =
    draft.venue?.source === "places" &&
    typeof draft.venue.lat === "number" &&
    typeof draft.venue.lng === "number" &&
    Number.isFinite(draft.venue.lat) &&
    Number.isFinite(draft.venue.lng);

  return (
    <AppShell>
      <InterviewChrome
        step={3}
        total={8}
        kicker="The place"
        motif="label-band"
        title="Confirm the place on the check"
        onBack={() => router.back()}
        onHome={goHostDesk}
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
        supportTip
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
