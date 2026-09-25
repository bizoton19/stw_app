import { hostTokenOf, jsonError } from "@/lib/http";
import { registerHostPushToken } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { token?: string; platform?: string };
    const result = await registerHostPushToken(
      id,
      hostTokenOf(req),
      String(body.token ?? ""),
      body.platform,
    );
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
