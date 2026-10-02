import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGuestId,
  findMine,
  isGuestId,
  personRowKey,
  readGuestId,
  resolveGuestId,
  sameGuest,
} from "./guest-id";
import { getGuest, saveGuest } from "./session";

const ALEX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALEX_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("guestId", () => {
  it("mints a uuid and reuses an existing one when the caller omits it", () => {
    const minted = createGuestId();
    assert.equal(isGuestId(minted), true);
    assert.equal(resolveGuestId(undefined, ALEX_A), ALEX_A);
    assert.equal(resolveGuestId(ALEX_B, ALEX_A), ALEX_B);
    const first = resolveGuestId(undefined, undefined);
    const second = resolveGuestId(undefined, undefined);
    assert.equal(isGuestId(first), true);
    assert.notEqual(first, second);
  });

  it("rejects a non-uuid and treats blank as legacy", () => {
    assert.equal(readGuestId(undefined), undefined);
    assert.equal(readGuestId(""), undefined);
    assert.equal(readGuestId(`  ${ALEX_A.toUpperCase()}  `), ALEX_A);
    assert.throws(() => readGuestId("Alex"), (err: unknown) => (err as { code?: string }).code === "invalid");
  });

  it("matches people by guestId, not display name", () => {
    const people = [
      { guestId: ALEX_A, personName: "Alex" },
      { guestId: ALEX_B, personName: "Alex" },
      { personName: "Alex" },
    ];
    assert.equal(sameGuest(people[0], { guestId: ALEX_A }), true);
    assert.equal(sameGuest(people[0], { guestId: ALEX_B }), false);
    assert.equal(sameGuest(people[2], { guestId: ALEX_A }), false);
    assert.equal(findMine(people, { guestId: ALEX_B })?.guestId, ALEX_B);
    assert.equal(findMine(people, { guestId: undefined }), undefined);
    assert.notEqual(personRowKey(people[0]!), personRowKey(people[1]!));
    assert.equal(personRowKey(people[2]!), "name:alex");
  });

  it("reuses the same guestId for a receipt after refresh and across a renamed join", () => {
    const store = new Map<string, string>();
    const memory = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(globalThis, "sessionStorage", { value: memory, configurable: true });

    store.set("stw-guest:tab-1", JSON.stringify({ name: "Alex", contact: "" }));
    const upgraded = getGuest("tab-1");
    assert.ok(upgraded);
    assert.equal(isGuestId(upgraded.guestId), true);
    assert.equal(getGuest("tab-1")?.guestId, upgraded.guestId);

    const renamed = saveGuest("tab-1", { name: "Alex R.", contact: "venmo" });
    assert.equal(renamed.guestId, upgraded.guestId);
    assert.equal(renamed.name, "Alex R.");
    assert.equal(getGuest("tab-1")?.guestId, upgraded.guestId);

    const other = saveGuest("tab-2", { name: "Alex", contact: "" });
    assert.notEqual(other.guestId, upgraded.guestId);
    assert.equal(saveGuest("tab-2", { name: "Alex", contact: "sms" }).guestId, other.guestId);
  });
});
