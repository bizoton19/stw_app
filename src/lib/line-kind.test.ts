import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyVenueKind as classifyWeb } from "./line-kind";
import { classifyVenueKind as classifyMobile } from "../../apps/mobile/src/lib/line-kind";

const classifiers = [
  ["web", classifyWeb],
  ["mobile", classifyMobile],
] as const;

for (const [label, classifyVenueKind] of classifiers) {
  describe(`classifyVenueKind (${label})`, () => {
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

    it("returns null when unknown or the name has no kind word", () => {
      assert.equal(classifyVenueKind("museum", "Smithsonian"), null);
      assert.equal(classifyVenueKind(null, null), null);
      assert.equal(classifyVenueKind(null, "Josephine"), null);
      assert.equal(classifyVenueKind("", "Josephine"), null);
      assert.equal(classifyVenueKind("MKPOICategoryMuseum", "The Met"), null);
    });

    it("recognizes MapKit MKPOICategory raw values", () => {
      assert.equal(classifyVenueKind("MKPOICategoryRestaurant", "Josephine"), "restaurant");
      assert.equal(classifyVenueKind("MKPOICategoryCafe", "Blue Bottle"), "restaurant");
      assert.equal(classifyVenueKind("MKPOICategoryBakery", "Tartine"), "restaurant");
      assert.equal(classifyVenueKind("MKPOICategoryWinery", "Domaine"), "bar");
      assert.equal(classifyVenueKind("MKPOICategoryBrewery", "Other Half"), "bar");
      assert.equal(classifyVenueKind("MKPOICategoryNightlife", "The Lounge"), "bar");
      assert.equal(classifyVenueKind("MKPOICategoryFoodMarket", "Essex Market"), "grocery");
    });

    it("recognizes Google primary types", () => {
      assert.equal(classifyVenueKind("italian_restaurant", "Josephine"), "restaurant");
      assert.equal(classifyVenueKind("coffee_shop", "Blue Bottle"), "restaurant");
      assert.equal(classifyVenueKind("cafe", "Cafe Regular"), "restaurant");
      assert.equal(classifyVenueKind("bar", "The Dead Rabbit"), "bar");
      assert.equal(classifyVenueKind("night_club", "House"), "bar");
      assert.equal(classifyVenueKind("wine_bar", "Aldo"), "bar");
      assert.equal(classifyVenueKind("steak_house", "Keens"), "restaurant");
      assert.equal(classifyVenueKind("grocery_store", "Trader Joe's"), "grocery");
    });

    it("keeps Mapbox bare tokens", () => {
      assert.equal(classifyVenueKind("restaurant", "Josephine"), "restaurant");
      assert.equal(classifyVenueKind("bar", "Joe's"), "bar");
      assert.equal(classifyVenueKind("pub", "The Crown"), "bar");
      assert.equal(classifyVenueKind("cafe", "Blue Bottle"), "restaurant");
      assert.equal(classifyVenueKind("bakery", "Tartine"), "restaurant");
      assert.equal(classifyVenueKind("fast_food", "Shake Shack"), "restaurant");
      assert.equal(classifyVenueKind("coffee", "La Colombe"), "restaurant");
      assert.equal(classifyVenueKind("food_and_drink", "Corner"), "restaurant");
      assert.equal(classifyVenueKind("wine_bar", "Aldo"), "bar");
    });
  });
}
