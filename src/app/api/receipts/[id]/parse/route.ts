import { jsonError } from "@/lib/http";
import { parseReceipt } from "@/lib/store";
import type { ReceiptImage } from "@/lib/parse-receipt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function imageFromForm(form: FormData): Promise<ReceiptImage | undefined> {
  const file = form.get("image");
  if (!(file instanceof File) || file.size <= 0) return undefined;
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    name: file.name || "receipt.jpg",
    type: file.type || "image/jpeg",
    size: file.size,
    bytes,
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const contentType = req.headers.get("content-type") ?? "";
    let image: ReceiptImage | undefined;
    let forceStub = false;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      forceStub = String(form.get("sample") ?? "") === "1";
      image = await imageFromForm(form);
    }
    const result = await parseReceipt(id, image, { forceStub });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
