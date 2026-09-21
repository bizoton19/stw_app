import { hostTokenOf, jsonError } from "@/lib/http";
import { normalizeHostInfo } from "@/lib/host-pay";
import { setHostInfo } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const hostInfo = normalizeHostInfo(body);
    if (!hostInfo) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const receipt = await setHostInfo(id, hostTokenOf(req), hostInfo);
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
