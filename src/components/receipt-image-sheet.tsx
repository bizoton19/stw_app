"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet for the tab photo on web live board / join.
 * Close via ✕, backdrop, or Escape. No download button — long-press / right-click the image.
 */
export function ReceiptImageButton({
  receiptId,
  hasImage,
}: {
  receiptId: string;
  hasImage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!hasImage) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 inline-flex rounded-full border border-border bg-[#FFFcf8] px-3 py-2 text-[13px] font-semibold text-primary"
      >
        View tab photo
      </button>
      <ReceiptImageSheet
        receiptId={receiptId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function ReceiptImageSheet({
  receiptId,
  open,
  onClose,
}: {
  receiptId: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const src = `/api/receipts/${receiptId}/image`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-[rgba(42,36,28,0.55)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tab photo"
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-[var(--paper,#F6F4F1)] px-4 pb-5 pt-3 shadow-xl sm:rounded-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[rgba(42,36,28,0.18)]" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-extrabold tracking-tight text-foreground">Tab photo</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-[rgba(42,36,28,0.06)]"
          >
            <X className="size-5" strokeWidth={2.25} />
          </button>
        </div>
        <div className="overflow-hidden rounded-xl bg-[#1a1612]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Tab photo"
            className="mx-auto max-h-[min(70vh,520px)] w-full object-contain select-none"
            draggable={false}
          />
        </div>
        <p className="mt-3 text-center text-[13px] font-semibold text-muted-foreground">
          Hold or right-click the photo to save · Tap outside or ✕ to close
        </p>
      </div>
    </div>
  );
}
