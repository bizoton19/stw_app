import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VenueTypeahead } from "../components/venue-typeahead";

const place = {
  placeId: "ChIJgoogle123",
  name: "Joes Bar",
  formattedAddress: "1 Main St",
  lat: 40.7128,
  lng: -74.006,
  category: "bar",
  provider: "google",
  photoUrls: [],
};

test("cold nearby GET shows loading on the web restaurant list", async () => {
  const win = new Window({ url: "http://127.0.0.1/" });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    fetch: globalThis.fetch,
  };
  const g = globalThis as typeof globalThis & {
    window: Window;
    document: Document;
    HTMLElement: typeof HTMLElement;
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  g.window = win as unknown as Window & typeof globalThis.window;
  g.document = win.document as unknown as Document;
  g.HTMLElement = win.HTMLElement as unknown as typeof HTMLElement;
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const calls: string[] = [];
  let release: ((response: Response) => void) | null = null;
  const hung = new Promise<Response>((resolve) => {
    release = resolve;
  });
  g.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/api/places/nearby")) return hung;
    return new Response("{}", { status: 404 });
  }) as typeof fetch;

  let onPosition: PositionCallback | null = null;
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition(success: PositionCallback) {
        onPosition = success;
      },
    },
  });

  const host = win.document.createElement("div");
  win.document.body.appendChild(host);
  let root: Root | null = null;

  try {
    await act(async () => {
      root = createRoot(host as unknown as Element);
      root.render(
        <VenueTypeahead
          value=""
          venue={null}
          onChangeName={() => {}}
          onChangeVenue={() => {}}
        />,
      );
    });

    assert.equal(host.textContent?.includes("Loading nearby places"), false);
    assert.equal(
      calls.some((url) => url.includes("/api/places/nearby")),
      false,
    );

    await act(async () => {
      onPosition?.({
        coords: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON() {
            return {};
          },
        },
        timestamp: Date.now(),
        toJSON() {
          return {};
        },
      });
    });

    const nearbyUrl = calls.find((url) => url.includes("/api/places/nearby"));
    assert.equal(nearbyUrl, "/api/places/nearby?lat=40.7128&lng=-74.006");
    assert.match(host.textContent ?? "", /Loading nearby places/);
    assert.match(host.innerHTML, /role="status"/);
    assert.match(host.innerHTML, /aria-busy="true"/);
    assert.equal(host.textContent?.includes("Joes Bar"), false);
    assert.equal(release === null, false);

    await act(async () => {
      release?.(
        new Response(JSON.stringify({ places: [place] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      await hung;
    });

    assert.equal(host.textContent?.includes("Loading nearby places"), false);
    assert.match(host.textContent ?? "", /Joes Bar/);
    assert.doesNotMatch(host.innerHTML, /[?&]key=/);
  } finally {
    await act(async () => {
      root?.unmount();
    });
    await win.close();
    g.window = previous.window;
    g.document = previous.document;
    g.HTMLElement = previous.HTMLElement;
    g.fetch = previous.fetch;
    delete g.IS_REACT_ACT_ENVIRONMENT;
    delete (globalThis.navigator as Navigator & { geolocation?: Geolocation }).geolocation;
  }
});
