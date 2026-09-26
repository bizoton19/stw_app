import { GlassWater, UtensilsCrossed } from "lucide-react";
import { classifyLineKind, type LineKind } from "@/lib/line-kind";
import type { ItemKind } from "@/lib/types";

/** Distinct from CTA merlot + bottle-green select — food vs drink must read at a glance. */
const TINT: Record<LineKind, { bg: string; fg: string }> = {
  drink: { bg: "rgba(156, 31, 61, 0.16)", fg: "#9C1F3D" },
  food: { bg: "rgba(201, 137, 42, 0.22)", fg: "#C9892A" },
};

export function LineKindIcon({
  name,
  kind,
  size = 14,
  className,
}: {
  name: string;
  /** Prefer vision/storage kind; fall back to name heuristic. */
  kind?: ItemKind | null;
  size?: number;
  className?: string;
}) {
  const resolved: LineKind | null =
    kind === "food" || kind === "drink" ? kind : classifyLineKind(name);
  if (!resolved) return null;
  const tint = TINT[resolved];
  const Icon = resolved === "drink" ? GlassWater : UtensilsCrossed;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[7px] ${className ?? ""}`}
      style={{
        width: size + 10,
        height: size + 10,
        backgroundColor: tint.bg,
      }}
      aria-label={resolved === "drink" ? "Drink" : "Food"}
    >
      <Icon size={size} color={tint.fg} strokeWidth={2.25} aria-hidden />
    </span>
  );
}
