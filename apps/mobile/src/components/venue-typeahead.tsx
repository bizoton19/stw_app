import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { Field } from "@/components/field";
import { HostLocationPrime } from "@/components/host-location-prime";
import { NearbyPlaceCards } from "@/components/nearby-place-cards";
import { VenueKindIcon } from "@/components/venue-kind-icon";
import { useKeyboardVisible } from "@/hooks/use-keyboard-visible";
import { getApiUrl } from "@/lib/config";
import {
  formatPlaceRating,
  shouldShowNearbyCards,
  venueFromNearbyCard,
  type NearbyPlaceCard,
} from "@/lib/nearby-places";
import { rememberNearbyPlan } from "@/lib/nearby-plan";
import {
  fetchNearbyPlaces,
  newSession,
  resolvePlaceDetails,
  searchPlaces,
  typedVenue,
  type PlacePrediction,
} from "@/lib/places";
import {
  classifyHostLocationPermission,
  type HostLocationPermission,
} from "@/lib/host-location-prime-policy";
import { nearbyCardsAreVisible } from "@/lib/place-step-footer";
import { colors } from "@/lib/theme";
import type { ReceiptVenue } from "@/lib/types";

type Props = {
  value: string;
  venue: ReceiptVenue | null;
  receiptDate?: string | null;
  onChangeName: (name: string) => void;
  onChangeVenue: (venue: ReceiptVenue | null) => void;
  /** Step 3 uses this to drop "Swipe nearby places" when those cards are not on screen. */
  onNearbyStateChange?: (visible: boolean) => void;
};

export function formatReceiptDateLabel(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function staticMapUri(lat: number, lng: number, w: number, h: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    w: String(w),
    h: String(h),
  });
  return `${getApiUrl()}/api/places/static-map?${params}`;
}

function isPinned(venue: ReceiptVenue | null | undefined): boolean {
  return (
    venue?.source === "places" &&
    typeof venue.lat === "number" &&
    typeof venue.lng === "number" &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lng)
  );
}

export function VenueTypeahead({
  value,
  venue,
  receiptDate,
  onChangeName,
  onChangeVenue,
  onNearbyStateChange,
}: Props) {
  const { width, height } = useWindowDimensions();
  const mapW = Math.min(600, Math.max(280, Math.round(width - 48)));
  const mapH = Math.min(420, Math.max(300, Math.round(height * 0.46)));

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [nearby, setNearby] = useState<NearbyPlaceCard[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [permission, setPermission] = useState<HostLocationPermission | null>(null);
  const [positionUnavailable, setPositionUnavailable] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const keyboardOpen = useKeyboardVisible();
  const openLocationSheet = useRef<(() => void) | null>(null);
  const refreshEpoch = useRef(0);
  const sessionRef = useRef(newSession());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearbyRef = useRef<NearbyPlaceCard[]>([]);
  const lockedRef = useRef(isPinned(venue));
  /** Seed search once for a parsed name — never auto-lock a place. */
  const seededSearchRef = useRef(false);

  const placeConfirmed = isPinned(venue);
  const address = venue?.formattedAddress?.trim() || null;
  const dateLabel = formatReceiptDateLabel(receiptDate);
  const hasMap = placeConfirmed && !mapFailed;

  useEffect(() => {
    setMapFailed(false);
  }, [venue?.lat, venue?.lng]);

  useEffect(() => {
    lockedRef.current = isPinned(venue);
  }, [venue]);

  const refreshLocation = useCallback(async () => {
    const token = ++refreshEpoch.current;
    const stale = () => token !== refreshEpoch.current;
    let next: HostLocationPermission;
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (stale()) return;
      next = classifyHostLocationPermission({
        status: current.status,
        canAskAgain: current.canAskAgain,
      });
      setPermission(next);
    } catch {
      if (stale()) return;
      setPermission((prev) => prev ?? "undetermined");
      setLocationReady(true);
      return;
    }
    if (next !== "granted") {
      setCoords(null);
      setPositionUnavailable(false);
      setSettledKey(null);
      setLocationReady(true);
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (stale()) return;
      const nextCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords((prev) =>
        prev && prev.lat === nextCoords.lat && prev.lng === nextCoords.lng ? prev : nextCoords,
      );
      setPositionUnavailable(false);
    } catch {
      if (stale()) return;
      setCoords(null);
      setPositionUnavailable(true);
    } finally {
      if (!stale()) setLocationReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void refreshLocation();
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") void refreshLocation();
      });
      return () => {
        setFocused(false);
        sub.remove();
      };
    }, [refreshLocation]),
  );

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    // A response that settles before the next frame never paints a loader.
    // A later fetch that already has cards stays on those cards.
    let stillPending = true;
    const frame =
      nearbyRef.current.length === 0
        ? requestAnimationFrame(() => {
            if (!cancelled && stillPending) setNearbyLoading(true);
          })
        : 0;
    const key = `${coords.lat},${coords.lng}`;
    void (async () => {
      const cards = await fetchNearbyPlaces(coords);
      stillPending = false;
      if (cancelled) return;
      nearbyRef.current = cards;
      setNearby(cards);
      setNearbyLoading(false);
      setSettledKey(key);
    })();
    return () => {
      cancelled = true;
      stillPending = false;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [coords]);

  const coordKey = coords ? `${coords.lat},${coords.lng}` : null;
  const nearbyPending = Boolean(coordKey && shouldShowNearbyCards(value) && settledKey !== coordKey);
  const nearbyVisible = nearbyCardsAreVisible({
    permission,
    positionUnavailable,
    hasCoords: Boolean(coords),
    query: value,
    pending: nearbyPending || nearbyLoading,
    count: nearby.length,
  });

  useEffect(() => {
    onNearbyStateChange?.(nearbyVisible);
  }, [nearbyVisible, onNearbyStateChange]);

  const runSearch = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (lockedRef.current) {
        setPredictions([]);
        return;
      }
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setPredictions([]);
        setSearchError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setSearchError(null);
      timerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const rows = await searchPlaces(trimmed, coords, sessionRef.current);
            setPredictions(rows);
            if (rows.length === 0) {
              setSearchError(null);
            }
          } catch (err) {
            setPredictions([]);
            const code = (err as { code?: string }).code;
            setSearchError(
              code === "places_unauthorized" || code === "places_upstream" || code === "forbidden"
                ? "Place search isn’t available right now (Mapbox). Try again later, or type the name and we’ll keep going once search is fixed."
                : "Couldn’t load place suggestions. Check your connection and try again.",
            );
          } finally {
            setLoading(false);
          }
        })();
      }, 280);
    },
    [coords],
  );

  // After parse: show suggestions for the OCR name — host must tap to confirm.
  useEffect(() => {
    if (!locationReady || isPinned(venue) || seededSearchRef.current) return;
    const seed = value.trim();
    if (seed.length < 2) return;
    seededSearchRef.current = true;
    runSearch(seed);
  }, [locationReady, venue, value, runSearch]);

  const onChangeText = (text: string) => {
    lockedRef.current = false;
    seededSearchRef.current = true; // don't re-seed after edits
    onChangeName(text);
    onChangeVenue(null);
    runSearch(text);
  };

  const selectNearbyCard = (card: NearbyPlaceCard) => {
    rememberNearbyPlan(card, (picked) => {
      onChangeName(picked.name);
      onChangeVenue(venueFromNearbyCard(picked, new Date().toISOString()));
    });
    router.push("/host/place");
  };

  const onSelect = async (row: PlacePrediction) => {
    lockedRef.current = true;
    onChangeName(row.name);
    setPredictions([]);
    setLoading(true);
    onChangeVenue({
      name: row.name,
      placeId: row.placeId,
      provider: row.provider,
      formattedAddress: row.formattedAddress || row.secondary || null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      category: row.category ?? null,
      source: "places",
      confirmedAt: new Date().toISOString(),
    });
    try {
      const resolved = await resolvePlaceDetails(row, sessionRef.current);
      onChangeVenue({
        ...resolved,
        category: resolved.category || row.category || null,
        formattedAddress:
          resolved.formattedAddress ||
          row.formattedAddress ||
          row.secondary ||
          null,
      });
      sessionRef.current = newSession();
    } catch {
      onChangeVenue({
        name: row.name,
        placeId: row.placeId,
        provider: row.provider,
        formattedAddress: row.formattedAddress || row.secondary || null,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
        category: row.category ?? null,
        source: "places",
        confirmedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    lockedRef.current = false;
    seededSearchRef.current = true;
    const name = venue?.name?.trim() || value.trim();
    onChangeVenue(null);
    onChangeName(name);
    setPredictions([]);
    if (name.length >= 2) runSearch(name);
  };

  const locationPrimeActive =
    focused && !placeConfirmed && shouldShowNearbyCards(value) && !keyboardOpen;

  return (
    <View style={placeConfirmed ? { flexGrow: 1 } : undefined}>
      <HostLocationPrime
        active={locationPrimeActive}
        permission={permission}
        onPermission={setPermission}
        onGranted={() => {
          void refreshLocation();
        }}
        openerRef={openLocationSheet}
      />
      {placeConfirmed ? (
        <View style={{ flexGrow: 1 }}>
          <View style={styles.selected}>
            <VenueKindIcon category={venue?.category} name={venue?.name} size={18} />
            <View style={styles.selectedBody}>
              <Text style={styles.selectedName}>{venue!.name}</Text>
              {address ? <Text style={styles.selectedSecondary}>{address}</Text> : null}
              {formatPlaceRating(venue?.rating, venue?.userRatingCount) ? (
                <Text style={styles.selectedSecondary}>
                  {formatPlaceRating(venue?.rating, venue?.userRatingCount)}
                </Text>
              ) : null}
              {dateLabel ? (
                <Text style={styles.selectedDate}>Receipt date · {dateLabel}</Text>
              ) : null}
            </View>
            <Pressable onPress={clearSelection} hitSlop={8}>
              <Text style={styles.change}>Change</Text>
            </Pressable>
          </View>
          {hasMap ? (
            <View style={[styles.mapWrap, { minHeight: mapH }]}>
              <Image
                source={{
                  uri: staticMapUri(venue!.lat!, venue!.lng!, mapW, mapH),
                }}
                style={[styles.map, { height: mapH }]}
                accessibilityLabel={`Map of ${venue!.name}`}
                onError={() => setMapFailed(true)}
              />
            </View>
          ) : mapFailed ? (
            <View style={[styles.mapWrap, styles.mapPlaceholder, { minHeight: 120 }]}>
              <Text style={styles.hintCenter}>Map couldn’t load — address is still saved.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Field
            label="Pick a different restaurant or bar"
            value={value}
            onChangeText={onChangeText}
            placeholder="Start typing the place"
            autoCapitalize="words"
            autoComplete="organization"
          />
          {permission && permission !== "granted" ? (
            Platform.OS === "web" ? (
              <Text allowFontScaling style={styles.locationUnavailable}>
                Location off · Turn on
              </Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Location is off. Turn on location."
                onPress={() => openLocationSheet.current?.()}
                hitSlop={8}
                style={({ pressed }) => [styles.locationLink, pressed && { opacity: 0.6 }]}
              >
                <Text allowFontScaling style={styles.locationOff}>
                  Location off · <Text style={styles.locationOn}>Turn on</Text>
                </Text>
              </Pressable>
            )
          ) : positionUnavailable ? (
            <Text allowFontScaling style={styles.locationUnavailable}>
              Location unavailable — search by name.
            </Text>
          ) : null}
          {dateLabel ? (
            <Text style={styles.dateLoose}>Receipt date · {dateLabel}</Text>
          ) : null}
          {searchError ? (
            <Text style={styles.searchError}>{searchError}</Text>
          ) : null}
          {coords && shouldShowNearbyCards(value) ? (
            <NearbyPlaceCards
              places={nearby}
              loading={nearbyLoading}
              onSelect={selectNearbyCard}
            />
          ) : null}
          {value.trim().length >= 2 && !loading && !searchError && predictions.length === 0 ? (
            <Text style={styles.hint}>
              Keep typing or pick a match below when they appear. We won’t lock a place until you
              tap one.
            </Text>
          ) : null}
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 8 }} color={colors.merlot} />
          ) : null}
          {predictions.length > 0 ? (
            <View style={styles.list}>
              {predictions.map((row) => (
                <Pressable
                  key={row.placeId}
                  onPress={() => void onSelect(row)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <VenueKindIcon category={row.category} name={row.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name}>{row.name}</Text>
                    {row.secondary ? (
                      <Text style={styles.secondary}>{row.secondary}</Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export function ensureVenueForPublish(
  restaurant: string,
  venue: ReceiptVenue | null,
): ReceiptVenue {
  if (venue && venue.name.trim()) return venue;
  return typedVenue(restaurant);
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginTop: -4, marginBottom: 8 },
  locationLink: {
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 8,
  },
  locationOff: { fontSize: 12, lineHeight: 16, color: colors.muted },
  locationOn: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: colors.merlot },
  locationUnavailable: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    marginBottom: 8,
  },
  searchError: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.danger,
    lineHeight: 18,
    marginBottom: 10,
  },
  hintCenter: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSoft,
    textAlign: "center",
  },
  dateLoose: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  mapPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 16,
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  selected: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: "#FFFcf8",
  },
  selectedBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  selectedName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.35,
    lineHeight: 28,
  },
  secondary: { fontSize: 12, color: colors.muted, marginTop: 2 },
  selectedSecondary: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
    marginTop: 4,
  },
  selectedDate: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkSoft,
    marginTop: 10,
  },
  change: { fontSize: 14, fontWeight: "700", color: colors.merlot, marginTop: 4 },
  mapWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 4,
    backgroundColor: "#EDE8E1",
    flexGrow: 1,
    minHeight: 280,
  },
  map: { width: "100%", backgroundColor: "#EDE8E1" },
});
