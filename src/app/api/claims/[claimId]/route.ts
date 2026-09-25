import { claimTokenOf, hostTokenOf, jsonError } from "@/lib/http";
import { removeClaim } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ claimId: string }> },
) {
  try {
    const { claimId } = await ctx.params;
    const receipt = await removeClaim(claimId, claimTokenOf(req), hostTokenOf(req));
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
