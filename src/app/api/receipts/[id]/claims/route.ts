import { jsonError } from "@/lib/http";
import { addClaim } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      itemId?: string;
      personName?: string;
      personContact?: string;
      units?: number;
    };
    const result = await addClaim(id, {
      itemId: String(body.itemId ?? ""),
      personName: String(body.personName ?? ""),
      personContact: body.personContact,
      units: Number(body.units),
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
