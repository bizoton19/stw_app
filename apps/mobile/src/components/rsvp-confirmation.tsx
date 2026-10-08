import { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton, QuietButton } from "@/components/chrome";
import { HostMessage } from "@/components/host-message";
import { getApiUrl } from "@/lib/config";
import { hostNoteText } from "@/lib/host-pay";
import {
  HOST_REACH_LABEL,
  directionsUrl,
  hostReachUrl,
  openDirections,
  openHostReach,
} from "@/lib/host-reach";
import { staticMapForClient } from "@/lib/nearby-places";
import type { PublicReceipt } from "@/lib/types";
import { colors } from "@/lib/theme";

export type RsvpResponse = "going" | "maybe" | "cant";

function formatWhen(nightAt: string | null | undefined): { date: string; time: string } | null {
  if (!nightAt) return null;
  const d = new Date(nightAt);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function headline(response: RsvpResponse): string {
  switch (response) {
    case "going":
      return "You're in";
    case "maybe":
      return "Maybe";
    case "cant":
      return "Can't make it";
  }
}

function subtitle(response: RsvpResponse): string {
  switch (response) {
    case "going":
      return "Claim opens when the host uploads the check.";
    case "maybe":
    case "cant":
      return "You can change this anytime.";
  }
}

type Props = {
  receipt: PublicReceipt;
  response: RsvpResponse;
  busy?: boolean;
  onChangeRsvp: () => void;
};

export function RsvpConfirmation({ receipt, response, busy, onChangeRsvp }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mapFailed, setMapFailed] = useState(false);
  const venue = receipt.venue;
  const lat = venue?.lat;
  const lng = venue?.lng;
  const when = formatWhen(receipt.nightAt);
  const place = receipt.restaurant?.trim() || "Your outing";
  const note = hostNoteText(receipt.hostInfo);
  const reach = receipt.hostInfo?.reach ?? null;

  const mapUri = useMemo(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return staticMapForClient(lat, lng, getApiUrl());
  }, [lat, lng]);

  const canDirections = Boolean(
    directionsUrl({
      lat,
      lng,
      name: place,
      googleMapsUri: venue?.googleMapsUri,
    }),
  );

  const reachHref = reach ? hostReachUrl(reach) : null;
  const heroMin = Math.min(Math.max(height * 0.42, 280), 400);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
      bounces
    >
      <View style={[styles.hero, { minHeight: heroMin }]}>
        {mapUri && !mapFailed ? (
          <Image
            source={{ uri: mapUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setMapFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
        )}
        <View style={styles.scrim} />
        <View style={styles.heroContent}>
          <Text style={styles.headline}>{headline(response)}</Text>
          <Text style={styles.place} numberOfLines={2}>
            {place}
          </Text>
          {when ? (
            <View style={styles.whenBlock}>
              <Text style={styles.date}>{when.date}</Text>
              <Text style={styles.time}>{when.time}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.sub}>{subtitle(response)}</Text>
        <HostMessage note={note} />
        {canDirections ? (
          <PrimaryButton
            onPress={() =>
              openDirections({ lat, lng, name: place, googleMapsUri: venue?.googleMapsUri })
            }
          >
            Get directions
          </PrimaryButton>
        ) : null}
        {reach && reachHref ? (
          canDirections ? (
            <QuietButton onPress={() => openHostReach(reach)}>
              {`Contact host · ${HOST_REACH_LABEL[reach.channel]}`}
            </QuietButton>
          ) : (
            <PrimaryButton onPress={() => openHostReach(reach)}>
              {`Contact host · ${HOST_REACH_LABEL[reach.channel]}`}
            </PrimaryButton>
          )
        ) : null}
        <QuietButton busy={busy} onPress={onChangeRsvp}>
          Change RSVP
        </QuietButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { width: "100%", overflow: "hidden", justifyContent: "flex-end" },
  heroFallback: { backgroundColor: colors.inkSoft },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(42, 36, 28, 0.52)",
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 48,
  },
  headline: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: "rgba(255, 252, 248, 0.9)",
    marginBottom: 6,
  },
  place: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
    color: "#FFFcf8",
    marginBottom: 16,
  },
  whenBlock: { gap: 2 },
  date: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255, 252, 248, 0.88)",
    fontVariant: ["tabular-nums"],
  },
  time: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: "#FFFcf8",
    fontVariant: ["tabular-nums"],
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: 4,
  },
});
