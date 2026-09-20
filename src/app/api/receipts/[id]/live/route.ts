import { jsonError } from "@/lib/http";
import { getPublicReceipt, subscribe } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    getPublicReceipt(id);

    const encoder = new TextEncoder();
    let unsubscribe = () => {};

    const stream = new ReadableStream({
      start(controller) {
        const send = (data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            unsubscribe();
          }
        };
        unsubscribe = subscribe(id, send);
        const ping = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(ping);
            unsubscribe();
          }
        }, 15000);
        req.signal.addEventListener("abort", () => {
          clearInterval(ping);
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      },
      cancel() {
        unsubscribe();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
