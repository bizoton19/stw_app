/**
 * Hosted-tab tone for Tonight's card and the recent list.
 * Open is select green (the card also shows the live dot).
 * Planning and draft share merlot and never show that dot.
 * Closed is the darker ink. A draft used to fall through to Open.
 */
export type HostedStatusTone = "open" | "draft" | "closed";

export function hostedStatusTone(status?: string | null): HostedStatusTone {
  if (status === "finalized") return "closed";
  if (status === "planning" || status === "draft") return "draft";
  return "open";
}
