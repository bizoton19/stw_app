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
    } else if (contentType.includes("application/json")) {
      // Native client creates drafts with `{}` — image arrives on /parse.
      await req.json().catch(() => null);
    }
    const created = await createReceipt({ imageName });
    return Response.json(created);
  } catch (err) {
    return jsonError(err);
  }
}
