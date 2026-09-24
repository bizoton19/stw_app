import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { Field } from "@/components/field";
import {
  newSession,
  resolvePlaceDetails,
  searchPlaces,
  typedVenue,
  type PlacePrediction,
} from "@/lib/places";
import { colors } from "@/lib/theme";
import type { ReceiptVenue } from "@/lib/types";

type Props = {
  value: string;
  venue: ReceiptVenue | null;
  onChangeName: (name: string) => void;
  onChangeVenue: (venue: ReceiptVenue | null) => void;
};

export function VenueTypeahead({ value, venue, onChangeName, onChangeVenue }: Props) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const sessionRef = useRef(newSession());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setLocationHint("Location off — search by name only.");
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    onChangeName(text);
    onChangeVenue(null);
    runSearch(text);
  };

  const onSelect = async (row: PlacePrediction) => {
    lockedRef.current = true;
    onChangeName(row.name);
    setPredictions([]);
    setLoading(true);
    try {
      const resolved = await resolvePlaceDetails(row, sessionRef.current);
      onChangeVenue(resolved);
      sessionRef.current = newSession();
    } catch {
      onChangeVenue(typedVenue(row.name));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Field
        label="Restaurant or bar"
        value={value}
        onChangeText={onChangeText}
        placeholder="Start typing the place"
        autoCapitalize="words"
        autoComplete="organization"
        hint={venue?.source === "places" ? "· place confirmed" : undefined}
      />
      {locationHint ? <Text style={styles.hint}>{locationHint}</Text> : null}
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
              <Text style={styles.name}>{row.name}</Text>
              {row.secondary ? <Text style={styles.secondary}>{row.secondary}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Call before publish if host typed a name without picking a suggestion. */
export function ensureVenueForPublish(
  restaurant: string,
  venue: ReceiptVenue | null,
): ReceiptVenue {
  if (venue && venue.name.trim()) return venue;
  return typedVenue(restaurant);
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginTop: -4, marginBottom: 8 },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  secondary: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
