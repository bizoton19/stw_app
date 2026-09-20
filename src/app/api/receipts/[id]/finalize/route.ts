import { hostTokenOf, jsonError } from "@/lib/http";
import { finalizeReceipt } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const result = await finalizeReceipt(id, hostTokenOf(req));
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
