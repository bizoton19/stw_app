import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRsvp, publicInvitees } from "./outing";
import { CALLING_COUNTRIES, composeE164, fieldsFromStoredPhone, isRsvpPhone, rsvpPhoneSaveError } from "./phone-e164";

describe("composeE164", () => {
  it("composes a US number and ignores spaces, dashes, and parentheses", () => {
    assert.equal(composeE164("US", "202-555-0100"), "+12025550100");
    assert.equal(composeE164("US", "(202) 555-0100"), "+12025550100");
    assert.equal(composeE164("CA", "202-555-0100"), "+12025550100");
    assert.equal(isRsvpPhone("+12025550100"), true);
  });

  it("requires exactly 10 national digits for +1", () => {
    assert.equal(composeE164("US", "202555010"), null);
    assert.equal(composeE164("CA", "20255501000"), null);
    assert.equal(isRsvpPhone("+1202555010"), false);
    assert.equal(isRsvpPhone("+120255501000"), false);
  });

  it("rejects letters and other symbols, and accepts another country inside 8–15 digits", () => {
    assert.equal(composeE164("US", "202-555-010a"), null);
    assert.equal(composeE164("US", "202.555.0100"), null);
    assert.equal(composeE164("UK", "2079460958"), "+442079460958");
    assert.equal(composeE164("HT", "37123456"), "+50937123456");
    assert.equal(composeE164("UK", "123"), null);
  });

  it("reopens a stored +1 number as the United States", () => {
    assert.deepEqual(fieldsFromStoredPhone("+12025550100"), {
      countryId: "US",
      nationalNumber: "2025550100",
    });
    assert.deepEqual(fieldsFromStoredPhone("+442079460958"), {
      countryId: "UK",
      nationalNumber: "2079460958",
    });
  });

  it("lists the United States first and the rest alphabetically", () => {
    assert.equal(CALLING_COUNTRIES[0]?.id, "US");
    const names = CALLING_COUNTRIES.slice(1).map((country) => country.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en")));
    assert.equal(names.includes("United States"), false);
    assert.equal(names.includes("Canada"), true);
  });

  it("tells empty and incomplete apart", () => {
    assert.equal(rsvpPhoneSaveError("US", ""), "Add a phone number so we know it’s you.");
    assert.equal(rsvpPhoneSaveError("US", "   "), "Add a phone number so we know it’s you.");
    assert.equal(
      rsvpPhoneSaveError("US", "202"),
      "That phone number doesn’t look complete.",
    );
    assert.equal(rsvpPhoneSaveError("US", "202-555-0100"), null);
  });
});

describe("applyRsvp phone key", () => {
  it("updates the same number from any name and inserts a different number", () => {
    const first = applyRsvp([], {
      response: "going",
      personName: "Alex",
      phone: "+12025550100",
      personContact: "@alex",
    });
    assert.equal(first.length, 1);
    assert.equal(first[0]?.phone, "+12025550100");

    const renamed = applyRsvp(first, {
      response: "maybe",
      personName: "Alexis",
      phone: "+12025550100",
      note: "running late",
    });
    assert.equal(renamed.length, 1);
    assert.equal(renamed[0]?.id, first[0]?.id);
    assert.equal(renamed[0]?.personName, "Alexis");
    assert.equal(renamed[0]?.response, "maybe");
    assert.equal(renamed[0]?.note, "running late");

    const other = applyRsvp(renamed, {
      response: "cant",
      personName: "Alex",
      phone: "+442079460958",
    });
    assert.equal(other.length, 2);
    assert.equal(other[1]?.personName, "Alex");
    assert.equal(other[1]?.phone, "+442079460958");
  });

  it("does not publish the phone on the public board", () => {
    const rows = applyRsvp([], {
      response: "going",
      personName: "Alex",
      phone: "+12025550100",
    });
    const pub = publicInvitees(rows);
    assert.equal(pub[0]?.phone, undefined);
    assert.equal(JSON.stringify(pub).includes("2025550100"), false);
  });

  it("rejects a missing or non-canonical phone", () => {
    assert.throws(
      () => applyRsvp([], { response: "going", personName: "Alex" }),
      (err: unknown) => (err as { code?: string }).code === "invalid",
    );
    assert.throws(
      () => applyRsvp([], { response: "going", personName: "Alex", phone: "2025550100" }),
      (err: unknown) => (err as { code?: string; message?: string }).message?.includes("complete"),
    );
  });
});
