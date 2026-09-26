import { hostTokenOf, jsonError } from "@/lib/http";
import { normalizeHostInfo } from "@/lib/host-pay";
import { getPublicReceipt, saveReceipt } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    return Response.json(await getPublicReceipt(id));
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      restaurant?: string;
      venue?: import("@/lib/types").ReceiptVenue | null;
      receiptDate?: string | null;
      items?: {
        id?: string;
        name: string;
        qty: number;
        totalCents: number;
        kind?: import("@/lib/types").ItemKind | null;
        pour?: import("@/lib/types").ItemPour | null;
      }[];
      fees?: { id?: string; name: string; amountCents: number }[];
      hostInfo?: unknown;
      publish?: boolean;
    };
    const hostInfo = body.hostInfo !== undefined ? normalizeHostInfo(body.hostInfo) : undefined;
    if (body.hostInfo !== undefined && !hostInfo) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const receipt = await saveReceipt(id, hostTokenOf(req), {
      restaurant: body.restaurant,
      venue: body.venue,
      receiptDate: body.receiptDate,
      items: body.items,
      fees: body.fees,
      hostInfo: hostInfo ?? undefined,
      publish: body.publish,
    });
    return Response.json({
      receipt,
      claimUrl: `/r/${receipt.id}`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
