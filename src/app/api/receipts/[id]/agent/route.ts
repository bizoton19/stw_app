import { hostTokenOf, jsonError, noStore } from "@/lib/http";
import { runAgentTurn } from "@/lib/agent/run";
import type { AgentSnapshot } from "@/lib/agent/heuristics";
import { saveReceipt } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Host co-pilot turn. Requires x-host-token.
 * Body.snapshot is the on-device draft (source of truth until publish).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const hostToken = hostTokenOf(req);
    if (!hostToken) {
      return Response.json({ error: "forbidden" }, { status: 403, ...noStore });
    }

    // Prove host owns this receipt (throws forbidden / not_found).
    await saveReceipt(id, hostToken, {});

    const body = (await req.json()) as {
      snapshot?: AgentSnapshot;
      message?: string;
      turn?: number;
    };

    const snapshot: AgentSnapshot = body.snapshot ?? {
      items: [],
      fees: [],
    };
    if (!Array.isArray(snapshot.items) || !Array.isArray(snapshot.fees)) {
      return Response.json({ error: "invalid" }, { status: 400, ...noStore });
    }

    // Cap payload size (abuse / cost).
    if (snapshot.items.length > 80 || snapshot.fees.length > 40) {
      return Response.json({ error: "invalid" }, { status: 400, ...noStore });
    }

    const result = await runAgentTurn({
      snapshot: {
        restaurant: typeof snapshot.restaurant === "string" ? snapshot.restaurant : undefined,
        items: snapshot.items.slice(0, 80).map((i) => ({
          id: String(i.id ?? ""),
          name: String(i.name ?? "").slice(0, 120),
          qty: Math.max(0, Math.floor(Number(i.qty) || 0)),
          totalCents: Math.max(0, Math.floor(Number(i.totalCents) || 0)),
          kind: i.kind === "food" || i.kind === "drink" ? i.kind : null,
          pour: i.pour ?? null,
        })),
        fees: snapshot.fees.slice(0, 40).map((f) => ({
          id: String(f.id ?? ""),
          name: String(f.name ?? "").slice(0, 80),
          amountCents: Math.max(0, Math.floor(Number(f.amountCents) || 0)),
        })),
      },
      message: typeof body.message === "string" ? body.message.slice(0, 500) : undefined,
      turn: typeof body.turn === "number" ? body.turn : 1,
    });

    return Response.json(result, noStore);
  } catch (err) {
    return jsonError(err);
  }
}
