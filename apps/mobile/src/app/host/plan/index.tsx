import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { goHostDesk } from "@/lib/navigation";
import { AppShell, FooterHint, InterviewChrome, PrimaryButton } from "@/components/chrome";
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar day YYYY-MM-DD (not UTC). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function HostPlanOuting() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState("");
  const [venue, setVenue] = useState<ReceiptVenue | null>(null);
  const [night, setNight] = useState(defaultNight);
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [note, setNote] = useState("");
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

  const whenLabel = useMemo(
    () =>
      night.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [night],
  );

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setPickerMode(null);
      if (event.type !== "set" || !selected) return;
    }
    if (!selected) return;
    setNight((prev) => {
      const next = new Date(prev);
      if (pickerMode === "date") {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return next;
    });
  }

  async function create() {
    if (!placeLocked || !venue) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createPlanOuting({
        venue,
        nightAt,
        receiptDate,
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
        footer={
          <View>
            <FooterHint>Share a link before the check — friends can RSVP now.</FooterHint>
            <PrimaryButton busy={busy} disabled={!placeLocked} onPress={() => void create()}>
              Create outing link
            </PrimaryButton>
          </View>
        }
        supportTip
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
        <Text style={styles.label}>When</Text>
        <View style={styles.whenRow}>
          <Pressable
            onPress={() => setPickerMode("date")}
            style={[styles.whenChip, { flex: 1.2 }]}
          >
            <Text style={styles.whenChipText}>
              {night.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPickerMode("time")}
            style={[styles.whenChip, { flex: 1 }]}
          >
            <Text style={styles.whenChipText}>
              {night.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{whenLabel}</Text>
        {pickerMode ? (
          <DateTimePicker
            value={night}
            mode={pickerMode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onPickerChange}
            minimumDate={pickerMode === "date" ? new Date() : undefined}
          />
        ) : null}
        {Platform.OS === "ios" && pickerMode ? (
          <Pressable onPress={() => setPickerMode(null)} style={styles.donePicker}>
            <Text style={styles.donePickerText}>Done</Text>
          </Pressable>
        ) : null}
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
  hint: { fontSize: 12, color: colors.muted, marginBottom: 4, marginTop: 6 },
  whenRow: { flexDirection: "row", gap: 8 },
  whenChip: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  whenChipText: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  donePicker: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 4 },
  donePickerText: { fontSize: 15, fontWeight: "700", color: colors.merlot },
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
