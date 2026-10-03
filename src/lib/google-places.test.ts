import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET as bridgeGET } from "../app/api/places/bridge/route";
import { GET as pickedGET } from "../app/api/places/google/route";
import { GET as nearbyGET } from "../app/api/places/nearby/route";
import { GET as photoGET } from "../app/api/places/photo/route";
import {
  bridgePlaceToGoogle,
  clearNearbyCache,
  fetchPlacePhoto,
  forgetPlacesCacheProcessMemoryForTests,
  geohash,
  NEARBY_CACHE_MAX_AGE_SECONDS,
  NEARBY_CACHE_TTL_MS,
  NEARBY_LIMIT,
  NEARBY_PHOTO_LIMIT,
  PHOTO_CACHE_CONTROL,
  PHOTO_MAX_WIDTH_PX,
  searchNearby,
  setGooglePlacesClockForTests,
} from "./google-places";
import { useFilePlacesCacheForTests } from "./places-cache";
import type { ReceiptVenue } from "./types";
import { venueLocationKey } from "./venue-day";

const KEY = "test-places-key";
const MAPBOX_ID = "mapbox.should-not-leak";
const ORIGINAL_KEY = process.env.GOOGLE_PLACES_API_KEY;
const ORIGINAL_FETCH = globalThis.fetch;

type Call = { url: string; method: string; headers: Headers; body: string | null };

function installFetch(handler: (call: Call) => Response | Promise<Response>): { calls: Call[] } {
  const calls: Call[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
    };
    calls.push(call);
    return handler(call);
  };
  return { calls };
}

function fieldMask(call: Call): string[] {
  return (call.headers.get("X-Goog-FieldMask") ?? "").split(",").filter(Boolean);
}

function googlePlace(over: Record<string, unknown> = {}) {
  return {
    id: "ChIJgoogle123",
    displayName: { text: "Joe's Bar" },
    formattedAddress: "1 Main St, New York, NY",
    location: { latitude: 40.7128, longitude: -74.006 },
    rating: 4.6,
    userRatingCount: 321,
    photos: [{ name: "places/ChIJgoogle123/photos/AbCd_12" }],
    websiteUri: "https://joes.example/bar",
    googleMapsUri: "https://maps.google.com/?cid=1",
    primaryType: "bar",
    ...over,
  };
}

beforeEach(async () => {
  useFilePlacesCacheForTests();
  await clearNearbyCache();
  setGooglePlacesClockForTests(null);
  delete process.env.GOOGLE_PLACES_API_KEY;
});

afterEach(async () => {
  globalThis.fetch = ORIGINAL_FETCH;
  await clearNearbyCache();
  setGooglePlacesClockForTests(null);
  if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_KEY;
});

describe("google places fail closed", () => {
  for (const key of [undefined, "", "   ", "\n\t"] as const) {
    it(`nearby does not call Google when the key is ${JSON.stringify(key)}`, async () => {
      if (key !== undefined) process.env.GOOGLE_PLACES_API_KEY = key;
      const { calls } = installFetch(() => {
        throw new Error("Google must not be called");
      });
      const res = await nearbyGET(
        new Request("http://api.test/api/places/nearby?lat=40.7128&lng=-74.006"),
      );
      const body = (await res.json()) as { error?: string; message?: string };
      assert.equal(res.status, 503);
      assert.equal(body.error, "google_places_not_configured");
      assert.match(body.message ?? "", /GOOGLE_PLACES_API_KEY/);
      assert.equal(calls.length, 0);
    });
  }

  it("photo and bridge do not call Google without a key", async () => {
    const { calls } = installFetch(() => {
      throw new Error("Google must not be called");
    });
    const photo = await photoGET(
      new Request(
        "http://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2FAbCd_12",
      ),
    );
    const bridge = await bridgeGET(
      new Request("http://api.test/api/places/bridge?name=Joe%27s%20Bar&lat=40.71&lng=-74.01"),
    );
    assert.equal(photo.status, 503);
    assert.equal(((await photo.json()) as { error?: string }).error, "google_places_not_configured");
    assert.equal(bridge.status, 503);
    assert.equal(((await bridge.json()) as { error?: string }).error, "google_places_not_configured");
    assert.equal(calls.length, 0);
    await assert.rejects(bridgePlaceToGoogle({ name: "Joe's Bar", lat: 40.71, lng: -74.01 }), {
      code: "google_places_not_configured",
    });
    assert.equal(calls.length, 0);
  });

  it("does not echo the key when Google fails", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    installFetch(
      () => new Response(`denied ${KEY}`, { status: 403, headers: { "Content-Type": "text/plain" } }),
    );
    const res = await nearbyGET(
      new Request("http://api.test/api/places/nearby?lat=40.7128&lng=-74.006"),
    );
    const text = await res.text();
    assert.equal(res.status, 502);
    assert.equal(text.includes(KEY), false);
  });
});

describe("google places nearby", () => {
  it("requests seven nearby places and caches by geohash", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    let now = 1_700_000_000_000;
    setGooglePlacesClockForTests(() => now);
    const { calls } = installFetch(
      () =>
        new Response(JSON.stringify({ places: [googlePlace()] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const first = await searchNearby({ lat: 40.7128, lng: -74.006, origin: "https://api.test" });
    assert.equal(first.cached, false);
    assert.equal(first.limit, NEARBY_LIMIT);
    assert.equal(first.places.length, 1);
    assert.equal(first.places[0]?.provider, "google");
    assert.equal("rating" in (first.places[0] ?? {}), false);
    assert.equal("userRatingCount" in (first.places[0] ?? {}), false);
    assert.equal("websiteUri" in (first.places[0] ?? {}), false);
    assert.equal(first.places[0]?.photoUrl?.includes(KEY), false);
    assert.equal(first.places[0]?.photoUrl?.includes("googleapis.com"), false);
    assert.match(first.places[0]?.photoUrl ?? "", /\/api\/places\/photo\?/);
    assert.match(first.places[0]?.photoUrl ?? "", /maxWidthPx=400/);
    assert.equal(first.places[0]?.photoUrls?.length, 1);
    assert.equal(first.places[0]?.photoUrl, first.places[0]?.photoUrls?.[0]);

    const cell = geohash(40.7128, -74.006, 6);
    let nudgedLat = 40.7128;
    for (let step = 1; step <= 40; step += 1) {
      const candidate = 40.7128 + step * 0.00005;
      if (geohash(candidate, -74.006, 6) === cell) nudgedLat = candidate;
    }
    assert.notEqual(nudgedLat, 40.7128);
    const second = await searchNearby({ lat: nudgedLat, lng: -74.006, origin: "https://api.test" });
    assert.equal(second.cached, true);
    assert.equal(calls.length, 1);

    forgetPlacesCacheProcessMemoryForTests();
    const afterRestart = await searchNearby({ lat: 40.7128, lng: -74.006, origin: "https://api.test" });
    assert.equal(afterRestart.cached, true);
    assert.equal(calls.length, 1);

    now += 8 * 60 * 1000;
    const withinMonth = await searchNearby({ lat: 40.7128, lng: -74.006, origin: "https://api.test" });
    assert.equal(withinMonth.cached, true);
    assert.equal(calls.length, 1);

    now += NEARBY_CACHE_TTL_MS;
    const third = await searchNearby({ lat: 40.7128, lng: -74.006, origin: "https://api.test" });
    assert.equal(third.cached, false);
    assert.equal(calls.length, 2);

    const call = calls[0]!;
    assert.equal(call.url, "https://places.googleapis.com/v1/places:searchNearby");
    assert.equal(call.url.includes("/v1/places/"), false);
    assert.equal(call.headers.get("X-Goog-Api-Key"), KEY);
    const nearbyMask = fieldMask(call);
    assert.equal(nearbyMask.includes("places.rating"), false);
    assert.equal(nearbyMask.includes("places.userRatingCount"), false);
    assert.equal(nearbyMask.includes("places.websiteUri"), false);
    assert.equal(nearbyMask.includes("places.photos"), true);
    assert.equal(nearbyMask.includes("places.displayName"), true);
    assert.equal(nearbyMask.includes("places.location"), true);
    assert.equal(nearbyMask.includes("places.primaryType"), true);
    assert.equal(call.url.includes(MAPBOX_ID), false);
    const body = JSON.parse(call.body ?? "{}") as {
      maxResultCount?: number;
      rankPreference?: string;
      includedTypes?: string[];
      includedPrimaryTypes?: string[];
      locationRestriction?: { circle?: { center?: { latitude?: number; longitude?: number }; radius?: number } };
      placeId?: string;
    };
    assert.equal(body.maxResultCount, 7);
    assert.equal(body.rankPreference, "POPULARITY");
    assert.equal(body.placeId, undefined);
    assert.equal(body.includedTypes, undefined);
    assert.deepEqual(body.includedPrimaryTypes, [
      "restaurant",
      "bar",
      "cafe",
      "bakery",
      "coffee_shop",
    ]);
    assert.equal(body.locationRestriction?.circle?.center?.latitude, 40.7128);
    assert.equal(body.locationRestriction?.circle?.center?.longitude, -74.006);
    assert.equal(body.locationRestriction?.circle?.radius, 1500);
    assert.equal(JSON.stringify(body).includes(MAPBOX_ID), false);
  });

  it("sends Washington DC coordinates unswapped and drops a Dubai place", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    const { calls } = installFetch(
      () =>
        new Response(
          JSON.stringify({
            places: [
              googlePlace({
                id: "ChIJdc",
                displayName: { text: "Le Diplomate" },
                formattedAddress: "1601 14th St NW, Washington, DC",
                location: { latitude: 38.911, longitude: -77.032 },
                primaryType: "italian_restaurant",
              }),
              googlePlace({
                id: "ChIJdubai",
                displayName: { text: "Dubai Grill" },
                formattedAddress: "Dubai",
                location: { latitude: 25.2048, longitude: 55.2708 },
                primaryType: "restaurant",
              }),
              googlePlace({
                id: "ChIJnoloc",
                displayName: { text: "Missing Pin" },
                location: undefined,
                primaryType: "cafe",
              }),
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const res = await nearbyGET(
      new Request("http://api.test/api/places/nearby?lat=38.9072&lng=-77.0369"),
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), `private, max-age=${NEARBY_CACHE_MAX_AGE_SECONDS}`);
    const data = (await res.json()) as {
      places: Array<{ placeId: string; category: string | null; lat: number | null; lng: number | null }>;
    };
    assert.deepEqual(
      data.places.map((place) => place.placeId),
      ["ChIJdc"],
    );
    assert.equal(data.places[0]?.category, "italian_restaurant");
    assert.equal("rating" in (data.places[0] ?? {}), false);
    assert.equal("websiteUri" in (data.places[0] ?? {}), false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://places.googleapis.com/v1/places:searchNearby");
    const nearbyMask = fieldMask(calls[0]!);
    assert.equal(nearbyMask.includes("places.rating"), false);
    assert.equal(nearbyMask.includes("places.userRatingCount"), false);
    assert.equal(nearbyMask.includes("places.websiteUri"), false);
    const body = JSON.parse(calls[0]!.body ?? "{}") as {
      rankPreference?: string;
      includedTypes?: string[];
      includedPrimaryTypes?: string[];
      locationRestriction?: {
        circle?: { center?: { latitude?: number; longitude?: number }; radius?: number };
      };
    };
    assert.equal(body.rankPreference, "POPULARITY");
    assert.equal(body.includedTypes, undefined);
    assert.deepEqual(body.includedPrimaryTypes, [
      "restaurant",
      "bar",
      "cafe",
      "bakery",
      "coffee_shop",
    ]);
    assert.equal(body.locationRestriction?.circle?.center?.latitude, 38.9072);
    assert.equal(body.locationRestriction?.circle?.center?.longitude, -77.0369);
    assert.equal(body.locationRestriction?.circle?.radius, 1500);
  });

  it("returns at most two proxied photos and keeps photoUrl as the first", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    installFetch(
      () =>
        new Response(
          JSON.stringify({
            places: [
              googlePlace({
                photos: [
                  { name: "places/ChIJgoogle123/photos/FirstPhoto1" },
                  { name: "places/ChIJgoogle123/photos/SecondPhoto" },
                  { name: "places/ChIJgoogle123/photos/ThirdPhotoX" },
                  { name: "places/ChIJgoogle123/photos/FirstPhoto1" },
                  { name: "not-a-photo" },
                ],
                rating: 4.9,
                userRatingCount: 10,
                websiteUri: "https://joes.example/bar",
              }),
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const result = await searchNearby({ lat: 40.7128, lng: -74.006, origin: "https://api.test" });
    const place = result.places[0];
    assert.equal(place?.photoUrls?.length, NEARBY_PHOTO_LIMIT);
    assert.equal(place?.photoUrl, place?.photoUrls?.[0]);
    assert.match(place?.photoUrls?.[0] ?? "", /FirstPhoto1/);
    assert.match(place?.photoUrls?.[1] ?? "", /SecondPhoto/);
    assert.equal(place?.photoUrls?.some((url) => url.includes("ThirdPhotoX")), false);
    assert.equal(place?.photoUrls?.every((url) => url.startsWith("https://api.test/api/places/photo?")), true);
    assert.equal(place?.photoUrls?.some((url) => url.includes(KEY) || url.includes("googleapis.com")), false);
    assert.equal("rating" in (place ?? {}), false);
    assert.equal("userRatingCount" in (place ?? {}), false);
    assert.equal("websiteUri" in (place ?? {}), false);
  });

  it("rejects bad coordinates without calling Google", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    const { calls } = installFetch(() => {
      throw new Error("Google must not be called");
    });
    const res = await nearbyGET(new Request("http://api.test/api/places/nearby?lat=nope&lng=-74"));
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });
});

describe("google places bridge", () => {
  it("resolves a Google place id from name and coordinates, never a mapbox id", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    const { calls } = installFetch(
      () =>
        new Response(
          JSON.stringify({
            places: [
              {
                id: "ChIJgoogle123",
                name: "places/ChIJgoogle123",
                displayName: { text: "Some Other Cafe" },
                rating: 4.6,
                userRatingCount: 321,
                websiteUri: "https://joes.example/bar",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const res = await bridgeGET(
      new Request(
        `http://api.test/api/places/bridge?name=${encodeURIComponent("Joe's Bar")}&lat=40.7128&lng=-74.006&placeId=${encodeURIComponent(MAPBOX_ID)}`,
      ),
    );
    const data = (await res.json()) as {
      bridged?: boolean;
      place?: {
        placeId: string;
        provider: string;
        name: string;
        lat: number;
        lng: number;
        photoUrl: string | null;
        googleMapsUri: string | null;
      };
    };
    assert.equal(res.status, 200);
    assert.equal(data.bridged, true);
    assert.equal(data.place?.placeId, "ChIJgoogle123");
    assert.equal(data.place?.name, "Joe's Bar");
    assert.equal(data.place?.provider, "google");
    assert.equal(data.place?.lat, 40.7128);
    assert.equal(data.place?.lng, -74.006);
    assert.equal(data.place?.photoUrl, null);
    assert.equal(data.place?.googleMapsUri, null);
    assert.equal("rating" in (data.place ?? {}), false);
    assert.equal("userRatingCount" in (data.place ?? {}), false);
    assert.equal("websiteUri" in (data.place ?? {}), false);

    assert.equal(calls.length, 1);
    const call = calls[0]!;
    assert.equal(call.url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(call.url.includes("/v1/places/"), false);
    assert.equal(call.url.includes(MAPBOX_ID), false);
    assert.equal(call.headers.get("X-Goog-Api-Key"), KEY);
    assert.deepEqual(fieldMask(call), ["places.id", "places.name"]);
    const body = JSON.parse(call.body ?? "{}") as {
      textQuery?: string;
      maxResultCount?: number;
      placeId?: string;
      locationBias?: { circle?: { center?: { latitude?: number; longitude?: number } } };
    };
    assert.equal(body.textQuery, "Joe's Bar");
    assert.equal(body.maxResultCount, 1);
    assert.equal(body.placeId, undefined);
    assert.equal(body.locationBias?.circle?.center?.latitude, 40.7128);
    assert.equal(body.locationBias?.circle?.center?.longitude, -74.006);
    assert.equal(JSON.stringify(body).includes(MAPBOX_ID), false);
    assert.equal(calls.some((c) => c.url.includes("places:searchNearby")), false);

    const venue: ReceiptVenue = {
      name: data.place!.name,
      placeId: data.place!.placeId,
      provider: "google",
      formattedAddress: null,
      lat: data.place!.lat,
      lng: data.place!.lng,
      category: null,
      source: "places",
      confirmedAt: "2026-10-03T00:00:00.000Z",
      photoUrl: data.place!.photoUrl,
      googleMapsUri: data.place!.googleMapsUri,
    };
    assert.equal(venueLocationKey(venue), "place:google:ChIJgoogle123");
  });

  it("returns no place when Text Search returns no id", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    installFetch(
      () =>
        new Response(JSON.stringify({ places: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const place = await bridgePlaceToGoogle({
      name: "Completely Different",
      lat: 40.7128,
      lng: -74.006,
    });
    assert.equal(place, null);
    const res = await bridgeGET(
      new Request("http://api.test/api/places/bridge?name=Completely%20Different&lat=40.7128&lng=-74.006"),
    );
    const body = (await res.json()) as { bridged?: boolean; place?: null };
    assert.equal(body.bridged, false);
    assert.equal(body.place, null);
  });

  it("typeahead callers send name and coordinates, not placeId", () => {
    const mobile = readFileSync(new URL("../../apps/mobile/src/lib/places.ts", import.meta.url), "utf8");
    const web = readFileSync(new URL("../components/venue-typeahead.tsx", import.meta.url), "utf8");
    for (const source of [mobile, web]) {
      const nameAt = source.indexOf("name: venue.name.trim()");
      assert.notEqual(nameAt, -1);
      const head = source.lastIndexOf("URLSearchParams({", nameAt);
      const block = source.slice(head, source.indexOf("});", nameAt));
      assert.match(block, /name:/);
      assert.match(block, /lat:/);
      assert.match(block, /lng:/);
      assert.equal(block.includes("placeId"), false);
    }
  });
});

describe("picked google place", () => {
  it("loads rating and website for one place and rejects a mapbox id", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    const { calls } = installFetch(
      () =>
        new Response(JSON.stringify(googlePlace({ photos: undefined })), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const res = await pickedGET(
      new Request("http://api.test/api/places/google?placeId=ChIJgoogle123"),
    );
    const data = (await res.json()) as {
      place?: {
        placeId: string;
        rating: number;
        userRatingCount: number;
        websiteUri: string;
        photoUrl: string | null;
      };
    };
    assert.equal(res.status, 200);
    assert.equal(data.place?.placeId, "ChIJgoogle123");
    assert.equal(data.place?.rating, 4.6);
    assert.equal(data.place?.userRatingCount, 321);
    assert.equal(data.place?.websiteUri, "https://joes.example/bar");
    assert.equal(data.place?.photoUrl, null);

    assert.equal(calls.length, 1);
    const call = calls[0]!;
    assert.equal(call.url, "https://places.googleapis.com/v1/places/ChIJgoogle123");
    assert.equal(call.url.includes(KEY), false);
    assert.equal(call.method, "GET");
    assert.deepEqual(fieldMask(call), [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "primaryType",
      "googleMapsUri",
      "rating",
      "userRatingCount",
      "websiteUri",
    ]);
    assert.equal(fieldMask(call).includes("photos"), false);
    assert.equal(fieldMask(call).includes("reviews"), false);

    const blocked = await pickedGET(
      new Request(`http://api.test/api/places/google?placeId=${encodeURIComponent(MAPBOX_ID)}`),
    );
    assert.equal(blocked.status, 400);
    assert.equal(calls.length, 1);
  });

  it("does not call Google without a key", async () => {
    const { calls } = installFetch(() => {
      throw new Error("Google must not be called");
    });
    const res = await pickedGET(new Request("http://api.test/api/places/google?placeId=ChIJgoogle123"));
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
  });
});

describe("google places photo", () => {
  it("proxies the image and clamps width to 400", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    const { calls } = installFetch((call) => {
      if (call.url.includes("skipHttpRedirect=true")) {
        return new Response(JSON.stringify({ photoUri: "https://lh3.googleusercontent.com/p/photo" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(Uint8Array.from([9, 8, 7]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    });
    const res = await photoGET(
      new Request(
        "http://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2FAbCd_12&maxWidthPx=4000",
      ),
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "image/jpeg");
    assert.equal(res.headers.get("Cache-Control"), PHOTO_CACHE_CONTROL);
    assert.deepEqual([...bytes], [9, 8, 7]);
    assert.equal(calls.length, 2);

    const photoUrl =
      "http://api.test/api/places/photo?name=places%2FChIJgoogle123%2Fphotos%2FAbCd_12&maxWidthPx=200";
    const again = await photoGET(new Request(photoUrl));
    assert.equal(again.status, 200);
    assert.deepEqual([...(new Uint8Array(await again.arrayBuffer()))], [9, 8, 7]);
    assert.equal(calls.length, 2);

    forgetPlacesCacheProcessMemoryForTests();
    const afterRestart = await photoGET(new Request(photoUrl));
    assert.equal(afterRestart.status, 200);
    assert.deepEqual([...(new Uint8Array(await afterRestart.arrayBuffer()))], [9, 8, 7]);
    assert.equal(calls.length, 2);

    let now = 1_700_000_000_000;
    setGooglePlacesClockForTests(() => now);
    now += NEARBY_CACHE_TTL_MS + 1;
    const samePhotoId = await photoGET(
      new Request(
        "http://api.test/api/places/photo?name=places%2FChIJotherplace%2Fphotos%2FAbCd_12",
      ),
    );
    assert.equal(samePhotoId.status, 200);
    assert.deepEqual([...(new Uint8Array(await samePhotoId.arrayBuffer()))], [9, 8, 7]);
    assert.equal(samePhotoId.headers.get("Cache-Control"), PHOTO_CACHE_CONTROL);
    assert.equal(calls.length, 2);
    assert.equal(calls.some((call) => call.url.includes(KEY)), false);
    assert.match(calls[0]!.url, /\/places\/ChIJgoogle123\/photos\/AbCd_12\/media\?/);
    assert.match(calls[0]!.url, new RegExp(`maxWidthPx=${PHOTO_MAX_WIDTH_PX}`));
    assert.equal(calls[0]!.url.includes("maxWidthPx=4000"), false);
    assert.equal(calls[0]!.headers.get("X-Goog-Api-Key"), KEY);
    assert.equal(calls[0]!.url.includes(KEY), false);
    assert.equal(calls[1]!.url, "https://lh3.googleusercontent.com/p/photo");
    assert.equal(calls[1]!.headers.get("X-Goog-Api-Key"), null);
  });

  it("rejects a non-place photo name without calling Google", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    const { calls } = installFetch(() => {
      throw new Error("Google must not be called");
    });
    const res = await photoGET(
      new Request("http://api.test/api/places/photo?name=https%3A%2F%2Fevil.test%2Fx"),
    );
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
    await assert.rejects(fetchPlacePhoto({ name: "places/../../photos/x" }), { code: "invalid" });
    assert.equal(calls.length, 0);
  });

  it("refuses a photo redirect that contains the API key", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    const { calls } = installFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: `https://lh3.googleusercontent.com/p/x?key=${KEY}` },
        }),
    );
    await assert.rejects(
      fetchPlacePhoto({ name: "places/ChIJgoogle123/photos/AbCd_12" }),
      { code: "places_upstream" },
    );
    assert.equal(calls.length, 1);
  });
});

describe("geohash", () => {
  it("matches the known encoding for a sample point", () => {
    assert.equal(geohash(57.64911, 10.40744, 11), "u4pruydqqvj");
  });
});
