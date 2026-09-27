import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addClaim,
  deleteReceipt,
  finalizeReceipt,
  getPublicReceipt,
  resetStoreForTests,
} from "./store-memory";

describe("delete tab", () => {
  it("deletes an open tab for the host so the venue/day can be reused", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    assert.equal(demo.status, "open");
    await deleteReceipt("demo", "demo-host");
    assert.throws(
      () => getPublicReceipt("demo"),
      (err: unknown) => (err as { code?: string }).code === "not_found",
    );
  });

  it("deletes a finalized tab for the host", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    for (const item of demo.items) {
      await addClaim("demo", {
        itemId: item.id,
        personName: "Alex",
        units: item.qty,
      });
    }
    await finalizeReceipt("demo", "demo-host");
    assert.equal((await getPublicReceipt("demo")).status, "finalized");
    await deleteReceipt("demo", "demo-host");
    assert.throws(
      () => getPublicReceipt("demo"),
      (err: unknown) => (err as { code?: string }).code === "not_found",
    );
  });
});
