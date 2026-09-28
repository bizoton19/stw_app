"use client";

import { HandCoins } from "lucide-react";

/** Quiet tip — opens marketing /support (host interview + guest pay-later). */
export function HostSupportTip() {
  return (
    <p className="pt-1 text-center text-[13px] text-muted-foreground">
      <a
        href="https://www.splitthewine.app/support"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
      >
        <HandCoins className="size-3.5" strokeWidth={2.25} aria-hidden />
        Support Split the Wine
      </a>
    </p>
  );
}
