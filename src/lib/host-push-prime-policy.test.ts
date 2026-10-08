import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  HOST_PUSH_PRIME_COPY,
  HOST_PUSH_PRIME_KEYS,
  classifyHostPushPermission,
  emptyHostPushPrimeStatus,
  hostPushPrimeVariant,
  mayRequestHostPushPermission,
  parseHostPushPrimeStatus,
  shouldPresentHostPushPrime,
  type HostPushPrimeStatus,
} from "../../apps/mobile/src/lib/host-push-prime-policy";

const today = new Date(2026, 9, 7, 15, 0, 0);
const yesterdayIso = new Date(2026, 9, 6, 18, 0, 0).toISOString();
const todayIso = new Date(2026, 9, 7, 9, 0, 0).toISOString();

function decide(
  overrides: Partial<{
    permission: "granted" | "denied" | "undetermined";
    dismissedAt: string | null;
    lastShownAt: string | null;
    status: HostPushPrimeStatus;
    trigger: "create-outing" | "share-claim" | "live-board";
  }> = {},
) {
  return shouldPresentHostPushPrime({
    permission: "undetermined",
    dismissedAt: null,
    lastShownAt: null,
    status: emptyHostPushPrimeStatus(),
    trigger: "create-outing",
    now: today,
    ...overrides,
  });
}

describe("host push prime cadence", () => {
  it("shows once when permission is still open", () => {
    assert.equal(decide(), true);
    assert.equal(decide({ permission: "denied", trigger: "live-board" }), true);
  });

  it("hides when alerts are already granted", () => {
    assert.equal(decide({ permission: "granted" }), false);
  });

  it("hides for the rest of the local day after Not now or a show", () => {
    assert.equal(decide({ dismissedAt: todayIso }), false);
    assert.equal(decide({ lastShownAt: todayIso, trigger: "share-claim" }), false);
    assert.equal(decide({ dismissedAt: yesterdayIso, lastShownAt: yesterdayIso }), true);
  });

  it("does not repeat the same trigger family on the day it was shown", () => {
    const status: HostPushPrimeStatus = {
      permission: "undetermined",
      tokenRegistered: false,
      shownOn: "2026-10-07",
      shownFamilies: ["create-outing"],
    };
    assert.equal(decide({ status, trigger: "create-outing" }), false);
  });

  it("lets a later day ask again until they allow", () => {
    const status: HostPushPrimeStatus = {
      permission: "denied",
      tokenRegistered: false,
      shownOn: "2026-10-06",
      shownFamilies: ["create-outing"],
    };
    assert.equal(
      decide({ permission: "denied", lastShownAt: yesterdayIso, status, trigger: "live-board" }),
      true,
    );
  });
});

describe("host push prime permission", () => {
  it("treats a dead system prompt as denied", () => {
    assert.equal(classifyHostPushPermission({ status: "granted", canAskAgain: false }), "granted");
    assert.equal(classifyHostPushPermission({ status: "denied", canAskAgain: false }), "denied");
    assert.equal(
      classifyHostPushPermission({ status: "undetermined", canAskAgain: false }),
      "denied",
    );
    assert.equal(
      classifyHostPushPermission({ status: "undetermined", canAskAgain: true }),
      "undetermined",
    );
  });

  it("requests the system dialog only while undetermined", () => {
    assert.equal(mayRequestHostPushPermission("undetermined"), true);
    assert.equal(mayRequestHostPushPermission("denied"), false);
    assert.equal(mayRequestHostPushPermission("granted"), false);
  });

  it("keeps the Settings variant after a recorded deny", () => {
    assert.equal(hostPushPrimeVariant("undetermined", "denied"), "denied");
    assert.equal(hostPushPrimeVariant("denied", null), "denied");
    assert.equal(hostPushPrimeVariant("undetermined", null), "undetermined");
  });
});

describe("host push prime copy and storage", () => {
  it("locks the sheet copy", () => {
    assert.deepEqual(HOST_PUSH_PRIME_COPY.undetermined, {
      title: "Stay in the loop",
      body: "Get a ping when someone RSVPs or claims a dish. You can change this later in Settings.",
      primary: "Turn on alerts",
      secondary: "Not now",
    });
    assert.deepEqual(HOST_PUSH_PRIME_COPY.denied, {
      title: "Alerts are off",
      body: "To hear about RSVPs and claims, turn on notifications for Split the Wine in Settings.",
      primary: "Go to Settings",
      secondary: "Not now",
    });
  });

  it("persists the spec keys and ignores a bad snapshot", () => {
    assert.deepEqual(HOST_PUSH_PRIME_KEYS, {
      dismissedAt: "hostPushPrime.dismissedAt",
      lastShownAt: "hostPushPrime.lastShownAt",
      status: "hostPushPrime.status",
    });
    assert.deepEqual(parseHostPushPrimeStatus("nope"), emptyHostPushPrimeStatus());
    assert.equal(
      parseHostPushPrimeStatus(
        JSON.stringify({
          permission: "denied",
          tokenRegistered: true,
          shownOn: "2026-10-07",
          shownFamilies: ["live-board", "nope"],
        }),
      ).shownFamilies.join(),
      "live-board",
    );
  });

  it("does not cold-prompt from the host screens", () => {
    const root = process.cwd();
    const hostPush = readFileSync(join(root, "apps/mobile/src/lib/host-push.ts"), "utf8");
    assert.equal(hostPush.match(/await Notifications\.requestPermissionsAsync\(/g)?.length, 1);
    assert.match(hostPush, /\/host-push/);

    for (const file of [
      "apps/mobile/src/app/host/share.tsx",
      "apps/mobile/src/app/host/plan/[id].tsx",
      "apps/mobile/src/app/r/[id]/settle.tsx",
    ]) {
      const src = readFileSync(join(root, file), "utf8");
      assert.equal(src.includes("requestPermissionsAsync"), false, file);
      assert.equal(src.includes("registerHostClaimPush"), false, file);
      assert.match(src, /HostPushPrime/);
    }

    const guestClaim = readFileSync(join(root, "apps/mobile/src/app/r/[id]/index.tsx"), "utf8");
    assert.equal(guestClaim.includes("HostPushPrime"), false);
    const webInterview = readFileSync(join(root, "src/components/host-interview.tsx"), "utf8");
    assert.equal(webInterview.includes("HostPushPrime"), false);
  });
});
