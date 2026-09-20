"use client";

import { ChevronLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function InterviewChrome({
  step,
  total,
  title,
  kicker,
  onBack,
  direction = 1,
  stepKey,
  children,
  footer,
}: {
  step: number;
  total: number;
  title: string;
  kicker?: string;
  onBack?: () => void;
  direction?: 1 | -1;
  stepKey: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const progress = (step / total) * 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-1">
        <div className="flex h-11 items-center gap-1">
          {onBack ? (
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="pressable -ml-2 flex size-11 items-center justify-center rounded-full"
            >
              <ChevronLeft className="size-6" />
            </button>
          ) : (
            <span className="size-11" />
          )}
          <p className="min-w-0 flex-1 text-center text-[12px] font-medium text-ink-soft">
            {step} of {total}
          </p>
          <span className="size-11" />
        </div>
        <div className="h-[2px] overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full origin-left bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: reduce ? 0 : 0.35, ease }}
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepKey}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: reduce ? 0 : d * 32, opacity: reduce ? 1 : 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: reduce ? 0 : d * -24, opacity: reduce ? 1 : 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.32, ease }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="px-5 pt-5">
              {kicker ? (
                <p className="mb-1 text-[13px] font-medium text-ink-soft">{kicker}</p>
              ) : null}
              <h1 className="text-[1.7rem] leading-[1.15] font-semibold tracking-tight">
                {title}
              </h1>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-3">{children}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {footer}
      </div>
    </div>
  );
}

export function ContinueButton({
  children,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "pressable inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "pressable inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium text-foreground disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
