import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isClearlyOffTopic, isLikelyOnTopic } from "./scope";

describe("agent scope", () => {
  it("allows tip / tax / item questions", () => {
    assert.equal(isClearlyOffTopic("tip was cash 20%"), false);
    assert.equal(isClearlyOffTopic("what’s the tax on this check?"), false);
    assert.equal(isClearlyOffTopic("how much is the Cabernet line?"), false);
    assert.equal(isClearlyOffTopic("what is this admin fee for?"), false);
    assert.equal(isLikelyOnTopic("split the bottle into glasses"), true);
  });

  it("blocks obvious off-topic chat", () => {
    assert.equal(isClearlyOffTopic("tell me a joke"), true);
    assert.equal(isClearlyOffTopic("what’s the weather in NYC"), true);
    assert.equal(isClearlyOffTopic("write me a python script"), true);
  });

  it("treats empty open as in scope", () => {
    assert.equal(isClearlyOffTopic(""), false);
    assert.equal(isClearlyOffTopic(undefined), false);
  });
});
