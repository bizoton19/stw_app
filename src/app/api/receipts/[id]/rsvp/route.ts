import { jsonError } from "@/lib/http";
import { notifyHostRsvpEvent } from "@/lib/notify-host";
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
      note?: string | null;
    };
    if (!body.response) {
      return Response.json({ error: "invalid", message: "response required" }, { status: 400 });
    }
    const receipt = await rsvp(id, {
      response: body.response,
      personName: body.personName,
      personContact: body.personContact,
      inviteToken: body.inviteToken,
      note: body.note,
    });
    const personName =
      body.personName?.trim() ||
      [...(receipt.invitees ?? [])]
        .filter((row) => row.response === body.response)
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0]
        ?.personName ||
      "Someone";
    void notifyHostRsvpEvent({
      receiptId: id,
      personName,
      response: body.response,
    }).catch(() => {
      /* best-effort */
    });
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
