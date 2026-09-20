import { hostTokenOf, jsonError } from "@/lib/http";
import { getPublicReceipt, saveReceipt } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    return Response.json(getPublicReceipt(id));
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
      items?: { id?: string; name: string; qty: number; totalCents: number }[];
      fees?: { id?: string; name: string; amountCents: number }[];
      hostInfo?: { method: "venmo" | "zelle" | "cashapp" | "other"; handle: string };
      publish?: boolean;
    };
    const receipt = await saveReceipt(id, hostTokenOf(req), body);
    return Response.json({
      receipt,
      claimUrl: `/r/${receipt.id}`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
