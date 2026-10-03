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
import { getApiUrl } from "@/lib/config";
import { formatPlaceCategory, placePhotos, type NearbyPlaceCard } from "@/lib/nearby-places";
import { colors } from "@/lib/theme";

const CARD_HEIGHT = 220;
const CARD_GAP = 12;

function CardPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <View style={styles.photo} />;
  }
  return (
    // Decorative. The place name is the button label.
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      source={{ uri: url }}
      style={styles.photo}
      resizeMode="cover"
      accessible={false}
      onError={() => setFailed(true)}
    />
  );
}

/** Short horizontal swipe. A tap opens the place screen; it does not select. */
export function NearbyPlaceCards({
  places,
  onSelect,
}: {
  places: NearbyPlaceCard[];
  onSelect: (card: NearbyPlaceCard) => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(280, Math.round(width * 0.78));
  if (places.length === 0) return null;

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
        {places.map((card) => {
          const photos = placePhotos(card, getApiUrl());
          const category = formatPlaceCategory(card.category);
          return (
            <Pressable
              key={card.placeId}
              accessibilityRole="button"
              accessibilityLabel={card.name}
              onPress={() => onSelect(card)}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth },
                pressed && { opacity: 0.86 },
              ]}
            >
              <View style={styles.photos}>
                {photos.length === 0 ? (
                  <View style={styles.photo} />
                ) : (
                  photos.map((url, index) => <CardPhoto key={`${url}-${index}`} url={url} />)
                )}
              </View>
              <View style={[styles.caption, photos.length === 0 && styles.captionPlain]}>
                <Text numberOfLines={1} style={[styles.name, photos.length === 0 && styles.namePlain]}>
                  {card.name}
                </Text>
                {card.formattedAddress ? (
                  <Text numberOfLines={1} style={[styles.meta, photos.length === 0 && styles.metaPlain]}>
                    {card.formattedAddress}
                  </Text>
                ) : null}
                {category ? (
                  <Text numberOfLines={1} style={[styles.meta, photos.length === 0 && styles.metaPlain]}>
                    {category}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
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
  photos: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  photo: {
    flex: 1,
    height: "100%",
    backgroundColor: colors.chrome,
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 12,
    backgroundColor: "rgba(36, 28, 20, 0.55)",
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
    opacity: 0.9,
  },
  metaPlain: { color: colors.inkSoft },
  attribution: { fontSize: 11, color: colors.muted, marginTop: 8 },
});
