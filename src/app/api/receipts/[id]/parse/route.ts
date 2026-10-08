import { hostTokenOf, jsonError } from "@/lib/http";
import { parseReceipt } from "@/lib/store";
import type { ReceiptImage } from "@/lib/parse-receipt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

async function imageFromForm(form: FormData): Promise<ReceiptImage | undefined> {
  const file = form.get("image");
  if (!(file instanceof File) || file.size <= 0) return undefined;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error("image_too_large"), { code: "invalid" });
  }
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
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > MAX_UPLOAD_BYTES + 256_000) {
      return Response.json({ error: "invalid" }, { status: 413 });
    }
    const { id } = await ctx.params;
    const hostToken = hostTokenOf(req);
    const contentType = req.headers.get("content-type") ?? "";
    let image: ReceiptImage | undefined;
    let forceStub = false;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      forceStub =
        String(form.get("sample") ?? "") === "1" || String(form.get("sample") ?? "") === "true";
      image = await imageFromForm(form);
    } else if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as {
        sample?: boolean | string;
      };
      forceStub = body.sample === true || body.sample === "1" || body.sample === "true";
    }
    console.log(
      JSON.stringify({
        event: "parse.request",
        ts: new Date().toISOString(),
        receiptId: id,
        hasImage: Boolean(image?.bytes?.length),
        imageBytes: image?.bytes?.length ?? 0,
        contentType: contentType.slice(0, 80),
        forceStub,
      }),
    );
    const result = await parseReceipt(id, hostToken, image, { forceStub });
    return Response.json(result);
  } catch (err) {
    console.log(
      JSON.stringify({
        event: "parse.request_failed",
        ts: new Date().toISOString(),
        detail: err instanceof Error ? err.message.slice(0, 240) : String(err),
      }),
    );
    return jsonError(err);
  }
}
