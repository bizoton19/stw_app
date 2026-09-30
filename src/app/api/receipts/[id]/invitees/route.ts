import { hostTokenOf, jsonError } from "@/lib/http";
import { addInvitees } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Host: add people as Invited and get personalized invite links. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      people?: { personName: string; personContact?: string | null }[];
    };
    if (!body.people?.length) {
      return Response.json({ error: "invalid", message: "people required" }, { status: 400 });
    }
    const result = await addInvitees(id, hostTokenOf(req), body.people);
    const invites = result.created.map((row) => ({
      invitee: row,
      url: `/r/${id}?invite=${row.inviteToken}`,
    }));
    return Response.json({ receipt: result.receipt, invites });
  } catch (err) {
    return jsonError(err);
  }
}
