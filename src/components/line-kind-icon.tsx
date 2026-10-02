import { Motif, type MotifName } from "@/components/motifs";
import { classifyLineKind, type LineKind } from "@/lib/line-kind";
import type { ItemKind } from "@/lib/types";

/** Distinct from CTA merlot + bottle-green select — food vs drink must read at a glance. */
const TINT: Record<LineKind, { bg: string; fg: string; motif: MotifName }> = {
  drink: { bg: "var(--stw-kind-drink-wash)", fg: "var(--stw-kind-drink)", motif: "stem" },
  food: { bg: "var(--stw-kind-food-wash)", fg: "var(--stw-kind-food)", motif: "check-stub" },
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
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[7px] ${className ?? ""}`}
      style={{
        width: size + 10,
        height: size + 10,
        backgroundColor: tint.bg,
        color: tint.fg,
      }}
      aria-label={resolved === "drink" ? "Drink" : "Food"}
    >
      <Motif name={tint.motif} size={size + 2} />
    </span>
  );
}
