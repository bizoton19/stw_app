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
  nearbyQuery,
  placePhotos,
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

test("a nearby card becomes a google venue with the additive fields", () => {
  const places = placesFromNearbyResponse(200, {
    places: [
      card,
      { ...card, placeId: "skip-me", provider: "mapbox" },
      { ...card, placeId: "no-coords", lat: null },
      {
        ...card,
        placeId: "keyed-photo",
        photoUrl: "https://maps.googleapis.com/maps/api/place/photo?key=secret",
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

  const venue = venueFromNearbyCard(places[0]!, "2026-10-03T12:00:00.000Z");
  assert.equal(venue.provider, "google");
  assert.equal(venue.source, "places");
  assert.equal(venue.placeId, "ChIJgoogle123");
  assert.equal(venue.rating, 4.6);
  assert.equal(venue.userRatingCount, 321);
  assert.equal(venue.photoUrl, card.photoUrl);
  assert.equal(venue.websiteUri, "https://example.com");
  assert.equal(venue.googleMapsUri, "https://maps.google.com/?cid=1");
  assert.equal(formatPlaceRating(venue.rating, venue.userRatingCount), "4.6 · 321");
  assert.equal(formatPlaceRating(4.2, null), "4.2");
  assert.equal(formatPlaceRating(null, 10), null);
});

test("nearby cards are a short horizontal swipe with the photo as the background", () => {
  const html = renderToStaticMarkup(<NearbyPlaceCards places={[card]} onSelect={() => {}} />);
  assert.match(html, /Joes Bar/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /h-\[148px\]/);
  assert.match(html, /object-cover/);
  assert.match(html, /Powered by Google/);
  assert.match(html, /\/api\/places\/photo\?name=/);
  assert.doesNotMatch(html, /[?&]key=/);
  assert.equal(renderToStaticMarkup(<NearbyPlaceCards places={[]} onSelect={() => {}} />), "");
});

test("place detail shows the card photo, details, and links", () => {
  const html = renderToStaticMarkup(
    <NearbyPlaceDetail card={{ ...card, category: "coffee_shop" }} />,
  );
  assert.match(html, /1 Main St, New York, NY/);
  assert.match(html, /4\.6 · 321/);
  assert.match(html, /Coffee shop/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /href="https:\/\/maps.google.com\/\?cid=1"/);
  assert.match(html, /Website/);
  assert.match(html, /Maps/);
  assert.match(html, /Powered by Google/);
  assert.match(html, /object-cover/);
  assert.equal(formatPlaceCategory("bar"), "Bar");
  assert.equal(httpHref("javascript:alert(1)"), null);
  assert.deepEqual(
    placePhotos({
      photoUrl: card.photoUrl,
      photoUrls: [card.photoUrl, "https://evil.test/p?key=secret", "https://api.test/api/places/photo?name=b&maxWidthPx=400"],
    }),
    [card.photoUrl, "https://api.test/api/places/photo?name=b&maxWidthPx=400"],
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
  assert.match(planNearby, /venueFromNearbyCard/);
  assert.match(interview, /Plan here/);
  assert.doesNotMatch(planNearby, /\/api\/places\/bridge/);
  const placeScreen = readFileSync(
    new URL("../../apps/mobile/src/app/host/place.tsx", import.meta.url),
    "utf8",
  );
  assert.match(placeScreen, /Plan here/);
  assert.match(placeScreen, /router\.back/);
  assert.doesNotMatch(placeScreen, /\/api\/places\/bridge/);
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
  }
});
