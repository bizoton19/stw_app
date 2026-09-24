import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as Location from "expo-location";
import { Field } from "@/components/field";
import { VenueKindIcon } from "@/components/venue-kind-icon";
import { getApiUrl } from "@/lib/config";
import {
  newSession,
  resolvePlaceDetails,
  resolveVenueFromName,
  searchPlaces,
  typedVenue,
  type PlacePrediction,
} from "@/lib/places";
import { colors } from "@/lib/theme";
import type { ReceiptVenue } from "@/lib/types";

type Props = {
  value: string;
  venue: ReceiptVenue | null;
  receiptDate?: string | null;
  onChangeName: (name: string) => void;
  onChangeVenue: (venue: ReceiptVenue | null) => void;
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
}: Props) {
  const { width, height } = useWindowDimensions();
  const mapW = Math.min(600, Math.max(280, Math.round(width - 48)));
  const mapH = Math.min(420, Math.max(300, Math.round(height * 0.46)));

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoResolving, setAutoResolving] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const sessionRef = useRef(newSession());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);
  const onChangeNameRef = useRef(onChangeName);
  const onChangeVenueRef = useRef(onChangeVenue);
  const coordsRef = useRef(coords);
  onChangeNameRef.current = onChangeName;
  onChangeVenueRef.current = onChangeVenue;
  coordsRef.current = coords;
  /** One auto-pin attempt per restaurant name seed (fallback if parse didn't pin). */
  const autoKeyRef = useRef<string | null>(null);

  const placeConfirmed = isPinned(venue);
  const address = venue?.formattedAddress?.trim() || null;
  const dateLabel = formatReceiptDateLabel(receiptDate);
  const hasMap = placeConfirmed && !mapFailed;

  useEffect(() => {
    setMapFailed(false);
  }, [venue?.lat, venue?.lng]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setLocationHint("Location off — search by name only.");
          setLocationReady(true);
          return;
        }
        setLocationHint("Using nearby places to rank results.");
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        if (!cancelled) setLocationHint("Location off — search by name only.");
      } finally {
        if (!cancelled) setLocationReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fallback: if step 4 opens with a name but no Places pin, resolve once.
  // Also re-try when venue is typed / missing coords (common after parse).
  useEffect(() => {
    if (!locationReady || isPinned(venue)) return;
    const seed = value.trim();
    if (seed.length < 2) return;
    const key = `${seed}|${coordsRef.current?.lat ?? ""}`;
    if (autoKeyRef.current === key) return;
    autoKeyRef.current = key;

    let cancelled = false;
    setAutoResolving(true);
    void (async () => {
      try {
        const resolved = await resolveVenueFromName(seed, coordsRef.current);
        if (cancelled || !resolved) return;
        lockedRef.current = true;
        onChangeNameRef.current(resolved.name);
        onChangeVenueRef.current(resolved);
        setPredictions([]);
      } catch {
        /* leave typed name — host can pick from typeahead */
      } finally {
        if (!cancelled) setAutoResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationReady, value, venue]);

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
        setLoading(false);
        return;
      }
      setLoading(true);
      timerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const rows = await searchPlaces(trimmed, coords, sessionRef.current);
            setPredictions(rows);
          } catch {
            setPredictions([]);
          } finally {
            setLoading(false);
          }
        })();
      }, 280);
    },
    [coords],
  );

  const onChangeText = (text: string) => {
    lockedRef.current = false;
    autoKeyRef.current = null;
    onChangeName(text);
    onChangeVenue(null);
    runSearch(text);
  };

  const onSelect = async (row: PlacePrediction) => {
    lockedRef.current = true;
    autoKeyRef.current = row.name.trim();
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
    autoKeyRef.current = null;
    onChangeVenue(null);
    onChangeName("");
    setPredictions([]);
  };

  return (
    <View style={placeConfirmed ? { flexGrow: 1 } : undefined}>
      {autoResolving && !placeConfirmed ? (
        <View style={styles.autoBox}>
          <ActivityIndicator color={colors.merlot} />
          <Text style={styles.autoCopy}>Pinning “{value.trim()}” on the map…</Text>
        </View>
      ) : null}
      {placeConfirmed ? (
        <View style={{ flexGrow: 1 }}>
          <View style={styles.selected}>
            <VenueKindIcon category={venue?.category} name={venue?.name} size={18} />
            <View style={styles.selectedBody}>
              <Text style={styles.selectedName}>{venue!.name}</Text>
              {address ? <Text style={styles.selectedSecondary}>{address}</Text> : null}
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
              <Text style={styles.autoCopy}>Map couldn’t load — address is still saved.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Field
            label="Restaurant or bar"
            value={value}
            onChangeText={onChangeText}
            placeholder="Start typing the place"
            autoCapitalize="words"
            autoComplete="organization"
          />
          {locationHint ? <Text style={styles.hint}>{locationHint}</Text> : null}
          {dateLabel ? (
            <Text style={styles.dateLoose}>Receipt date · {dateLabel}</Text>
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
  dateLoose: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  autoBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 28,
    marginBottom: 8,
  },
  autoCopy: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSoft,
    textAlign: "center",
  },
  mapPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
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
