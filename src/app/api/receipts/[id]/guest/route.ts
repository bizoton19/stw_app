import { jsonError } from "@/lib/http";
import { updateGuestDisplay } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Rewrite the cosmetic label on claims for one guestId. Does not change ownership. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      guestId?: string;
      personName?: string;
      personContact?: string | null;
    };
    const receipt = await updateGuestDisplay(id, {
      guestId: body.guestId,
      personName: body.personName,
      personContact: body.personContact,
    });
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
