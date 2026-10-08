import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import {
  HOST_LOCATION_PRIME_COPY,
  HOST_LOCATION_PRIME_KEYS,
  HOST_LOCATION_PRIME_SETTLE_MS,
  classifyHostLocationPermission,
  hostLocationPrimeResolvedToday,
  hostLocationPrimeVariant,
  hostLocationPrimeWaitMs,
  hostLocationSheetEnabled,
  mayRequestHostLocationPermission,
  noteHostLocationPrimeResolved,
  parseHostLocationPrimeStatus,
  resetHostLocationPrimeSessionForTests,
  shouldAutoShowHostLocationPrime,
  shouldCloseLocationPrimeForGrant,
  shouldPresentHostLocationPrime,
  shouldRememberSystemLocationDenial,
  shouldRevealDeniedLocationVariant,
} from "../../apps/mobile/src/lib/host-location-prime-policy";
import { nearbyCardsAreVisible, placeStepFooter } from "../../apps/mobile/src/lib/place-step-footer";
import {
  HOST_LOCATION_FIX_TIMEOUT_MS,
  withPositionDeadline,
} from "../../apps/mobile/src/lib/position-fix";

const today = new Date(2026, 9, 8, 15, 0, 0);
const yesterdayIso = new Date(2026, 9, 7, 18, 0, 0).toISOString();
const todayIso = new Date(2026, 9, 8, 9, 0, 0).toISOString();
const fiveMinAgo = new Date(today.getTime() - 5 * 60 * 1000).toISOString();
const elevenMinAgo = new Date(today.getTime() - 11 * 60 * 1000).toISOString();

function present(
  overrides: Partial<{
    permission: "granted" | "denied" | "undetermined";
    dismissedAt: string | null;
    lastShownAt: string | null;
  }> = {},
) {
  return shouldPresentHostLocationPrime({
    permission: "undetermined",
    dismissedAt: null,
    lastShownAt: null,
    now: today,
    ...overrides,
  });
}

function auto(
  overrides: Partial<{
    permission: "granted" | "denied" | "undetermined";
    dismissedAt: string | null;
    lastShownAt: string | null;
    shownAt: { push: string | null; location: string | null };
    otherSheetVisible: boolean;
  }> = {},
) {
  return shouldAutoShowHostLocationPrime({
    permission: "undetermined",
    dismissedAt: null,
    lastShownAt: null,
    shownAt: { push: null, location: null },
    otherSheetVisible: false,
    now: today,
    ...overrides,
  });
}

describe("host location prime cadence", () => {
  beforeEach(() => {
    resetHostLocationPrimeSessionForTests();
  });

  it("shows once when location is still open, including after a deny", () => {
    assert.equal(present(), true);
    assert.equal(present({ permission: "denied" }), true);
  });

  it("hides when location is already granted", () => {
    assert.equal(present({ permission: "granted" }), false);
    assert.equal(auto({ permission: "granted" }), false);
  });

  it("hides for the rest of the local day after Not now or an auto-show", () => {
    assert.equal(present({ dismissedAt: todayIso }), false);
    assert.equal(present({ lastShownAt: todayIso }), false);
    assert.equal(present({ dismissedAt: yesterdayIso, lastShownAt: yesterdayIso }), true);
  });

  it("skips the auto-show for ten minutes after the notification sheet", () => {
    assert.equal(auto({ shownAt: { push: fiveMinAgo, location: null } }), false);
    assert.equal(auto({ shownAt: { push: null, location: fiveMinAgo } }), false);
    assert.equal(auto({ shownAt: { push: elevenMinAgo, location: null } }), true);
  });

  it("does not auto-show on top of the other sheet", () => {
    assert.equal(auto({ otherSheetVisible: true }), false);
  });

  it("blocks another auto-show this session after the system prompt, even before storage", () => {
    assert.equal(auto(), true);
    noteHostLocationPrimeResolved(today);
    assert.equal(hostLocationPrimeResolvedToday(today), true);
    assert.equal(auto(), false);
    assert.equal(hostLocationPrimeResolvedToday(new Date(2026, 9, 9, 8, 0, 0)), false);
  });
});

describe("host location prime permission and copy", () => {
  it("treats a dead system prompt as denied", () => {
    assert.equal(classifyHostLocationPermission({ status: "granted" }), "granted");
    assert.equal(
      classifyHostLocationPermission({ status: "denied", canAskAgain: false }),
      "denied",
    );
    assert.equal(
      classifyHostLocationPermission({ status: "undetermined", canAskAgain: false }),
      "denied",
    );
    assert.equal(
      classifyHostLocationPermission({ status: "undetermined", canAskAgain: true }),
      "undetermined",
    );
  });

  it("requests the system dialog only while undetermined", () => {
    assert.equal(mayRequestHostLocationPermission("undetermined"), true);
    assert.equal(mayRequestHostLocationPermission("denied"), false);
    assert.equal(mayRequestHostLocationPermission("granted"), false);
  });

  it("keeps the Settings variant after a recorded deny", () => {
    assert.equal(hostLocationPrimeVariant("undetermined", "denied"), "denied");
    assert.equal(hostLocationPrimeVariant("denied", null), "denied");
    assert.equal(hostLocationPrimeVariant("undetermined", null), "undetermined");
  });

  it("locks the sheet copy and storage keys", () => {
    assert.deepEqual(HOST_LOCATION_PRIME_COPY.undetermined, {
      title: "Find the place faster",
      body: "See restaurants and bars near you and pick yours in a tap. You can still search by name.",
      primary: "Turn on location",
      secondary: "Not now",
    });
    assert.deepEqual(HOST_LOCATION_PRIME_COPY.denied, {
      title: "Location is off",
      body: "To see places near you, turn on location for Split the Wine in Settings. You can still search by name.",
      primary: "Go to Settings",
      secondary: "Not now",
    });
    assert.deepEqual(HOST_LOCATION_PRIME_KEYS, {
      dismissedAt: "hostLocationPrime.dismissedAt",
      lastShownAt: "hostLocationPrime.lastShownAt",
      status: "hostLocationPrime.status",
    });
    assert.equal(HOST_LOCATION_PRIME_SETTLE_MS, 350);
    assert.deepEqual(parseHostLocationPrimeStatus("nope"), { permission: null });
    assert.deepEqual(
      parseHostLocationPrimeStatus(JSON.stringify({ permission: "denied", extra: true })),
      { permission: "denied" },
    );
  });

  it("waits out a 300–400ms place-step transition", () => {
    assert.equal(hostLocationPrimeWaitMs(0), 350);
    assert.equal(hostLocationPrimeWaitMs(100), 250);
    assert.equal(hostLocationPrimeWaitMs(400), 0);
    assert.equal(hostLocationPrimeWaitMs(-5), 350);
  });

  it("does not swap to the Settings copy while the prompt is in flight or the sheet is closing", () => {
    const open = {
      visible: true,
      permission: "denied" as const,
      variant: "undetermined" as const,
      busy: false,
      closing: false,
    };
    assert.equal(shouldRevealDeniedLocationVariant(open), true);
    assert.equal(shouldRevealDeniedLocationVariant({ ...open, busy: true }), false);
    assert.equal(shouldRevealDeniedLocationVariant({ ...open, closing: true }), false);
    assert.equal(shouldRevealDeniedLocationVariant({ ...open, visible: false }), false);
    assert.equal(
      shouldRevealDeniedLocationVariant({ ...open, variant: "denied" }),
      false,
    );
  });

  it("still closes on grant when the host comes back from Settings", () => {
    assert.equal(
      shouldCloseLocationPrimeForGrant({ visible: true, permission: "granted" }),
      true,
    );
    assert.equal(
      shouldCloseLocationPrimeForGrant({ visible: true, permission: "denied" }),
      false,
    );
    assert.equal(
      shouldCloseLocationPrimeForGrant({ visible: false, permission: "granted" }),
      false,
    );
  });

  it("remembers a system deny, and skips the sheet on web", () => {
    assert.equal(shouldRememberSystemLocationDenial("denied"), true);
    assert.equal(shouldRememberSystemLocationDenial("granted"), false);
    assert.equal(shouldRememberSystemLocationDenial("undetermined"), false);
    assert.equal(hostLocationSheetEnabled("ios"), true);
    assert.equal(hostLocationSheetEnabled("android"), true);
    assert.equal(hostLocationSheetEnabled("web"), false);
  });
});

describe("place step footer and nearby cards", () => {
  it("says swipe only when nearby cards are on screen or still loading", () => {
    assert.equal(
      placeStepFooter({ placeLocked: false, query: "", nearbyVisible: true }),
      "Swipe nearby places, or type at least two letters to search.",
    );
    assert.equal(
      placeStepFooter({ placeLocked: false, query: "A", nearbyVisible: false }),
      "Type at least two letters to search by name.",
    );
    assert.equal(
      placeStepFooter({ placeLocked: false, query: "Cafe", nearbyVisible: true }),
      "Pick a match from the list — we won’t continue until you tap one.",
    );
    assert.equal(
      placeStepFooter({ placeLocked: true, query: "", nearbyVisible: false }),
      "This place pins on the claim board for your guests.",
    );
  });

  it("treats an in-flight fetch as visible and an empty result as not", () => {
    const base = {
      permission: "granted" as const,
      positionUnavailable: false,
      hasCoords: true,
      query: "",
      pending: false,
      count: 0,
    };
    assert.equal(nearbyCardsAreVisible({ ...base, pending: true }), true);
    assert.equal(nearbyCardsAreVisible({ ...base, count: 3 }), true);
    assert.equal(nearbyCardsAreVisible(base), false);
    assert.equal(
      nearbyCardsAreVisible({ ...base, permission: "denied", hasCoords: false, pending: true }),
      false,
    );
    assert.equal(nearbyCardsAreVisible({ ...base, query: "Cafe", pending: true, count: 3 }), false);
  });

  it("keeps the nearby footer while a granted fix is still pending", () => {
    const waiting = {
      permission: "granted" as const,
      positionUnavailable: false,
      hasCoords: false,
      query: "",
      pending: false,
      count: 0,
    };
    assert.equal(nearbyCardsAreVisible(waiting), true);
    assert.equal(nearbyCardsAreVisible({ ...waiting, permission: null }), true);
    assert.equal(nearbyCardsAreVisible({ ...waiting, positionUnavailable: true }), false);
    assert.equal(nearbyCardsAreVisible({ ...waiting, permission: "undetermined" }), false);
    assert.equal(
      placeStepFooter({ placeLocked: false, query: "", nearbyVisible: true }),
      "Swipe nearby places, or type at least two letters to search.",
    );
    assert.equal(
      placeStepFooter({ placeLocked: false, query: "", nearbyVisible: false }),
      "Type at least two letters to search by name.",
    );
  });
});

describe("position fix deadline", () => {
  it("uses a ten second deadline", () => {
    assert.equal(HOST_LOCATION_FIX_TIMEOUT_MS, 10_000);
  });

  it("returns a fix that lands before the deadline", async () => {
    assert.equal(await withPositionDeadline(Promise.resolve("ok"), 50), "ok");
  });

  it("rejects a failed fix before the deadline", async () => {
    await assert.rejects(withPositionDeadline(Promise.reject(new Error("gps")), 50), /gps/);
  });

  it("rejects a stuck fix and ignores the late resolution", async () => {
    let release: (value: string) => void = () => {};
    const hung = new Promise<string>((resolve) => {
      release = resolve;
    });
    const seen: string[] = [];
    const settled = withPositionDeadline(hung, 30).then(
      (value) => {
        seen.push(value);
      },
      () => {
        seen.push("timeout");
      },
    );
    await settled;
    release("late");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(seen, ["timeout"]);
  });
});

describe("location priming wiring", () => {
  const root = process.cwd();

  function read(path: string) {
    return readFileSync(join(root, path), "utf8");
  }

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".expo" || name === "android" || name === "ios") {
        continue;
      }
      const path = join(dir, name);
      if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
      else if (/\.(ts|tsx)$/.test(name)) out.push(path);
    }
    return out;
  }

  it("requests location only from the undetermined primary", () => {
    const hits = sourceFiles(join(root, "apps/mobile"))
      .map((path) => ({ path, src: readFileSync(path, "utf8") }))
      .filter(({ src }) => src.includes("requestForegroundPermissionsAsync("));
    assert.deepEqual(
      hits.map(({ path }) => path.replace(root + "/", "")),
      ["apps/mobile/src/components/host-location-prime.tsx"],
    );
    const prime = hits[0].src;
    assert.equal(prime.match(/requestForegroundPermissionsAsync\(/g)?.length, 1);
    const quiet = prime.slice(
      prime.indexOf("const openFromQuietLine"),
      prime.indexOf("async function dismiss"),
    );
    assert.equal(quiet.includes("shouldAutoShowHostLocationPrime"), false);
    assert.equal(quiet.includes("markHostLocationPrimeShown"), false);
    assert.match(quiet, /acquireHostPrimeSheet\("location"\)/);
  });

  it("reads permission on the place field and rechecks when the app becomes active", () => {
    const venue = read("apps/mobile/src/components/venue-typeahead.tsx");
    assert.equal(venue.includes("requestForegroundPermissionsAsync"), false);
    assert.match(venue, /getForegroundPermissionsAsync\(/);
    assert.match(venue, /AppState/);
    assert.match(venue, /withPositionDeadline\(/);
    assert.match(venue, /HOST_LOCATION_FIX_TIMEOUT_MS/);
    assert.match(venue, /getCurrentPositionAsync\(/);
    assert.match(venue, /Location off · /);
    assert.match(venue, /Turn on/);
    assert.match(venue, /Location is off\. Turn on location\./);
    assert.match(venue, /Location unavailable — search by name\./);
    const webQuiet = venue.slice(
      venue.indexOf('Platform.OS === "web"'),
      venue.indexOf(") : (", venue.indexOf('Platform.OS === "web"')),
    );
    assert.match(webQuiet, /Location off — search by name\./);
    assert.equal(webQuiet.includes("Turn on"), false);
    assert.equal(venue.includes("Location off — search by name only."), false);
    assert.equal(venue.includes("Using nearby places to rank results."), false);
  });

  it("shares one queue and the cooldown with the notification sheet", () => {
    const pushStore = read("apps/mobile/src/lib/host-push-prime.ts");
    assert.match(pushStore, /return enqueueHostPrime\(task\)/);
    assert.equal(pushStore.includes("let tail"), false);
    const push = read("apps/mobile/src/components/host-push-prime.tsx");
    assert.match(push, /hostPrimeCooldownActive/);
    assert.match(push, /acquireHostPrimeSheet\("push"\)/);
    assert.match(push, /releaseHostPrimeSheet\("push"\)/);
    const location = read("apps/mobile/src/components/host-location-prime.tsx");
    assert.match(location, /acquireHostPrimeSheet\("location"\)/);
    assert.match(location, /MapPin/);
    const sheet = read("apps/mobile/src/components/host-push-prime-sheet.tsx");
    assert.match(sheet, /icon \?\? <Bell/);
    assert.match(sheet, /HOST_PUSH_PRIME_COPY\[variant\]/);
  });

  it("leaves guests and the web host interview alone", () => {
    for (const file of [
      "apps/mobile/src/app/r/[id]/index.tsx",
      "apps/mobile/src/app/r/[id]/settle.tsx",
      "src/components/host-interview.tsx",
      "src/components/venue-typeahead.tsx",
    ]) {
      const src = read(file);
      assert.equal(src.includes("HostLocationPrime"), false, file);
      assert.equal(src.includes("requestForegroundPermissionsAsync"), false, file);
    }
    assert.match(
      read("src/components/venue-typeahead.tsx"),
      /Location off — search by name only\./,
    );
    const restaurant = read("apps/mobile/src/app/host/restaurant.tsx");
    assert.match(restaurant, /placeStepFooter/);
    assert.match(restaurant, /onNearbyStateChange/);
    assert.match(restaurant, /useState\(true\)/);
    const venue = read("apps/mobile/src/components/venue-typeahead.tsx");
    assert.match(venue, /Platform\.OS === "web"/);
    const prime = read("apps/mobile/src/components/host-location-prime.tsx");
    assert.match(prime, /shouldRevealDeniedLocationVariant/);
    assert.match(prime, /shouldCloseLocationPrimeForGrant/);
    assert.match(prime, /shouldRememberSystemLocationDenial/);
    assert.match(prime, /hostLocationSheetEnabled/);
  });
});
