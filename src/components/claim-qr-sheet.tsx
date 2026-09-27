"use client";

import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";

/** Full-screen bright claim QR for passing the phone around the table. */
export function ClaimQrSheet({
  open,
  url,
  place,
  onClose,
}: {
  open: boolean;
  url: string;
  place?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Share QR"
    >
      <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-black/15" aria-hidden />
      <div className="flex items-start gap-3 px-5 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold tracking-wide text-muted-foreground">Share QR</p>
          <p className="mt-1 text-[22px] font-extrabold tracking-tight text-foreground">
            {place?.trim() || "Tonight’s check"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pressable inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-black/5"
        >
          <X className="size-5" strokeWidth={2.25} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="rounded-[20px] border border-border bg-white p-5">
          {url ? (
            <QRCodeSVG value={url} size={240} bgColor="#FFFFFF" fgColor="#1A1510" level="M" />
          ) : null}
        </div>
      </div>

      <p className="px-6 pb-2 text-center text-[16px] font-semibold leading-snug text-foreground">
        Pass your phone — friends scan to claim what they ordered.
      </p>
      <p className="px-6 pb-8 text-center text-[13px] text-muted-foreground">
        Tap close or press Esc
      </p>
    </div>
  );
}
