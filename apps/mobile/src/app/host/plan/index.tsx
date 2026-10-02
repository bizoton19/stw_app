import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { OutingWhenPicker } from "@/components/outing-when-picker";
import { VenueTypeahead } from "@/components/venue-typeahead";
import { createPlanOuting } from "@/lib/api";
import { rememberHostedReceipt } from "@/lib/host-tabs";
import { publicClaimUrl } from "@/lib/config";
import { saveHostToken } from "@/lib/session";
import { venueLocationKey } from "@/lib/venue-day";
import type { ReceiptVenue } from "@/lib/types";
import { colors } from "@/lib/theme";

function defaultNight(): Date {
  const d = new Date();
  d.setHours(19, 30, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

export default function HostPlanOuting() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState("");
  const [venue, setVenue] = useState<ReceiptVenue | null>(null);
  const [night, setNight] = useState(defaultNight);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeLocked =
    venue?.source === "places" &&
    typeof venue.lat === "number" &&
    typeof venue.lng === "number" &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lng);

  const nightAt = night.toISOString();

  async function create() {
    if (!placeLocked || !venue) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createPlanOuting({
        venue,
        nightAt,
        note: note.trim() || null,
      });
      await saveHostToken(created.receiptId, created.hostToken);
      const claimUrl = publicClaimUrl(created.receiptId);
      await rememberHostedReceipt({
        id: created.receiptId,
        restaurant: venue.name,
        claimUrl,
        updatedAt: new Date().toISOString(),
        placeKey: venueLocationKey(venue, venue.name) ?? undefined,
        receiptDay: nightAt.slice(0, 10),
        status: "planning",
        venueLat: venue.lat,
        venueLng: venue.lng,
        venueCategory: venue.category,
      });
      router.replace(`/host/plan/${created.receiptId}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Couldn't create the outing. Check your connection and try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={3}
        kicker="Plan an outing"
        title="Where are you going?"
        onBack={() => router.back()}
        onHome={goHostDesk}
        keyboard
        footer={
          <View>
            <FooterHint>Share a link before the check — friends can RSVP now.</FooterHint>
            <PrimaryButton
              busy={busy}
              disabled={!placeLocked}
              onPress={() => void create()}
            >
              Create outing link
            </PrimaryButton>
          </View>
        }
        supportTip
      >
        {error ? (
          <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <OutingWhenPicker value={night} onChange={setNight} />
        <VenueTypeahead
          value={restaurant}
          venue={venue}
          onChangeName={setRestaurant}
          onChangeVenue={setVenue}
        />
        <Text style={styles.label}>Note for the group (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="I’m putting the card down"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.note]}
          multiline
        />
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  note: { height: 80, paddingTop: 12, textAlignVertical: "top" },
});
