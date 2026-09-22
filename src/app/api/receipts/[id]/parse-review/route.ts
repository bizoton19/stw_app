import { hostTokenOf, jsonError } from "@/lib/http";
import { setParseReview } from "@/lib/store";
import type { ParseReviewChoice } from "@/lib/types";

export const dynamic = "force-dynamic";

const CHOICES: ParseReviewChoice[] = ["looks_good", "remove_items", "needs_edits"];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { choice?: string };
    const choice = body.choice as ParseReviewChoice | undefined;
    if (!choice || !CHOICES.includes(choice)) {
      return Response.json({ error: "invalid_choice" }, { status: 400 });
    }
    const receipt = await setParseReview(id, hostTokenOf(req), choice);
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
