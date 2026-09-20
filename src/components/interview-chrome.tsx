"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function InterviewChrome({
  step,
  total,
  title,
  kicker,
  onBack,
  children,
  footer,
}: {
  step: number;
  total: number;
  title: string;
  kicker?: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const value = Math.round((step / total) * 100);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pt-2">
        <div className="mb-3 flex items-center gap-2">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-full"
              aria-label="Back"
              onClick={onBack}
            >
              <ChevronLeft className="size-6" />
            </Button>
          ) : (
            <span className="size-11" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-ink">
              Step {step} of {total}
            </p>
            <Progress value={value} className="mt-1" />
          </div>
        </div>
        {kicker ? (
          <p className="text-sm font-medium text-sky-ink">{kicker}</p>
        ) : null}
        <h1 className="font-heading text-[1.65rem] leading-tight font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      <div className="border-t border-border/70 bg-background/90 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        {footer}
      </div>
    </div>
  );
}

export function ContinueButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className="h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
    >
      {children}
    </Button>
  );
}
