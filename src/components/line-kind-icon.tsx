import { GlassWater, UtensilsCrossed } from "lucide-react";
import { classifyLineKind, type LineKind } from "@/lib/line-kind";
import type { ItemKind } from "@/lib/types";

const TINT: Record<LineKind, { bg: string; fg: string }> = {
  drink: { bg: "rgba(110, 46, 53, 0.12)", fg: "#6E2E35" },
  food: { bg: "rgba(184, 121, 58, 0.16)", fg: "#9A5F28" },
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
