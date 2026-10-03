import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AppShell, InterviewChrome, PrimaryButton } from "@/components/chrome";
import { goHostDesk } from "@/lib/navigation";
import { currentNearbyPlan } from "@/lib/nearby-plan";
import { getApiUrl } from "@/lib/config";
import { fetchPlaceDetail } from "@/lib/places";
import { staticMapUri } from "@/lib/place-pin";
import {
  formatPlaceCategory,
  formatPlaceRating,
  httpHref,
  mergePlaceDetail,
  placePhotos,
  type PlaceDetail,
} from "@/lib/nearby-places";
import { colors } from "@/lib/theme";

function openHttp(url: string) {
  const href = httpHref(url);
  if (!href) return;
  void Linking.openURL(href);
}

export default function NearbyPlaceScreen() {
  const [plan] = useState(() => currentNearbyPlan());
  const card = plan?.card ?? null;
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const photos = card ? placePhotos(card, getApiUrl()) : [];
  const mapLat = detail?.lat ?? card?.lat;
  const mapLng = detail?.lng ?? card?.lng;
  const mapUri =
    typeof mapLat === "number" && typeof mapLng === "number"
      ? staticMapUri({ lat: mapLat, lng: mapLng, w: 600, h: 220, z: 15 })
      : null;
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [mapFailed, setMapFailed] = useState(false);
  const rating = formatPlaceRating(detail?.rating, detail?.userRatingCount);
  const category = formatPlaceCategory(detail?.category ?? card?.category);
  const address = detail?.formattedAddress ?? card?.formattedAddress;
  const website = httpHref(detail?.websiteUri);
  const maps = httpHref(detail?.googleMapsUri ?? card?.googleMapsUri);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    void fetchPlaceDetail(card.placeId).then((next) => {
      if (!cancelled) setDetail(next);
    });
    return () => {
      cancelled = true;
    };
  }, [card]);

  function planHere() {
    const current = currentNearbyPlan();
    if (current) current.onPlan(mergePlaceDetail(current.card, detail));
    router.back();
  }

  return (
    <AppShell>
      <InterviewChrome
        step={1}
        total={1}
        hideProgress
        kicker="Nearby"
        motif="label-band"
        title={card?.name ?? "Place"}
        onBack={() => router.back()}
        onHome={goHostDesk}
        footer={
          <PrimaryButton disabled={!card} onPress={planHere}>
            Plan here
          </PrimaryButton>
        }
      >
        {card ? (
          <View style={styles.stack}>
            {photos.length > 0 ? (
              <View style={photos.length === 1 ? undefined : styles.pair}>
                {photos.map((url, index) =>
                  failed[`${url}-${index}`] ? null : (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image
                      key={`${url}-${index}`}
                      source={{ uri: url }}
                      style={photos.length === 1 ? styles.hero : styles.pairPhoto}
                      resizeMode="cover"
                      accessible={false}
                      onError={() => setFailed((current) => ({ ...current, [`${url}-${index}`]: true }))}
                    />
                  ),
                )}
              </View>
            ) : null}
            {mapUri && !mapFailed ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                source={{ uri: mapUri }}
                style={styles.map}
                resizeMode="cover"
                accessible={false}
                onError={() => setMapFailed(true)}
              />
            ) : null}
            {address ? <Text style={styles.address}>{address}</Text> : null}
            {rating ? <Text style={styles.rating}>{rating}</Text> : null}
            {category ? <Text style={styles.category}>{category}</Text> : null}
            {website || maps ? (
              <View style={styles.links}>
                {website ? (
                  <Pressable onPress={() => openHttp(website)} hitSlop={8} style={styles.linkHit}>
                    <Text style={styles.link}>Website</Text>
                  </Pressable>
                ) : null}
                {maps ? (
                  <Pressable onPress={() => openHttp(maps)} hitSlop={8} style={styles.linkHit}>
                    <Text style={styles.link}>Maps</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.attribution}>Powered by Google</Text>
          </View>
        ) : (
          <Text style={styles.address}>That place isn’t available. Go back and pick another.</Text>
        )}
      </InterviewChrome>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  hero: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.chrome,
  },
  pair: { flexDirection: "row", gap: 8, height: 200 },
  pairPhoto: {
    flex: 1,
    height: 200,
    borderRadius: 16,
    backgroundColor: colors.chrome,
  },
  map: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.chrome,
  },
  address: { fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  rating: { fontSize: 15, fontWeight: "700", color: colors.ink },
  category: { fontSize: 13, color: colors.muted },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  linkHit: { minHeight: 44, justifyContent: "center" },
  link: { fontSize: 15, fontWeight: "700", color: colors.merlot },
  attribution: { fontSize: 11, color: colors.muted, marginTop: 4 },
});
