import { jsonError } from "@/lib/http";
import { attachGuestClaims } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Bind this device's guestId onto claims it still holds owner tokens for.
 * Used so in-flight receipts (claims saved before guestId) stop merging by name
 * once the claiming device opens the link again. Host token cannot do this.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      guestId?: string;
      tokens?: Record<string, string>;
    };
    const result = await attachGuestClaims(id, {
      guestId: String(body.guestId ?? ""),
      tokens: body.tokens ?? {},
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
