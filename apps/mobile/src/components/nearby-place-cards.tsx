import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Motif } from "@/components/motifs";
import { getApiUrl } from "@/lib/config";
import { formatPlaceCategory, placePhotos, type NearbyPlaceCard } from "@/lib/nearby-places";
import { colors } from "@/lib/theme";

const CARD_HEIGHT = 220;
const CARD_GAP = 12;
/** Minimum caption band: about the bottom 45% of the card. It grows with the type. */
const CAPTION_HEIGHT = Math.round(CARD_HEIGHT * 0.45);
/** Fixed ramp. The 0.78 plateau starts here and covers every line below it. */
const CAPTION_RAMP = 36;

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A fixed 36px ramp at the top of the caption, from alpha 0 to a 0.78 plateau.
 * The rest of the band — however tall Dynamic Type or a three-line name makes
 * it — stays on that plateau, so every line sits on the scrim. React Native
 * 0.86 still exposes this as `experimental_backgroundImage` (unprefixed in 0.87).
 */
const CAPTION_SCRIM = `linear-gradient(to bottom, ${withAlpha(colors.photoScrim, 0)} 0px, ${withAlpha(colors.photoScrim, 0.78)} ${CAPTION_RAMP}px, ${withAlpha(colors.photoScrim, 0.78)} 100%)`;

function CardPhoto({
  url,
  width,
  height,
  onError,
}: {
  url: string;
  width: number;
  height: number;
  onError: () => void;
}) {
  return (
    // Decorative. The place name is the button label.
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      source={{ uri: url }}
      style={{ width, height }}
      resizeMode="cover"
      accessible={false}
      onError={onError}
    />
  );
}

function NearbyLoading({ cardWidth }: { cardWidth: number }) {
  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading nearby"
    >
      <Text style={styles.heading}>Loading nearby…</Text>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {[0, 1].map((slot) => (
          <View key={slot} style={[styles.card, styles.skeleton, { width: cardWidth }]}>
            <View
              style={{
                width: Math.round(cardWidth * 0.72),
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.border,
              }}
            />
            <View
              style={{
                width: Math.round(cardWidth * 0.46),
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.border,
                marginTop: 8,
              }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function PlaceCard({
  card,
  cardWidth,
  onSelect,
}: {
  card: NearbyPlaceCard;
  cardWidth: number;
  onSelect: (card: NearbyPlaceCard) => void;
}) {
  const [failed, setFailed] = useState(false);
  const photo = placePhotos(card, getApiUrl())[0] ?? null;
  const showPhoto = Boolean(photo) && !failed;
  const category = formatPlaceCategory(card.category);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={card.name}
      onPress={() => onSelect(card)}
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth },
        pressed && { opacity: 0.86 },
      ]}
    >
      {showPhoto && photo ? (
        <CardPhoto
          url={photo}
          width={cardWidth}
          height={CARD_HEIGHT}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={{ width: cardWidth, height: CARD_HEIGHT, backgroundColor: colors.chrome }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.fallbackMotif}
          >
            <Motif name="stem" size={72} color={colors.merlot} opacity={0.8} />
          </View>
        </View>
      )}
      <View style={[styles.caption, showPhoto ? styles.captionPhoto : styles.captionPlain]}>
        <Text numberOfLines={3} style={[styles.name, !showPhoto && styles.namePlain]}>
          {card.name}
        </Text>
        {card.formattedAddress ? (
          <Text numberOfLines={1} style={[styles.meta, !showPhoto && styles.metaPlain]}>
            {card.formattedAddress}
          </Text>
        ) : null}
        {category ? (
          <Text numberOfLines={1} style={[styles.meta, !showPhoto && styles.metaPlain]}>
            {category}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Short horizontal swipe. A tap opens the place screen; it does not select. */
export function NearbyPlaceCards({
  places,
  onSelect,
  loading = false,
}: {
  places: NearbyPlaceCard[];
  onSelect: (card: NearbyPlaceCard) => void;
  /** True only while the first nearby request is in flight and `places` is still empty. */
  loading?: boolean;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(280, Math.round(width * 0.78));
  if (places.length === 0) {
    if (!loading) return null;
    return <NearbyLoading cardWidth={cardWidth} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Nearby</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        contentContainerStyle={styles.row}
      >
        {places.map((card) => (
          <PlaceCard key={card.placeId} card={card} cardWidth={cardWidth} onSelect={onSelect} />
        ))}
      </ScrollView>
      <Text style={styles.attribution}>Powered by Google</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  heading: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    marginBottom: 8,
  },
  row: { gap: CARD_GAP, paddingRight: 4 },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.chrome,
  },
  skeleton: {
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.chromeBorder,
  },
  fallbackMotif: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: CAPTION_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: CAPTION_HEIGHT,
    paddingTop: CAPTION_RAMP,
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: "flex-end",
  },
  captionPhoto: {
    experimental_backgroundImage: CAPTION_SCRIM,
  },
  captionPlain: { backgroundColor: "transparent" },
  name: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.paper,
  },
  namePlain: { color: colors.ink },
  meta: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.paper,
  },
  metaPlain: { color: colors.inkFirm },
  attribution: { fontSize: 11, color: colors.muted, marginTop: 8 },
});
