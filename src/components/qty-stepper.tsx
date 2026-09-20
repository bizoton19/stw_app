"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QtyStepper({
  value,
  min = 0,
  max,
  onChange,
  labelledBy,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  labelledBy?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-ice px-1 py-1 ring-1 ring-sky-ink/15">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-4" />
      </Button>
      <span
        aria-labelledby={labelledBy}
        className="min-w-8 text-center text-base font-semibold tabular-nums"
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
