"use client";

import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";

/** Expandable host note for claimers. Renders nothing when empty. */
export function HostMessage({ note }: { note: string | null | undefined }) {
  const text = note?.trim();
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-[rgba(110,46,53,0.22)] bg-[rgba(110,46,53,0.05)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pressable flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
      >
        <Bell className="size-4 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
        <span className="min-w-0 flex-1 text-[14px] font-semibold text-foreground">
          Host message
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-ink-soft transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <p className="border-t border-[rgba(110,46,53,0.14)] px-3.5 py-3 text-[14px] leading-[1.45] text-foreground">
          {text}
        </p>
      ) : null}
    </div>
  );
}
