import { createReceipt } from "@/lib/store";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let imageName: string | undefined;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        imageName = file.name;
      }
    }
    const created = createReceipt({ imageName });
    return Response.json(created);
  } catch (err) {
    return jsonError(err);
  }
}
