"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";

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
    <div className="inline-flex items-center">
      <button
        type="button"
        className="pressable flex size-11 items-center justify-center rounded-full"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-4" />
      </button>
      <motion.span
        key={value}
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="min-w-8 text-center text-[15px] font-medium tabular-nums"
        aria-labelledby={labelledBy}
      >
        {value}
      </motion.span>
      <button
        type="button"
        className="pressable flex size-11 items-center justify-center rounded-full"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
