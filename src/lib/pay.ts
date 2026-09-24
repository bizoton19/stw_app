import type { PayMethod } from "./types";

export const PAY_METHOD_META: Record<
  PayMethod,
  { label: string; hint: string; brand: string; mark: string }
> = {
  venmo: { label: "Venmo", hint: "@handle", brand: "#008CFF", mark: "V" },
  paypal: { label: "PayPal", hint: "email, @user, or paypal.me/name", brand: "#003087", mark: "P" },
  zelle: { label: "Zelle", hint: "email or phone", brand: "#6D1ED4", mark: "Z" },
  cashapp: { label: "Cash App", hint: "$cashtag", brand: "#00D632", mark: "$" },
  moncash: { label: "MonCash", hint: "Digicel phone (+509…)", brand: "#E31C23", mark: "M" },
  natcash: { label: "Natcash", hint: "Natcom phone (+509…)", brand: "#F36C00", mark: "N" },
  other: { label: "Other", hint: "how to pay you", brand: "#2A241C", mark: "·" },
};

/** Methods that open an app / https pay link when tapped. Zelle has no public deep link. */
export function payMethodIsOpenable(method: PayMethod): boolean {
  return method === "venmo" || method === "cashapp" || method === "paypal";
}

const EMAIL_RE_SIMPLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Profile / me-link for a quick host glance (no amount). */
export function payVerifyUrl(method: PayMethod, handle: string): string | null {
  const raw = handle.trim();
  if (!raw) return null;
  if (method === "venmo") {
    const user = stripHandle(raw, "venmo");
    return user ? `https://venmo.com/${encodeURIComponent(user)}` : null;
  }
  if (method === "cashapp") {
    const tag = raw.startsWith("$") ? raw : `$${raw}`;
    return `https://cash.app/${encodeURIComponent(tag)}`;
  }
  if (method === "paypal") {
    const user = paypalUsername(raw);
    if (user) return `https://paypal.me/${encodeURIComponent(user)}`;
    if (EMAIL_RE_SIMPLE.test(raw)) return `mailto:${raw}`;
  }
  return null;
}

function stripHandle(handle: string, method: PayMethod): string {
  const raw = handle.trim();
  if (method === "venmo") return raw.replace(/^@+/, "");
  if (method === "cashapp") return raw.replace(/^\$+/, "");
  if (method === "paypal") {
    const me = raw.match(/paypal\.me\/([A-Za-z0-9_-]+)/i);
    if (me) return me[1];
    return raw.replace(/^@+/, "");
  }
  return raw;
}

function paypalUsername(handle: string): string {
  const raw = handle.trim();
  const me = raw.match(/paypal\.me\/([A-Za-z0-9_-]+)/i);
  if (me) return me[1];
  if (raw.includes("@") && raw.includes(".")) return "";
  return raw.replace(/^@+/, "");
}

function dollars(amountCents: number): string {
  return (Math.max(0, amountCents) / 100).toFixed(2);
}

/** Prefer native schemes; fall back to https where the app may still intercept. */
export function payUrls(opts: {
  method: PayMethod;
  handle: string;
  amountCents: number;
  note: string;
}): { primary: string; web?: string; copyText: string } {
  const handle = stripHandle(opts.handle, opts.method);
  const amount = dollars(opts.amountCents);
  const note = opts.note.trim() || "Split the Wine";
  const labeled = PAY_METHOD_META[opts.method].label;

  if (opts.method === "venmo" && handle) {
    const q = new URLSearchParams({
      txn: "pay",
      recipients: handle,
      amount,
      note,
    });
    return {
      primary: `venmo://paycharge?${q.toString()}`,
      web: `https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`,
      copyText: `${handle} · $${amount} on Venmo · ${note}`,
    };
  }

  if (opts.method === "cashapp" && handle) {
    const tag = handle.startsWith("$") ? handle : `$${handle}`;
    return {
      primary: `https://cash.app/${encodeURIComponent(tag)}/${amount}`,
      copyText: `${tag} · $${amount} on Cash App · ${note}`,
    };
  }

  if (opts.method === "paypal") {
    const user = paypalUsername(opts.handle);
    if (user) {
      return {
        primary: `https://paypal.me/${encodeURIComponent(user)}/${amount}`,
        copyText: `paypal.me/${user} · $${amount} · ${note}`,
      };
    }
    return {
      primary: "",
      copyText: `PayPal ${opts.handle.trim()} · $${amount} · ${note}`,
    };
  }

  if (opts.method === "zelle" && handle) {
    return {
      primary: "",
      copyText: `Zelle ${handle} · $${amount} · ${note}`,
    };
  }

  if ((opts.method === "moncash" || opts.method === "natcash") && handle) {
    const label = PAY_METHOD_META[opts.method].label;
    return {
      primary: "",
      copyText: `${label} ${handle} · ${amount} · ${note}`,
    };
  }

  return {
    primary: "",
    copyText: `Pay ${opts.handle || "the host"} $${amount} via ${labeled} · ${note}`,
  };
}

/** Browser: try app / https link; otherwise copy details. */
export async function openHostPayWeb(opts: {
  method: PayMethod;
  handle: string;
  amountCents: number;
  note: string;
}): Promise<"opened" | "copied" | "failed"> {
  const { primary, web, copyText } = payUrls(opts);

  const tryOpen = (url: string) => {
    try {
      window.location.href = url;
      return true;
    } catch {
      return false;
    }
  };

  if (primary.startsWith("http")) {
    if (tryOpen(primary)) return "opened";
  } else if (primary) {
    // Custom scheme (e.g. venmo://) — attempt, then fall back to https.
    tryOpen(primary);
    if (web && tryOpen(web)) return "opened";
    // Scheme may still have worked on a phone; treat as opened.
    return "opened";
  } else if (web) {
    if (tryOpen(web)) return "opened";
  }

  try {
    await navigator.clipboard.writeText(copyText);
    return "copied";
  } catch {
    return "failed";
  }
}
