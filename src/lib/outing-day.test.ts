import assert from "node:assert/strict";
import test from "node:test";
import {
  isOutingDayReached,
  normalizePlanInput,
  promotePlanningToDraftIfDue,
} from "./outing";

test("isOutingDayReached uses receiptDate calendar day", () => {
  assert.equal(
    isOutingDayReached(
      {
        receiptDate: "2026-09-30",
        nightAt: "2026-09-30T23:30:00.000Z",
        createdAt: "2026-09-20T00:00:00.000Z",
      },
      new Date("2026-09-30T12:00:00"),
    ),
    true,
  );
  assert.equal(
    isOutingDayReached(
      {
        receiptDate: "2026-10-01",
        nightAt: "2026-10-01T23:30:00.000Z",
        createdAt: "2026-09-20T00:00:00.000Z",
      },
      new Date("2026-09-30T12:00:00"),
    ),
    false,
  );
});

test("promotePlanningToDraftIfDue flips planning on outing day", () => {
  const receipt = {
    status: "planning" as const,
    receiptDate: "2026-09-30",
    nightAt: "2026-09-30T23:00:00.000Z",
    createdAt: "2026-09-20T00:00:00.000Z",
  };
  assert.equal(promotePlanningToDraftIfDue(receipt, new Date("2026-09-30T08:00:00")), true);
  assert.equal(receipt.status, "draft");
  assert.equal(promotePlanningToDraftIfDue(receipt, new Date("2026-09-30T08:00:00")), false);
});

test("plan hostName is stored apart from the host note", () => {
  const normalized = normalizePlanInput({
    venue: {
      name: "Test Bistro",
      placeId: "place-1",
      source: "places",
      confirmedAt: "2026-10-04T15:00:00.000Z",
      lat: 40.7,
      lng: -74,
    },
    nightAt: "2026-10-20T23:00:00.000Z",
    note: "Bring cash",
    hostName: "  Robert Baratheon  ",
  });
  assert.equal(normalized.hostName, "Robert Baratheon");
  assert.equal(normalized.hostInfo?.note, "Bring cash");
  assert.equal(JSON.stringify(normalized.hostInfo).includes("Robert"), false);
});
