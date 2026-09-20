import { jsonError } from "@/lib/http";
import { addClaim, addClaims } from "@/lib/store";

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
      claims?: { itemId?: string; units?: number }[];
    };
    const personName = String(body.personName ?? "");
    const personContact = body.personContact;

    if (Array.isArray(body.claims)) {
      const result = await addClaims(id, {
        personName,
        personContact,
        claims: body.claims.map((row) => ({
          itemId: String(row.itemId ?? ""),
          units: Number(row.units),
        })),
      });
      return Response.json(result);
    }

    const result = await addClaim(id, {
      itemId: String(body.itemId ?? ""),
      personName,
      personContact,
      units: Number(body.units),
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
