import { hostTokenOf, jsonError } from "@/lib/http";
import { reopenReceipt } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const result = await reopenReceipt(id, hostTokenOf(req));
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
