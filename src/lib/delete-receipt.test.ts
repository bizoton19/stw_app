import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addClaim,
  deleteReceipt,
  finalizeReceipt,
  getPublicReceipt,
  resetStoreForTests,
} from "./store-memory";

describe("delete closed tab", () => {
  it("rejects delete while the tab is still open", async () => {
    resetStoreForTests();
    await assert.rejects(
      () => deleteReceipt("demo", "demo-host"),
      (err: unknown) => (err as { code?: string }).code === "conflict",
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
