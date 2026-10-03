import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { NearbyPlaceCards } from "../components/nearby-place-cards";
import { NearbyPlaceDetail } from "../components/nearby-place-detail";
import {
  formatPlaceCategory,
  formatPlaceRating,
  httpHref,
  mergePlaceDetail,
  nearbyQuery,
  parsePlaceDetail,
  photoUrlForClient,
  placeDetailsQuery,
  placePhotos,
  staticMapForClient,
  placesFromNearbyResponse,
  readNearbyPlaces,
  shouldShowNearbyCards,
  venueFromNearbyCard,
  type NearbyPlaceCard,
} from "./nearby-place-card";

const card: NearbyPlaceCard = {
  placeId: "ChIJgoogle123",
  name: "Joes Bar",
  formattedAddress: "1 Main St, New York, NY",
  lat: 40.7128,
  lng: -74.006,
  category: "bar",
  provider: "google",
  rating: 4.6,
  userRatingCount: 321,
  photoUrl: "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Fref&maxWidthPx=400",
  photoUrls: [
    "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Fref&maxWidthPx=400",
  ],
  websiteUri: "https://example.com",
  googleMapsUri: "https://maps.google.com/?cid=1",
};

function between(source: string, start: string, end: string): string {
  const at = source.indexOf(start);
  assert.notEqual(at, -1, start);
  const until = source.indexOf(end, at + start.length);
  assert.notEqual(until, -1, end);
  return source.slice(at, until);
}

test("web and mobile nearby helpers stay byte-identical", () => {
  const web = readFileSync(new URL("./nearby-place-card.ts", import.meta.url), "utf8");
  const mobile = readFileSync(
    new URL("../../apps/mobile/src/lib/nearby-places.ts", import.meta.url),
    "utf8",
  );
  assert.equal(web, mobile);
});

test("nearby cards show only while the query is empty or one character", () => {
  assert.equal(shouldShowNearbyCards(""), true);
  assert.equal(shouldShowNearbyCards("  "), true);
  assert.equal(shouldShowNearbyCards("a"), true);
  assert.equal(shouldShowNearbyCards(" a "), true);
  assert.equal(shouldShowNearbyCards("ab"), false);
  assert.equal(shouldShowNearbyCards("  jo"), false);
});

test("nearby query is lat and lng only", () => {
  const query = nearbyQuery(40.7128, -74.006);
  assert.equal(query, "/api/places/nearby?lat=40.7128&lng=-74.006");
  assert.equal(query.includes("placeId"), false);
  assert.equal(query.includes("key"), false);
});

test("502 and 503 nearby responses are an empty list", async () => {
  for (const status of [502, 503, 400, 500]) {
    assert.deepEqual(
      placesFromNearbyResponse(status, {
        error: status === 503 ? "google_places_not_configured" : "places_upstream",
        places: [card],
      }),
      [],
    );
    assert.deepEqual(
      await readNearbyPlaces({
        status,
        json: async () => ({ error: "places_upstream", message: "Google Places request failed (403)." }),
      }),
      [],
    );
  }
  assert.deepEqual(await readNearbyPlaces({ status: 502, json: async () => { throw new Error("bad json"); } }), []);
});

test("nearby cards omit rating and website until one place details call", () => {
  const places = placesFromNearbyResponse(200, {
    places: [
      card,
      { ...card, placeId: "skip-me", provider: "mapbox" },
      { ...card, placeId: "no-coords", lat: null },
      {
        ...card,
        placeId: "keyed-photo",
        photoUrl: "https://maps.googleapis.com/maps/api/place/photo?key=secret",
        photoUrls: ["https://maps.googleapis.com/maps/api/place/photo?key=secret"],
      },
      ...Array.from({ length: 8 }, (_, i) => ({ ...card, placeId: `extra-${i}` })),
    ],
  });
  assert.equal(places.length, 7);
  assert.deepEqual(places.map((row) => row.placeId), [
    "ChIJgoogle123",
    "keyed-photo",
    "extra-0",
    "extra-1",
    "extra-2",
    "extra-3",
    "extra-4",
  ]);
  assert.equal(places[1]!.photoUrl, null);
  assert.equal(places[0]!.rating, null);
  assert.equal(places[0]!.userRatingCount, null);
  assert.equal(places[0]!.websiteUri, null);
  assert.equal(places[0]!.photoUrl, card.photoUrl);
  assert.deepEqual(places[0]!.photoUrls, [card.photoUrl]);
  const second =
    "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Ftwo&maxWidthPx=400";
  const third =
    "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Fthree&maxWidthPx=400";
  const paired = placesFromNearbyResponse(200, {
    places: [
      {
        ...card,
        photoUrls: [card.photoUrl, second, third, "https://maps.googleapis.com/x?key=secret"],
      },
    ],
  });
  assert.deepEqual(paired[0]!.photoUrls, [card.photoUrl, second, third]);
  assert.equal(paired[0]!.photoUrl, card.photoUrl);
  const lone = { ...card } as Record<string, unknown>;
  delete lone.photoUrls;
  const fromCompat = placesFromNearbyResponse(200, { places: [lone] });
  assert.deepEqual(fromCompat[0]!.photoUrls, [card.photoUrl]);

  const nearbyVenue = venueFromNearbyCard(places[0]!, "2026-10-03T12:00:00.000Z");
  assert.equal(nearbyVenue.provider, "google");
  assert.equal(nearbyVenue.source, "places");
  assert.equal(nearbyVenue.placeId, "ChIJgoogle123");
  assert.equal(nearbyVenue.rating, null);
  assert.equal(nearbyVenue.userRatingCount, null);
  assert.equal(nearbyVenue.websiteUri, null);
  assert.equal(nearbyVenue.photoUrl, card.photoUrl);
  assert.equal(nearbyVenue.googleMapsUri, "https://maps.google.com/?cid=1");

  const query = placeDetailsQuery("ChIJgoogle123");
  assert.equal(query, "/api/places/google?placeId=ChIJgoogle123");
  assert.equal(query.includes("key="), false);
  assert.equal(parsePlaceDetail(400, { error: "invalid" }), null);
  assert.equal(parsePlaceDetail(502, { error: "places_upstream" }), null);
  assert.equal(parsePlaceDetail(503, { error: "google_places_not_configured" }), null);

  const detail = parsePlaceDetail(200, {
    place: {
      placeId: "ChIJgoogle123",
      name: "Joes Bar",
      formattedAddress: "1 Main St, New York, NY",
      lat: 40.7128,
      lng: -74.006,
      category: "bar",
      provider: "google",
      rating: 4.6,
      userRatingCount: 321,
      photoUrl: null,
      websiteUri: "https://example.com",
      googleMapsUri: "https://maps.google.com/?cid=1",
    },
  });
  const merged = mergePlaceDetail(places[0]!, detail);
  assert.equal(merged.rating, 4.6);
  assert.equal(merged.userRatingCount, 321);
  assert.equal(merged.websiteUri, "https://example.com");
  assert.equal(merged.photoUrl, card.photoUrl);
  assert.deepEqual(merged.photoUrls, [card.photoUrl]);
  assert.equal(mergePlaceDetail(places[0]!, detail && { ...detail, placeId: "other" }).rating, null);
  const venue = venueFromNearbyCard(merged, "2026-10-03T12:00:00.000Z");
  assert.equal(venue.rating, 4.6);
  assert.equal(venue.userRatingCount, 321);
  assert.equal(venue.websiteUri, "https://example.com");
  assert.equal(venue.photoUrl, card.photoUrl);
  assert.equal(formatPlaceRating(venue.rating, venue.userRatingCount), "Google rating 4.6 · 321 reviews");
  assert.equal(formatPlaceRating(4.2, null), "Google rating 4.2");
  assert.equal(formatPlaceRating(5, 1), "Google rating 5.0 · 1 review");
  assert.equal(formatPlaceRating(null, 10), null);
});

test("nearby cards are a short horizontal swipe with the photo as the background", () => {
  const html = renderToStaticMarkup(<NearbyPlaceCards places={[card]} onSelect={() => {}} />);
  assert.match(html, /Joes Bar/);
  assert.match(html, /1 Main St, New York, NY/);
  assert.match(html, /Bar/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /h-\[220px\]/);
  assert.match(html, /object-cover/);
  assert.match(html, /Powered by Google/);
  assert.match(html, /\/api\/places\/photo\?name=/);
  assert.doesNotMatch(html, /4\.6/);
  assert.doesNotMatch(html, /example\.com/);
  assert.doesNotMatch(html, /[?&]key=/);
  assert.equal(renderToStaticMarkup(<NearbyPlaceCards places={[]} onSelect={() => {}} />), "");
  const secondPhoto =
    "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Ftwo&maxWidthPx=400";
  const pair = renderToStaticMarkup(
    <NearbyPlaceCards
      places={[{ ...card, photoUrl: card.photoUrl, photoUrls: [card.photoUrl!, secondPhoto] }]}
      onSelect={() => {}}
    />,
  );
  assert.match(pair, /photos%2Fref/);
  assert.doesNotMatch(pair, /photos%2Ftwo/);
  assert.equal(pair.match(/<img /g)?.length, 1);
  assert.doesNotMatch(pair, /4\.6/);
});

test("place detail shows the nearby photo and rating only from place details", () => {
  const before = renderToStaticMarkup(<NearbyPlaceDetail card={card} />);
  assert.match(before, /1 Main St, New York, NY/);
  assert.match(before, /\/api\/places\/photo\?name=/);
  assert.match(before, /Powered by Google/);
  assert.doesNotMatch(before, /4\.6/);
  assert.doesNotMatch(before, /example\.com/);

  const html = renderToStaticMarkup(
    <NearbyPlaceDetail
      card={{ ...card, category: "coffee_shop" }}
      detail={{
        placeId: card.placeId,
        name: card.name,
        formattedAddress: card.formattedAddress,
        lat: card.lat,
        lng: card.lng,
        category: "coffee_shop",
        rating: 4.6,
        userRatingCount: 321,
        websiteUri: "https://example.com",
        googleMapsUri: card.googleMapsUri,
      }}
    />,
  );
  assert.match(html, /1 Main St, New York, NY/);
  assert.match(html, /Google rating 4\.6 · 321 reviews/);
  assert.match(html, /\/api\/places\/static-map\?lat=40\.7128&(?:amp;)?lng=-74\.006&(?:amp;)?w=600&(?:amp;)?h=220&(?:amp;)?z=15/);
  assert.doesNotMatch(html, /access_token|api\.mapbox\.com/);
  assert.match(html, /Coffee shop/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /href="https:\/\/maps.google.com\/\?cid=1"/);
  assert.match(html, /Website/);
  assert.match(html, /Maps/);
  assert.match(html, /Powered by Google/);
  assert.match(html, /object-cover/);
  assert.equal(formatPlaceCategory("bar"), "Bar");
  assert.equal(httpHref("javascript:alert(1)"), null);
  const secondPhoto =
    "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Ftwo&maxWidthPx=400";
  const two = renderToStaticMarkup(
    <NearbyPlaceDetail card={{ ...card, photoUrl: card.photoUrl, photoUrls: [card.photoUrl!, secondPhoto] }} />,
  );
  assert.match(two, /overflow-x-auto/);
  assert.match(two, /photos%2Fref/);
  assert.match(two, /photos%2Ftwo/);
  assert.equal(two.match(/<img /g)?.length, 3);
  const thirdPhoto =
    "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Fthree&maxWidthPx=400";
  const fourthPhoto =
    "https://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2Ffour&maxWidthPx=400";
  const gallery = renderToStaticMarkup(
    <NearbyPlaceDetail
      card={{
        ...card,
        photoUrl: card.photoUrl,
        photoUrls: [card.photoUrl!, secondPhoto, thirdPhoto, fourthPhoto],
      }}
    />,
  );
  assert.match(gallery, /overflow-x-auto/);
  assert.match(gallery, /photos%2Fthree/);
  assert.doesNotMatch(gallery, /photos%2Ffour/);
  assert.equal(gallery.match(/<img /g)?.length, 4);
  assert.match(two, /w=600&(?:amp;)?h=220&(?:amp;)?z=15/);
  assert.doesNotMatch(two, /access_token|api\.mapbox\.com/);
  assert.doesNotMatch(two, /4\.6/);
  assert.deepEqual(
    placePhotos({
      photoUrl: card.photoUrl,
      photoUrls: [card.photoUrl, "https://evil.test/p?key=secret", "https://api.test/api/places/photo?name=b&maxWidthPx=400"],
    }),
    [card.photoUrl, "https://api.test/api/places/photo?name=b&maxWidthPx=400"],
  );
  assert.deepEqual(
    placePhotos({
      photoUrl: "https://api.test/fallback",
      photoUrls: [
        "https://api.test/a",
        "https://api.test/b",
        "https://api.test/c",
        "https://api.test/d",
      ],
    }),
    ["https://api.test/a", "https://api.test/b", "https://api.test/c"],
  );
  assert.deepEqual(placePhotos({ photoUrl: card.photoUrl, photoUrls: [] }), [card.photoUrl]);

  const loopback =
    "http://0.0.0.0:43147/api/places/photo?name=places%2Fabc%2Fphotos%2Fref&maxWidthPx=400";
  const rewritten = photoUrlForClient(loopback, "http://192.168.1.20:43147");
  assert.ok(rewritten);
  const rewrittenUrl = new URL(rewritten);
  assert.equal(rewrittenUrl.origin, "http://192.168.1.20:43147");
  assert.equal(rewrittenUrl.pathname, "/api/places/photo");
  assert.equal(rewrittenUrl.searchParams.get("name"), "places/abc/photos/ref");
  assert.equal(rewrittenUrl.searchParams.get("maxWidthPx"), "400");
  assert.equal(
    new URL(photoUrlForClient("http://127.0.0.1:43147/api/places/photo?name=a", "https://lan.example:43147")!).origin,
    "https://lan.example:43147",
  );
  assert.equal(
    new URL(photoUrlForClient("http://localhost:43147/api/places/photo?name=a", "http://10.0.2.2:43147/")!).host,
    "10.0.2.2:43147",
  );
  assert.equal(
    photoUrlForClient("https://api.test/api/places/photo?name=a", "http://192.168.1.20:43147"),
    "https://api.test/api/places/photo?name=a",
  );
  assert.equal(
    photoUrlForClient("http://0.0.0.0:43147/api/places/photo?key=secret", "http://10.0.0.2:43147"),
    null,
  );
  const shifted = placePhotos(
    {
      photoUrls: [loopback, "http://127.0.0.1:43147/api/places/photo?name=second"],
    },
    "http://192.168.1.20:43147",
  );
  assert.equal(shifted.length, 2);
  assert.equal(new URL(shifted[0]!).origin, "http://192.168.1.20:43147");
  assert.equal(new URL(shifted[1]!).origin, "http://192.168.1.20:43147");
  assert.equal(new URL(shifted[1]!).searchParams.get("name"), "second");

  const relative = photoUrlForClient(
    "/api/places/photo?name=places%2Fabc%2Fphotos%2Fref&maxWidthPx=400",
    "http://192.168.1.20:43147",
  );
  assert.ok(relative);
  const relativeUrl = new URL(relative);
  assert.equal(relativeUrl.origin, "http://192.168.1.20:43147");
  assert.equal(relativeUrl.pathname, "/api/places/photo");
  assert.equal(relativeUrl.searchParams.get("name"), "places/abc/photos/ref");
  assert.equal(relativeUrl.searchParams.get("maxWidthPx"), "400");
  assert.equal(
    photoUrlForClient("/api/places/photo?name=a&maxWidthPx=400", ""),
    "/api/places/photo?name=a&maxWidthPx=400",
  );
  assert.deepEqual(
    placePhotos(
      { photoUrl: "/api/places/photo?name=only", photoUrls: [] },
      "http://10.0.2.2:43147",
    ).map((url) => new URL(url).href),
    ["http://10.0.2.2:43147/api/places/photo?name=only"],
  );
  const map = staticMapForClient(40.7128, -74.006, "http://192.168.1.20:43147");
  const mapUrl = new URL(map);
  assert.equal(mapUrl.origin, "http://192.168.1.20:43147");
  assert.equal(mapUrl.pathname, "/api/places/static-map");
  assert.equal(mapUrl.searchParams.get("lat"), "40.7128");
  assert.equal(mapUrl.searchParams.get("lng"), "-74.006");
  assert.equal(mapUrl.searchParams.get("w"), "600");
  assert.equal(mapUrl.searchParams.get("h"), "220");
  assert.equal(mapUrl.searchParams.get("z"), "15");
  assert.equal(mapUrl.searchParams.has("access_token"), false);
  assert.equal(
    staticMapForClient(40.7128, -74.006, ""),
    "/api/places/static-map?lat=40.7128&lng=-74.006&w=600&h=220&z=15",
  );
});

test("selecting a nearby card does not call the typeahead bridge", () => {
  const web = readFileSync(new URL("../components/venue-typeahead.tsx", import.meta.url), "utf8");
  const mobile = readFileSync(
    new URL("../../apps/mobile/src/components/venue-typeahead.tsx", import.meta.url),
    "utf8",
  );
  const mobilePlaces = readFileSync(
    new URL("../../apps/mobile/src/lib/places.ts", import.meta.url),
    "utf8",
  );
  const webSelect = between(web, "const selectNearbyCard =", "const onSelect =");
  const mobileSelect = between(mobile, "const selectNearbyCard =", "const onSelect =");
  assert.match(webSelect, /onOpenNearby/);
  assert.doesNotMatch(webSelect, /bridgeSelectedVenue|\/api\/places\/bridge|venueFromNearbyCard/);
  assert.match(mobileSelect, /rememberNearbyPlan/);
  assert.match(mobileSelect, /venueFromNearbyCard/);
  assert.match(mobileSelect, /\/host\/place/);
  assert.doesNotMatch(mobileSelect, /bridgeToGooglePlace|\/api\/places\/bridge|resolvePlaceDetails/);
  for (const source of [web, mobile]) {
    assert.match(source, /shouldShowNearbyCards\(value\)/);
  }
  assert.match(web, /nearbyQuery\(/);
  assert.match(mobile, /fetchNearbyPlaces\(/);
  const interview = readFileSync(new URL("../components/host-interview.tsx", import.meta.url), "utf8");
  const planNearby = between(interview, "function planNearby", "const back");
  assert.match(planNearby, /mergePlaceDetail/);
  assert.match(planNearby, /venueFromNearbyCard/);
  assert.match(interview, /Plan here/);
  assert.doesNotMatch(planNearby, /\/api\/places\/bridge/);
  const placeScreen = readFileSync(
    new URL("../../apps/mobile/src/app/host/place.tsx", import.meta.url),
    "utf8",
  );
  assert.match(placeScreen, /Plan here/);
  assert.match(placeScreen, /router\.back/);
  assert.match(placeScreen, /fetchPlaceDetail/);
  assert.match(placeScreen, /mergePlaceDetail/);
  assert.match(placeScreen, /horizontal/);
  assert.match(placeScreen, /placePhotos\(card, getApiUrl\(\)\)/);
  assert.doesNotMatch(placeScreen, /detail\.photoUrl|detail\?\.photoUrls/);
  assert.doesNotMatch(placeScreen, /\/api\/places\/bridge/);
  assert.doesNotMatch(placeScreen, /card\.rating|card\?\.websiteUri|card\.websiteUri/);
  const cardsWeb = readFileSync(
    new URL("../components/nearby-place-cards.tsx", import.meta.url),
    "utf8",
  );
  const cardsMobile = readFileSync(
    new URL("../../apps/mobile/src/components/nearby-place-cards.tsx", import.meta.url),
    "utf8",
  );
  const detailWeb = readFileSync(
    new URL("../components/nearby-place-detail.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(cardsWeb, /placeDetailsQuery|\/api\/places\/google/);
  assert.doesNotMatch(cardsMobile, /placeDetailsQuery|\/api\/places\/google/);
  assert.match(cardsMobile, /width: cardWidth/);
  assert.match(cardsMobile, /height: CARD_HEIGHT/);
  assert.doesNotMatch(cardsMobile, /flex:\s*1/);
  assert.match(detailWeb, /placeDetailsQuery/);
  assert.match(detailWeb, /placePhotos\(card/);
  assert.doesNotMatch(detailWeb, /detail\.photoUrl|detail\?\.photoUrls/);
  assert.match(
    readFileSync(new URL("../components/nearby-place-cards.tsx", import.meta.url), "utf8"),
    /overflow-x-auto/,
  );
  assert.match(
    readFileSync(new URL("../../apps/mobile/src/components/nearby-place-cards.tsx", import.meta.url), "utf8"),
    /horizontal/,
  );
  assert.match(
    readFileSync(new URL("../components/nearby-place-cards.tsx", import.meta.url), "utf8"),
    /Powered by Google/,
  );
  assert.match(
    readFileSync(new URL("../../apps/mobile/src/components/nearby-place-cards.tsx", import.meta.url), "utf8"),
    /Powered by Google/,
  );

  const fetchNearby = between(
    mobilePlaces,
    "export async function fetchNearbyPlaces",
    "export async function resolvePlaceDetails",
  );
  assert.match(fetchNearby, /nearbyQuery/);
  assert.match(fetchNearby, /catch/);
  assert.doesNotMatch(fetchNearby, /placeId/);
  assert.doesNotMatch(fetchNearby, /\/api\/places\/google/);
  assert.match(mobilePlaces, /export async function fetchPlaceDetail/);
  assert.match(mobilePlaces, /placeDetailsQuery/);

  for (const file of [
    web,
    mobile,
    mobilePlaces,
    readFileSync(new URL("./nearby-place-card.ts", import.meta.url), "utf8"),
    readFileSync(new URL("../components/nearby-place-cards.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../../apps/mobile/src/components/nearby-place-cards.tsx", import.meta.url), "utf8"),
  ]) {
    assert.doesNotMatch(file, /process\.env\.GOOGLE_PLACES_API_KEY/);
    assert.doesNotMatch(file, /NEXT_PUBLIC_GOOGLE/);
    assert.doesNotMatch(file, /\/api\/places\/place/);
  }
  assert.match(
    readFileSync(new URL("./nearby-place-card.ts", import.meta.url), "utf8"),
    /\/api\/places\/google\?placeId=/,
  );
});
