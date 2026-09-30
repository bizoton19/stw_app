import { jsonError } from "@/lib/http";
import { createPlanReceipt } from "@/lib/store";
import type { HostInfo, ReceiptVenue } from "@/lib/types";
import { normalizeHostInfo } from "@/lib/host-pay";

export const dynamic = "force-dynamic";

/** Create a planning outing (venue + when) — shareable before any receipt photo. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      venue?: ReceiptVenue | null;
      nightAt?: string;
      expectedPartySize?: number | null;
      hostInfo?: unknown;
      note?: string | null;
    };
    if (!body.venue || !body.nightAt) {
      return Response.json({ error: "invalid", message: "venue and nightAt required" }, { status: 400 });
    }
    const hostInfo = body.hostInfo !== undefined ? normalizeHostInfo(body.hostInfo) : undefined;
    if (body.hostInfo !== undefined && body.hostInfo !== null && !hostInfo) {
      return Response.json({ error: "invalid", message: "invalid hostInfo" }, { status: 400 });
    }
    const created = await createPlanReceipt({
      venue: body.venue,
      nightAt: body.nightAt,
      expectedPartySize: body.expectedPartySize,
      hostInfo: (hostInfo as HostInfo | undefined) ?? null,
      note: body.note,
    });
    return Response.json({
      receiptId: created.receiptId,
      hostToken: created.hostToken,
      receipt: created.receipt,
      claimUrl: `/r/${created.receiptId}`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
