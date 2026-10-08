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
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Motif } from "@/components/motifs";
import { getApiUrl } from "@/lib/config";
import { formatPlaceCategory, placePhotos, type NearbyPlaceCard } from "@/lib/nearby-places";
import {
  CAPTION_FONT_SCALE_MAX,
  CAPTION_RAMP_PX,
  PLACE_CAPTION_MIN_HEIGHT,
  PLACE_CARD_HEIGHT,
  STEM_MOTIF_SIZE,
  captionScrimOverlay,
  stemClearsCaption,
} from "@/lib/place-card-caption";
import { colors } from "@/lib/theme";

const CARD_HEIGHT = PLACE_CARD_HEIGHT;
const CARD_GAP = 12;
const CAPTION_HEIGHT = PLACE_CAPTION_MIN_HEIGHT;
/** Fixed ramp. The 0.78 plateau starts here and covers every line below it. */
const CAPTION_RAMP = CAPTION_RAMP_PX;

/**
 * A 36px svg ramp from alpha 0 to 0.78, then a solid plateau for the rest of
 * the band. The plateau is a View, so it grows with the caption's minHeight.
 */
function CaptionScrim({ width, rampId }: { width: number; rampId: string }) {
  const overlay = captionScrimOverlay(colors.photoScrim);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.scrim}
    >
      <Svg width={width} height={overlay.ramp.height} style={styles.scrimRamp} pointerEvents="none">
        <Defs>
          <LinearGradient id={rampId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={overlay.ramp.color} stopOpacity={overlay.ramp.fromAlpha} />
            <Stop offset="1" stopColor={overlay.ramp.color} stopOpacity={overlay.ramp.toAlpha} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={overlay.ramp.height} fill={`url(#${rampId})`} />
      </Svg>
      <View style={[styles.scrimPlateau, { backgroundColor: overlay.plateau.color }]} />
    </View>
  );
}

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
  const [captionHeight, setCaptionHeight] = useState(CAPTION_HEIGHT);
  const photo = placePhotos(card, getApiUrl())[0] ?? null;
  const showPhoto = Boolean(photo) && !failed;
  const showMotif = !showPhoto && stemClearsCaption(captionHeight);
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
          {showMotif ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.fallbackMotif, { bottom: captionHeight }]}
            >
              <Motif name="stem" size={STEM_MOTIF_SIZE} color={colors.merlot} opacity={0.8} />
            </View>
          ) : null}
        </View>
      )}
      <View
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          setCaptionHeight((prev) => (prev === next ? prev : next));
        }}
        style={[styles.caption, showPhoto ? null : styles.captionPlain]}
      >
        {showPhoto ? (
          <CaptionScrim
            width={cardWidth}
            rampId={`captionRamp${card.placeId.replace(/[^A-Za-z0-9]/g, "")}`}
          />
        ) : null}
        <Text
          maxFontSizeMultiplier={CAPTION_FONT_SCALE_MAX}
          numberOfLines={3}
          style={[styles.name, !showPhoto && styles.namePlain]}
        >
          {card.name}
        </Text>
        {card.formattedAddress ? (
          <Text
            maxFontSizeMultiplier={CAPTION_FONT_SCALE_MAX}
            numberOfLines={1}
            style={[styles.meta, !showPhoto && styles.metaPlain]}
          >
            {card.formattedAddress}
          </Text>
        ) : null}
        {category ? (
          <Text
            maxFontSizeMultiplier={CAPTION_FONT_SCALE_MAX}
            numberOfLines={1}
            style={[styles.meta, !showPhoto && styles.metaPlain]}
          >
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
    overflow: "hidden",
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
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scrimRamp: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  scrimPlateau: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CAPTION_RAMP,
    bottom: 0,
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
