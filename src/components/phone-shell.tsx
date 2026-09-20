import { WineMark } from "@/components/wine-mark";

export function PhoneShell({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background md:min-h-[min(844px,100dvh)] md:shadow-[0_0_0_1px_var(--border)]">
        <header className="flex h-12 shrink-0 items-center gap-2 px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <WineMark className="size-6" />
          <p className="text-[13px] font-medium tracking-tight">Split the Wine</p>
          {meta ? (
            <p className="ml-auto text-[11px] font-medium tabular-nums text-ink-soft">
              {meta}
            </p>
          ) : null}
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
