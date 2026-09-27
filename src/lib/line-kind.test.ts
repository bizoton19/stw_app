import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyVenueKind } from "./line-kind";

describe("classifyVenueKind", () => {
  it("detects bars before restaurants", () => {
    assert.equal(classifyVenueKind("wine_bar restaurant", "Joe's"), "bar");
    assert.equal(classifyVenueKind("nightlife", "The Lounge"), "bar");
  });

  it("detects grocery / supermarket", () => {
    assert.equal(classifyVenueKind("grocery,supermarket", "Trader Joe's"), "grocery");
    assert.equal(classifyVenueKind("convenience_store", "Corner Shop"), "grocery");
  });

  it("detects restaurants and cafes", () => {
    assert.equal(classifyVenueKind("restaurant,food", "Josephine"), "restaurant");
    assert.equal(classifyVenueKind("cafe", "Blue Bottle"), "restaurant");
  });

  it("returns null when unknown", () => {
    assert.equal(classifyVenueKind("museum", "Smithsonian"), null);
    assert.equal(classifyVenueKind(null, null), null);
  });
});
