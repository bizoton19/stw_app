import { formatHostPushBody, sendExpoPushMessages, type HostPushLine } from "./host-push";
import { getPublicReceipt, listHostPushTokens } from "./store";

export async function notifyHostClaimEvent(input: {
  receiptId: string;
  kind: "claim" | "unclaim";
  personName: string;
  lines: HostPushLine[];
}): Promise<void> {
  const tokens = await listHostPushTokens(input.receiptId);
  if (tokens.length === 0) return;
  let restaurant: string | null | undefined;
  try {
    const receipt = await getPublicReceipt(input.receiptId);
    restaurant = receipt.restaurant;
  } catch {
    restaurant = null;
  }
  const payload = {
    receiptId: input.receiptId,
    kind: input.kind,
    personName: input.personName,
    lines: input.lines,
    restaurant,
  };
  console.info(
    JSON.stringify({
      event: "host.push.send",
      receiptId: input.receiptId,
      kind: input.kind,
      tokens: tokens.length,
      body: formatHostPushBody(payload),
    }),
  );
  await sendExpoPushMessages(tokens, payload);
}
