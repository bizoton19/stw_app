"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";

/** Host receipt line quantity. Claim steppers pass their own max. */
export const HOST_LINE_QTY_MIN = 1;
export const HOST_LINE_QTY_MAX = 99;

export function QtyStepper({
  value,
  min = 0,
  max,
  onChange,
  labelledBy,
  variant = "plain",
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  labelledBy?: string;
  /**
   * `plain` is the claim stepper. `field` matches a dense host line input.
   */
  variant?: "plain" | "field";
}) {
  const field = variant === "field";

  function step(delta: number) {
    if (delta < 0) {
      if (value <= min) return;
      onChange(value - 1);
      return;
    }
    if (value >= max) return;
    onChange(value + 1);
  }

  const buttonClass = field
    ? "pressable flex h-8 w-7 items-center justify-center text-muted-foreground disabled:opacity-35"
    : "pressable flex size-11 items-center justify-center rounded-full disabled:opacity-35";

  return (
    <div
      className={
        field
          ? "inline-flex h-8 items-center rounded-md border border-border bg-transparent"
          : "inline-flex items-center"
      }
    >
      <button
        type="button"
        className={buttonClass}
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => step(-1)}
      >
        <Minus className={field ? "size-3.5" : "size-4"} />
      </button>
      {field ? (
        <span
          className="min-w-5 text-center text-[13px] font-semibold tabular-nums text-foreground"
          aria-labelledby={labelledBy}
        >
          {value}
        </span>
      ) : (
        <motion.span
          key={value}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="min-w-8 text-center text-[15px] font-medium tabular-nums"
          aria-labelledby={labelledBy}
        >
          {value}
        </motion.span>
      )}
      <button
        type="button"
        className={buttonClass}
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => step(1)}
      >
        <Plus className={field ? "size-3.5" : "size-4"} />
      </button>
    </div>
  );
}
