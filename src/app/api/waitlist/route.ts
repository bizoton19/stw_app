import { handleWaitlistRequest } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public marketing waitlist — upsert `split_the_wine.launch_notify`. */
export async function POST(req: Request) {
  return handleWaitlistRequest(req);
}
