import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET as bridgeGET } from "../app/api/places/bridge/route";
import { GET as nearbyGET } from "../app/api/places/nearby/route";
import { GET as photoGET } from "../app/api/places/photo/route";
import {
  bridgePlaceToGoogle,
  clearNearbyCache,
  fetchPlacePhoto,
  geohash,
  NEARBY_CACHE_TTL_MS,
  NEARBY_LIMIT,
  PHOTO_MAX_WIDTH_PX,
  searchNearby,
  setGooglePlacesClockForTests,
} from "./google-places";
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

beforeEach(() => {
  clearNearbyCache();
  setGooglePlacesClockForTests(null);
  delete process.env.GOOGLE_PLACES_API_KEY;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  clearNearbyCache();
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
    assert.equal(first.places[0]?.photoUrl?.includes(KEY), false);
    assert.equal(first.places[0]?.photoUrl?.includes("googleapis.com"), false);
    assert.match(first.places[0]?.photoUrl ?? "", /\/api\/places\/photo\?/);
    assert.match(first.places[0]?.photoUrl ?? "", /maxWidthPx=400/);

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

    now += NEARBY_CACHE_TTL_MS + 1;
    const third = await searchNearby({ lat: 40.7128, lng: -74.006, origin: "https://api.test" });
    assert.equal(third.cached, false);
    assert.equal(calls.length, 2);

    const call = calls[0]!;
    assert.equal(call.url, "https://places.googleapis.com/v1/places:searchNearby");
    assert.equal(call.headers.get("X-Goog-Api-Key"), KEY);
    assert.equal(call.url.includes(MAPBOX_ID), false);
    const body = JSON.parse(call.body ?? "{}") as {
      maxResultCount?: number;
      rankPreference?: string;
      includedTypes?: string[];
      locationRestriction?: { circle?: { center?: { latitude?: number; longitude?: number }; radius?: number } };
      placeId?: string;
    };
    assert.equal(body.maxResultCount, 7);
    assert.equal(body.rankPreference, "DISTANCE");
    assert.equal(body.placeId, undefined);
    assert.ok(body.includedTypes?.includes("restaurant"));
    assert.equal(body.locationRestriction?.circle?.center?.latitude, 40.7128);
    assert.equal(body.locationRestriction?.circle?.center?.longitude, -74.006);
    assert.equal(body.locationRestriction?.circle?.radius, 1500);
    assert.equal(JSON.stringify(body).includes(MAPBOX_ID), false);
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
              googlePlace({
                id: "ChIJother",
                displayName: { text: "Some Other Cafe" },
                location: { latitude: 40.7128, longitude: -74.006 },
              }),
              googlePlace(),
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
        rating: number;
        userRatingCount: number;
        photoUrl: string;
        websiteUri: string;
        googleMapsUri: string;
        name: string;
      };
    };
    assert.equal(res.status, 200);
    assert.equal(data.bridged, true);
    assert.equal(data.place?.placeId, "ChIJgoogle123");
    assert.equal(data.place?.provider, "google");
    assert.equal(data.place?.rating, 4.6);
    assert.equal(data.place?.userRatingCount, 321);
    assert.equal(data.place?.websiteUri, "https://joes.example/bar");
    assert.equal(data.place?.googleMapsUri, "https://maps.google.com/?cid=1");
    assert.equal(data.place?.photoUrl.includes(KEY), false);
    assert.match(data.place?.photoUrl ?? "", /maxWidthPx=400/);

    assert.equal(calls.length, 1);
    const call = calls[0]!;
    assert.equal(call.url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(call.url.includes("/places/"), false);
    assert.equal(call.url.includes(MAPBOX_ID), false);
    assert.equal(call.headers.get("X-Goog-Api-Key"), KEY);
    const body = JSON.parse(call.body ?? "{}") as {
      textQuery?: string;
      placeId?: string;
      locationBias?: { circle?: { center?: { latitude?: number; longitude?: number } } };
    };
    assert.equal(body.textQuery, "Joe's Bar");
    assert.equal(body.placeId, undefined);
    assert.equal(body.locationBias?.circle?.center?.latitude, 40.7128);
    assert.equal(body.locationBias?.circle?.center?.longitude, -74.006);
    assert.equal(JSON.stringify(body).includes(MAPBOX_ID), false);
    assert.equal(calls.some((c) => c.url.includes("places:searchNearby")), false);

    const venue: ReceiptVenue = {
      name: data.place!.name,
      placeId: data.place!.placeId,
      provider: "google",
      formattedAddress: "1 Main St, New York, NY",
      lat: 40.7128,
      lng: -74.006,
      category: "bar",
      source: "places",
      confirmedAt: "2026-10-03T00:00:00.000Z",
      rating: data.place!.rating,
      userRatingCount: data.place!.userRatingCount,
      photoUrl: data.place!.photoUrl,
      websiteUri: data.place!.websiteUri,
      googleMapsUri: data.place!.googleMapsUri,
    };
    assert.equal(venueLocationKey(venue), "place:google:ChIJgoogle123");
  });

  it("returns no place when the name does not match", async () => {
    process.env.GOOGLE_PLACES_API_KEY = KEY;
    installFetch(
      () =>
        new Response(JSON.stringify({ places: [googlePlace()] }), {
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
    // Second call hits fetch again (bridge is not cached). The mock still returns Joe's.
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
    assert.deepEqual([...bytes], [9, 8, 7]);
    assert.equal(calls.length, 2);
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
