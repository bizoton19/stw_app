import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateEmail,
  validateOptionalGuestContact,
  validatePhoneNational,
} from "./contact";

describe("contact validation", () => {
  it("accepts normal emails", () => {
    const r = validateEmail("Alex@Email.com");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, "alex@email.com");
  });

  it("rejects bad emails", () => {
    assert.equal(validateEmail("nope").ok, false);
    assert.equal(validateEmail("a@b").ok, false);
  });

  it("validates US and Haiti phones", () => {
    const us = validatePhoneNational("4155552671", "US");
    assert.equal(us.ok, true);
    if (us.ok) assert.equal(us.e164, "+14155552671");

    const ht = validatePhoneNational("37123456", "HT");
    assert.equal(ht.ok, true);
    if (ht.ok) assert.equal(ht.e164, "+50937123456");
  });

  it("allows empty optional guest contact", () => {
    const r = validateOptionalGuestContact({ kind: "" });
    assert.deepEqual(r, { ok: true, contact: "" });
  });
});
