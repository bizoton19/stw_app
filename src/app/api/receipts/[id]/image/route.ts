import { getPublicReceipt } from "@/lib/store";
import { getReceiptImage } from "@/lib/receipt-image";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const receipt = await getPublicReceipt(id);
    if (!receipt) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const image = await getReceiptImage(id);
    if (!image) {
      return Response.json({ error: "no_image" }, { status: 404 });
    }
    return new Response(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": image.mime || "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
