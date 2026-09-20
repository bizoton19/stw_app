import Link from "next/link";
import { PhoneShell } from "@/components/phone-shell";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <PhoneShell eyebrow="Fair checks">
      <main className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <p className="text-sm font-medium text-sky-ink">One tab. Honest shares.</p>
        <h1 className="font-heading mt-2 text-[2.15rem] leading-[1.1] font-semibold tracking-tight">
          Split the wine without splitting hairs.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          The $420 bottle and the $4 juice should never land on the same even
          split. Photograph the receipt, send a link, let people claim what they
          actually ordered.
        </p>
        <div className="mt-6 overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-primary to-[#5c1020] p-5 text-primary-foreground shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Why it exists
          </p>
          <p className="mt-2 font-heading text-xl leading-snug">
            “Who had the wine package?” should take a tap, not a group chat.
          </p>
        </div>
        <ul className="mt-6 space-y-3 text-sm">
          {[
            "Interview-style walkthrough — one job per screen",
            "Live remaining counts as friends claim",
            "Tax and tip follow the order, not the headcount",
          ].map((line) => (
            <li key={line} className="flex gap-3 rounded-2xl bg-ice px-4 py-3 ring-1 ring-sky-ink/10">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-2 pt-8">
          <Button
            className="h-12 w-full rounded-full text-base font-semibold"
            render={<Link href="/host" />}
          >
            New receipt
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full rounded-full text-base"
            render={<Link href="/r/demo" />}
          >
            Try the sample tab
          </Button>
          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            Hosting the sample?{" "}
            <Link href="/r/demo?host=1" className="font-semibold text-primary">
              Open host tools
            </Link>
          </p>
        </div>
      </main>
    </PhoneShell>
  );
}
