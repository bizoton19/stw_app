/**
 * Tonight's tab chip. Open is the green chip with the live dot.
 * Planning and draft share the merlot tint and never show that dot.
 * A draft used to fall through to Open because the chip only checked
 * finalized and planning.
 */
export type HostedStatusTone = "open" | "draft" | "closed";

export function hostedStatusTone(status?: string | null): HostedStatusTone {
  if (status === "finalized") return "closed";
  if (status === "planning" || status === "draft") return "draft";
  return "open";
}
