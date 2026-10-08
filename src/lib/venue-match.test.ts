import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { venueNamesLikelyDifferent } from "./venue-match";

describe("venue-match", () => {
  it("treats close names as the same place", () => {
    assert.equal(venueNamesLikelyDifferent("Le Diplomate", "Le Diplomate Washington"), false);
    assert.equal(venueNamesLikelyDifferent("Joe's Pizza", "Joes Pizza"), false);
  });

  it("flags clearly different places", () => {
    assert.equal(venueNamesLikelyDifferent("Le Diplomate", "Chipotle Mexican Grill"), true);
    assert.equal(venueNamesLikelyDifferent("Barmini", "The Dabney"), true);
  });

  it("stays quiet when either side is empty", () => {
    assert.equal(venueNamesLikelyDifferent("Le Diplomate", ""), false);
    assert.equal(venueNamesLikelyDifferent(null, "Chipotle"), false);
  });
});
