"use client";

import { CardWash, Motif } from "@/components/motifs";

export function PhoneShell({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className="h-dvh overflow-hidden bg-background">
      <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-background md:shadow-[0_0_0_1px_var(--border)]">
        <div className="stw-grain" aria-hidden />
        <CardWash />
        <header className="relative flex h-12 shrink-0 items-center gap-2 px-4 pt-[max(0.35rem,env(safe-area-inset-top))] text-primary">
          <Motif name="split-bottle" size={22} />
          <p className="text-[13px] font-medium tracking-tight text-foreground">
            Split the Wine
          </p>
          {meta ? (
            <p
              className={`ml-auto text-[11px] font-medium tabular-nums ${
                meta === "Live" ? "text-primary" : "text-ink-soft"
              }`}
            >
              {meta}
            </p>
          ) : null}
        </header>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
