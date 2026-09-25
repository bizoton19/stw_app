import { claimTokenOf, hostTokenOf, jsonError } from "@/lib/http";
import { notifyHostClaimEvent } from "@/lib/notify-host";
import { removeClaim } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ claimId: string }> },
) {
  try {
    const { claimId } = await ctx.params;
    const result = await removeClaim(claimId, claimTokenOf(req), hostTokenOf(req));
    void notifyHostClaimEvent({
      receiptId: result.receipt.id,
      kind: "unclaim",
      personName: result.removed.personName,
      lines: [{ name: result.removed.itemName, units: result.removed.units }],
    }).catch(() => {
      /* best-effort */
    });
    return Response.json({ receipt: result.receipt });
  } catch (err) {
    return jsonError(err);
  }
}
