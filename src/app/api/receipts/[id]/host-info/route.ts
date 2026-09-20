import { hostTokenOf, jsonError } from "@/lib/http";
import { setHostInfo } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      method?: "venmo" | "zelle" | "cashapp" | "other";
      handle?: string;
    };
    if (!body.method || !body.handle?.trim()) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const receipt = await setHostInfo(id, hostTokenOf(req), {
      method: body.method,
      handle: body.handle.trim(),
    });
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
