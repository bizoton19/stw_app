import { jsonError } from "@/lib/http";
import { parseReceipt } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const contentType = req.headers.get("content-type") ?? "";
    let image: { name: string; type: string; size: number } | undefined;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        image = { name: file.name, type: file.type, size: file.size };
      }
    }
    const receipt = await parseReceipt(id, image);
    return Response.json({ receipt });
  } catch (err) {
    return jsonError(err);
  }
}
