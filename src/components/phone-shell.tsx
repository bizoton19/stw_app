import { WineMark } from "@/components/wine-mark";

export function PhoneShell({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="relative min-h-dvh bg-canvas">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-16 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-16 top-24 size-80 rounded-full bg-secondary/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-64 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background/95 shadow-[0_30px_80px_-20px_rgba(110,18,36,0.35)] lg:my-10 lg:min-h-[min(844px,calc(100dvh-5rem))] lg:rounded-[2rem] lg:border lg:border-white/70 lg:ring-1 lg:ring-primary/10">
        <div className="flex items-center gap-2 px-5 pb-1 pt-[max(0.9rem,env(safe-area-inset-top))]">
          <WineMark className="size-8" />
          <div>
            <p className="font-heading text-sm font-semibold tracking-tight text-primary">
              Split the Wine
            </p>
            {eyebrow ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-ink">
                {eyebrow}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
