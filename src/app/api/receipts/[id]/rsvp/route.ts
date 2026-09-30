import { jsonError } from "@/lib/http";
import { rsvp } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      response?: "going" | "maybe" | "cant";
      personName?: string;
      personContact?: string | null;
      inviteToken?: string | null;
    };
    if (!body.response) {
      return Response.json({ error: "invalid", message: "response required" }, { status: 400 });
    }
    const receipt = await rsvp(id, {
      response: body.response,
      personName: body.personName,
      personContact: body.personContact,
      inviteToken: body.inviteToken,
    });
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
