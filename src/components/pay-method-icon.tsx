"use client";

import { PAY_METHOD_META } from "@/lib/pay";
import type { PayMethod } from "@/lib/types";

/** Official press-kit tiles when we have them (copied from apps/mobile/assets/pay/official). */
const OFFICIAL: Partial<Record<PayMethod, string>> = {
  venmo: "/pay/venmo.png",
  paypal: "/pay/paypal.png",
  cashapp: "/pay/cashapp.png",
  moncash: "/pay/moncash.png",
  natcash: "/pay/natcash.png",
};

/** Brand tile for settle / host pay — official logos when available. */
export function PayMethodIcon({
  method,
  size = 44,
}: {
  method: PayMethod;
  size?: number;
}) {
  const meta = PAY_METHOD_META[method];
  const radius = Math.max(10, Math.round(size * 0.28));
  const src = OFFICIAL[method];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={meta.label}
        width={size}
        height={size}
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
        draggable={false}
      />
    );
  }

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
