import {
  formatHostPushBody,
  formatHostPushTitle,
  sendExpoPushMessages,
  type HostPushLine,
} from "./host-push";
import { getPublicReceipt, listHostPushTokens } from "./store";
import { computeTotals } from "./totals";

export async function notifyHostClaimEvent(input: {
  receiptId: string;
  kind: "claim" | "unclaim";
  personName: string;
  lines: HostPushLine[];
}): Promise<void> {
  const tokens = await listHostPushTokens(input.receiptId);
  if (tokens.length === 0) return;

  let restaurant: string | null = null;
  let receiptDate: string | null = null;
  let unclaimedCents = 0;
  let unitsLeft = 0;
  try {
    const receipt = await getPublicReceipt(input.receiptId);
    restaurant = receipt.restaurant || receipt.venue?.name || null;
    receiptDate = receipt.receiptDate ?? null;
    const totals = computeTotals(receipt);
    unclaimedCents = totals.unclaimedItemCents;
    unitsLeft = Object.values(receipt.remaining).reduce((s, n) => s + Math.max(0, n), 0);
  } catch {
    /* still send a thinner push */
  }

  const payload = {
    receiptId: input.receiptId,
    kind: input.kind,
    personName: input.personName,
    lines: input.lines,
    restaurant,
    receiptDate,
    unclaimedCents,
    unitsLeft,
  };
  console.info(
    JSON.stringify({
      event: "host.push.send",
      receiptId: input.receiptId,
      kind: input.kind,
      tokens: tokens.length,
      title: formatHostPushTitle(payload),
      body: formatHostPushBody(payload),
    }),
  );
  await sendExpoPushMessages(tokens, payload);
}
