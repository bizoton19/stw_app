import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { placePinColor, staticMapUri } from "@/lib/place-pin";
import { colors } from "@/lib/theme";

type Props = {
  lat?: number | null;
  lng?: number | null;
  /** Stable place key — drives pin + ring color. */
  placeKey?: string | null;
  /** Fallback letter when no coords (typed venue). */
  label?: string;
  size?: number;
};

/**
 * Round static-map thumb for host desk cards. Colored pin/ring per place.
 */
export function VenueMapThumb({ lat, lng, placeKey, label, size = 56 }: Props) {
  const [failed, setFailed] = useState(false);
  const color = placePinColor(placeKey || label);
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const letter = (label || "?").trim().charAt(0).toUpperCase() || "?";
  const px = Math.max(120, Math.round(size * 2));

  if (!hasCoords || failed) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `#${color}22`,
            borderColor: `#${color}`,
          },
        ]}
        accessibilityLabel={`Place ${letter}`}
      >
        <Text style={[styles.letter, { color: `#${color}`, fontSize: size * 0.38 }]}>{letter}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: `#${color}`,
        },
      ]}
    >
      <Image
        source={{
          uri: staticMapUri({
            lat: lat!,
            lng: lng!,
            w: px,
            h: px,
            color,
            z: 15,
          }),
        }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
        accessibilityLabel="Venue map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    flexShrink: 0,
  },
  letter: {
    fontWeight: "800",
  },
});
