import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFeeLine, isTotalLine, normalizeParse, validateParse } from "./vision-stub";

describe("parse normalize", () => {
  it("drops Subtotal and Total lines from items and fees", () => {
    const parsed = normalizeParse({
      restaurant: "Harpoon Harry's",
      items: [
        { name: "Fish sandwich", qty: 1, total: 18 },
        { name: "Subtotal", qty: 1, total: 18 },
        { name: "Total", qty: 1, total: 20 },
      ],
      fees: [
        { name: "Tax", amount: 2 },
        { name: "Grand Total", amount: 20 },
      ],
    });
    assert.deepEqual(
      parsed.items.map((i) => i.name),
      ["Fish sandwich"],
    );
    assert.deepEqual(
      parsed.fees.map((f) => f.name),
      ["Tax"],
    );
  });

  it("moves tax and gratuity out of items into fees", () => {
    const parsed = normalizeParse({
      restaurant: "The Bar",
      items: [
        { name: "Negroni", qty: 1, total: 14 },
        { name: "Sales Tax", qty: 1, total: 1.12 },
        { name: "Gratuity", qty: 1, total: 2.8 },
      ],
      fees: [],
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].name, "Negroni");
    assert.equal(parsed.fees.length, 2);
  });

  it("coerces whole-number quantities from floats and strings", () => {
    const parsed = validateParse({
      restaurant: "Cafe",
      items: [{ name: "Espresso", qty: "2.0", total: "5.00" }],
      fees: [{ name: "Tax", amount: "0.40" }],
    });
    assert.equal(parsed.items[0].qty, 2);
    assert.equal(parsed.items[0].total, 5);
    assert.equal(parsed.fees[0].amount, 0.4);
  });

  it("classifies total vs fee names", () => {
    assert.equal(isTotalLine("Grand Total"), true);
    assert.equal(isTotalLine("Tax"), false);
    assert.equal(isFeeLine("Admin fee (5%)"), true);
    assert.equal(isFeeLine("BQ Wine Package"), false);
  });
});
