import { jsonError } from "@/lib/http";
import { getTotals } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    return Response.json(await getTotals(id));
  } catch (err) {
    return jsonError(err);
  }
}
