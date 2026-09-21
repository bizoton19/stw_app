import { Alert, Linking, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
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
  if (raw.includes("@") && raw.includes(".")) return ""; // email — use copy/web
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

export async function openHostPay(opts: {
  method: PayMethod;
  handle: string;
  amountCents: number;
  note: string;
}): Promise<"opened" | "copied" | "failed"> {
  const { primary, web, copyText } = payUrls(opts);

  if (primary) {
    try {
      const can = await Linking.canOpenURL(primary);
      if (can || Platform.OS === "android") {
        await Linking.openURL(primary);
        return "opened";
      }
    } catch {
      /* fall through */
    }
    if (web) {
      try {
        await Linking.openURL(web);
        return "opened";
      } catch {
        /* fall through */
      }
    }
    if (primary.startsWith("http")) {
      try {
        await Linking.openURL(primary);
        return "opened";
      } catch {
        /* fall through */
      }
    }
  }

  await Clipboard.setStringAsync(copyText);
  Alert.alert(
    PAY_METHOD_META[opts.method].label,
    opts.method === "zelle" ||
      opts.method === "moncash" ||
      opts.method === "natcash" ||
      (opts.method === "paypal" && !paypalUsername(opts.handle))
      ? `Copied ${opts.handle} and the amount. Open ${PAY_METHOD_META[opts.method].label} and paste.`
      : `Couldn't open the app. Payment details were copied — paste them in ${PAY_METHOD_META[opts.method].label}.`,
  );
  return "copied";
}
