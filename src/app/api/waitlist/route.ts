import { ensureSchema, getPool, usingDatabase, DB_SCHEMA } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: string;
  platforms?: string[];
  source?: string;
};

/** Public marketing waitlist — notify when the app ships. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const email = (body.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return Response.json({ error: "invalid_email" }, { status: 400 });
    }
    const platforms = Array.isArray(body.platforms)
      ? body.platforms
          .map((p) => String(p).toLowerCase())
          .filter((p) => p === "ios" || p === "android")
          .slice(0, 2)
      : [];
    const source = (body.source || "coming-soon").trim().slice(0, 64) || "coming-soon";

    if (!usingDatabase()) {
      // Dev without Postgres — accept so the marketing page can be tested locally.
      console.log(JSON.stringify({ event: "launch_notify.dev", email, platforms, source }));
      return Response.json({ ok: true, stored: "memory" });
    }

    await ensureSchema();
    await getPool().query(
      `INSERT INTO ${DB_SCHEMA}.launch_notify (email, platforms, source, updated_at)
       VALUES ($1, $2::text[], $3, now())
       ON CONFLICT (email) DO UPDATE SET
         platforms = EXCLUDED.platforms,
         source = EXCLUDED.source,
         updated_at = now()`,
      [email, platforms, source],
    );

    return Response.json({ ok: true, stored: "db" });
  } catch (err) {
    return jsonError(err);
  }
}
