import { jsonError } from "@/lib/http";
import { notifyHostClaimEvent } from "@/lib/notify-host";
import { addClaim, addClaims, getPublicReceipt } from "@/lib/store";

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
      void (async () => {
        try {
          const receipt = await getPublicReceipt(id);
          const lines = result.claims.map((claim) => ({
            name: receipt.items.find((item) => item.id === claim.itemId)?.name ?? "an item",
            units: claim.units,
          }));
          await notifyHostClaimEvent({
            receiptId: id,
            kind: "claim",
            personName,
            lines,
          });
        } catch {
          /* push is best-effort */
        }
      })();
      return Response.json(result);
    }

    const result = await addClaim(id, {
      itemId: String(body.itemId ?? ""),
      personName,
      personContact,
      units: Number(body.units),
    });
    void (async () => {
      try {
        const receipt = await getPublicReceipt(id);
        const name =
          receipt.items.find((item) => item.id === result.claim.itemId)?.name ?? "an item";
        await notifyHostClaimEvent({
          receiptId: id,
          kind: "claim",
          personName,
          lines: [{ name, units: result.claim.units }],
        });
      } catch {
        /* push is best-effort */
      }
    })();
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
