import { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goHostDesk } from "@/lib/navigation";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { HostSupportTip } from "@/components/host-support-tip";
import { OutingWhenPicker } from "@/components/outing-when-picker";
import { buildHostReach, defaultDialCountry, HostReachFields } from "@/components/host-reach-fields";
import { VenueTypeahead } from "@/components/venue-typeahead";
import { createPlanOuting } from "@/lib/api";
import { rememberHostedReceipt } from "@/lib/host-tabs";
import { publicClaimUrl } from "@/lib/config";
import type { DialCountry } from "@/lib/phone";
import { saveHostToken } from "@/lib/session";
import { venueLocationKey } from "@/lib/venue-day";
import type { HostReachChannel, ReceiptVenue } from "@/lib/types";
import { colors } from "@/lib/theme";

function defaultNight(): Date {
  const d = new Date();
  d.setHours(19, 30, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar day YYYY-MM-DD (not UTC). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function HostPlanOuting() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [restaurant, setRestaurant] = useState("");
  const [venue, setVenue] = useState<ReceiptVenue | null>(null);
  const [night, setNight] = useState(defaultNight);
  const [note, setNote] = useState("");
  const [reachChannel, setReachChannel] = useState<HostReachChannel>(
    Platform.OS === "ios" ? "imessage" : "sms",
  );
  const [reachValue, setReachValue] = useState("");
  const [reachCountry, setReachCountry] = useState<DialCountry>(defaultDialCountry);
  const [reachError, setReachError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeLocked =
    venue?.source === "places" &&
    typeof venue.lat === "number" &&
    typeof venue.lng === "number" &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lng);

  const nightAt = useMemo(() => night.toISOString(), [night]);
  const receiptDate = useMemo(() => localDayKey(night), [night]);

  async function create() {
    if (!placeLocked || !venue) return;
    setBusy(true);
    setError(null);
    setReachError(null);
    try {
      const trimmedNote = note.trim();
      const reachCheck = buildHostReach(reachChannel, reachValue, reachCountry);
      if (!reachCheck.ok) {
        setReachError(reachCheck.message);
        setBusy(false);
        return;
      }
      const hostInfo =
        trimmedNote || reachCheck.reach
          ? {
              payments: [] as const,
              ...(trimmedNote ? { note: trimmedNote } : {}),
              ...(reachCheck.reach ? { reach: reachCheck.reach } : {}),
            }
          : undefined;

      const created = await createPlanOuting({
        venue,
        nightAt,
        receiptDate,
        note: trimmedNote || null,
        hostInfo,
      });
      await saveHostToken(created.receiptId, created.hostToken);
      const claimUrl = publicClaimUrl(created.receiptId);
      await rememberHostedReceipt({
        id: created.receiptId,
        restaurant: venue.name,
        claimUrl,
        updatedAt: new Date().toISOString(),
        placeKey: venueLocationKey(venue, venue.name) ?? undefined,
        receiptDay: receiptDate,
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
        total={2}
        hideProgress
        kicker="Plan an outing"
        motif="coupe-pair"
        title="Where are you going?"
        onBack={() => router.back()}
        onHome={goHostDesk}
        keyboard
      >
        {error ? (
          <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <VenueTypeahead
          value={restaurant}
          venue={venue}
          receiptDate={receiptDate}
          onChangeName={setRestaurant}
          onChangeVenue={setVenue}
        />
        {placeLocked ? (
          <>
            <OutingWhenPicker value={night} onChange={setNight} />
            <Text style={styles.label}>Note for the group (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="I’m putting the card down"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.note]}
              multiline
            />
            <HostReachFields
              channel={reachChannel}
              value={reachValue}
              country={reachCountry}
              onChangeChannel={setReachChannel}
              onChangeValue={(v) => {
                setReachValue(v);
                setReachError(null);
              }}
              onChangeCountry={setReachCountry}
              error={reachError}
            />
            <View style={[styles.create, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <FooterHint>Share a link before the check — friends can RSVP now.</FooterHint>
              <PrimaryButton busy={busy} onPress={() => void create()}>
                Create outing link
              </PrimaryButton>
              <HostSupportTip />
            </View>
          </>
        ) : null}
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
  create: { marginTop: 22, gap: 8 },
});
