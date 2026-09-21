import Link from "next/link";
import { PhoneShell } from "@/components/phone-shell";

export default function Home() {
  return (
    <PhoneShell>
      <main className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
        <p className="text-[13px] font-medium text-ink-soft">Fair split</p>
        <h1 className="mt-2 text-[1.85rem] leading-[1.12] font-semibold tracking-tight">
          Ready to split this check?
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Photograph the tab. Friends claim what they actually ordered. Tax and
          tip follow the drinks — not the headcount.
        </p>
        <div className="mt-auto space-y-1 pt-10">
          <Link
            href="/host"
            className="pressable inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
          >
            Start with the receipt
          </Link>
        </div>
      </main>
    </PhoneShell>
  );
}
