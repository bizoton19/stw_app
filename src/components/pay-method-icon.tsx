"use client";

import { PAY_METHOD_META } from "@/lib/pay";
import type { PayMethod } from "@/lib/types";

/** Brand tile for settle / host pay — matches mobile PayMethodIcon colors. */
export function PayMethodIcon({
  method,
  size = 44,
}: {
  method: PayMethod;
  size?: number;
}) {
  const meta = PAY_METHOD_META[method];
  const radius = Math.max(10, Math.round(size * 0.28));
  return (
    <span
      aria-label={meta.label}
      className="inline-flex shrink-0 items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: meta.brand,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {meta.mark}
    </span>
  );
}
