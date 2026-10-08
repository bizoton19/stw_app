import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  HOST_PRIME_COOLDOWN_MS,
  hostPrimeCooldownActive,
  isWithinHostPrimeCooldown,
  mayAutoShowHostPrime,
  type HostPrimeShownAt,
} from "../../apps/mobile/src/lib/host-prime-policy";
import {
  acquireHostPrimeSheet,
  enqueueHostPrime,
  hostPrimeSheetVisible,
  otherHostPrimeSheetVisible,
  releaseHostPrimeSheet,
  resetHostPrimeQueueForTests,
  subscribeHostPrimeSheet,
} from "../../apps/mobile/src/lib/host-prime-queue";

const now = new Date("2026-10-08T18:00:00.000Z");

function ago(ms: number): string {
  return new Date(now.getTime() - ms).toISOString();
}

const none: HostPrimeShownAt = { push: null, location: null };

describe("host prime cooldown", () => {
  it("is ten minutes", () => {
    assert.equal(HOST_PRIME_COOLDOWN_MS, 10 * 60 * 1000);
  });

  it("blocks inside the window and allows the moment it ends", () => {
    assert.equal(isWithinHostPrimeCooldown(null, now), false);
    assert.equal(isWithinHostPrimeCooldown("not-a-date", now), false);
    assert.equal(isWithinHostPrimeCooldown(ago(9 * 60 * 1000), now), true);
    assert.equal(isWithinHostPrimeCooldown(ago(HOST_PRIME_COOLDOWN_MS - 1), now), true);
    assert.equal(isWithinHostPrimeCooldown(ago(HOST_PRIME_COOLDOWN_MS), now), false);
    assert.equal(isWithinHostPrimeCooldown(ago(11 * 60 * 1000), now), false);
  });

  it("treats a future timestamp as still cooling down", () => {
    const future = new Date(now.getTime() + 1000).toISOString();
    assert.equal(isWithinHostPrimeCooldown(future, now), true);
  });

  it("cools down when either sheet auto-showed", () => {
    assert.equal(
      hostPrimeCooldownActive({ push: ago(2 * 60 * 1000), location: null }, now),
      true,
    );
    assert.equal(
      hostPrimeCooldownActive({ push: null, location: ago(2 * 60 * 1000) }, now),
      true,
    );
    assert.equal(
      hostPrimeCooldownActive({ push: ago(11 * 60 * 1000), location: ago(11 * 60 * 1000) }, now),
      false,
    );
    assert.equal(hostPrimeCooldownActive(none, now), false);
  });

  it("refuses an auto-show while the other sheet is up or the window is open", () => {
    assert.equal(
      mayAutoShowHostPrime({ otherSheetVisible: true, shownAt: none, now }),
      false,
    );
    assert.equal(
      mayAutoShowHostPrime({
        otherSheetVisible: false,
        shownAt: { push: ago(5 * 60 * 1000), location: null },
        now,
      }),
      false,
    );
    assert.equal(
      mayAutoShowHostPrime({
        otherSheetVisible: false,
        shownAt: { push: ago(11 * 60 * 1000), location: null },
        now,
      }),
      true,
    );
  });
});

describe("host prime queue", () => {
  beforeEach(() => {
    resetHostPrimeQueueForTests();
  });

  it("runs tasks one at a time", async () => {
    const order: string[] = [];
    const first = enqueueHostPrime(async () => {
      order.push("start-a");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("end-a");
    });
    const second = enqueueHostPrime(async () => {
      order.push("start-b");
      order.push("end-b");
    });
    await Promise.all([first, second]);
    assert.deepEqual(order, ["start-a", "end-a", "start-b", "end-b"]);
  });

  it("keeps going after a task fails", async () => {
    const seen: string[] = [];
    const first = enqueueHostPrime(async () => {
      seen.push("a");
      throw new Error("nope");
    });
    const second = enqueueHostPrime(async () => {
      seen.push("b");
    });
    await assert.rejects(first);
    await second;
    assert.deepEqual(seen, ["a", "b"]);
  });

  it("lets only one priming sheet hold the guard", () => {
    assert.equal(hostPrimeSheetVisible(), null);
    assert.equal(acquireHostPrimeSheet("push"), true);
    assert.equal(hostPrimeSheetVisible(), "push");
    assert.equal(otherHostPrimeSheetVisible("location"), true);
    assert.equal(otherHostPrimeSheetVisible("push"), false);
    assert.equal(acquireHostPrimeSheet("location"), false);
    assert.equal(acquireHostPrimeSheet("push"), false);
    releaseHostPrimeSheet("location");
    assert.equal(hostPrimeSheetVisible(), "push");
    releaseHostPrimeSheet("push");
    assert.equal(hostPrimeSheetVisible(), null);
    assert.equal(acquireHostPrimeSheet("location"), true);
  });

  it("wakes waiters only when the visible sheet releases", () => {
    const events: string[] = [];
    const stop = subscribeHostPrimeSheet(() => events.push("released"));
    assert.equal(acquireHostPrimeSheet("location"), true);
    releaseHostPrimeSheet("push");
    assert.deepEqual(events, []);
    releaseHostPrimeSheet("location");
    assert.deepEqual(events, ["released"]);
    stop();
    releaseHostPrimeSheet("location");
    assert.deepEqual(events, ["released"]);
  });

  it("does not let a second sheet acquire while the first task still holds it", async () => {
    const acquired: string[] = [];
    const first = enqueueHostPrime(async () => {
      assert.equal(acquireHostPrimeSheet("push"), true);
      acquired.push("push");
      await new Promise((resolve) => setTimeout(resolve, 15));
      releaseHostPrimeSheet("push");
    });
    const second = enqueueHostPrime(async () => {
      acquired.push(acquireHostPrimeSheet("location") ? "location" : "blocked");
      releaseHostPrimeSheet("location");
    });
    await Promise.all([first, second]);
    assert.deepEqual(acquired, ["push", "location"]);
  });
});
