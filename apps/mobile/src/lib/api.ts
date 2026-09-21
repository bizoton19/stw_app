import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getApiUrl } from "./config";
import type { PickedImage, PublicReceipt } from "./types";

export type ApiError = Error & {
  code?: string;
  remaining?: number;
  itemId?: string;
  status?: number;
};

type ParseResponse = {
  receipt: PublicReceipt;
  parse?: { source: string; reason: string };
};

export async function api<T>(
  path: string,
  init?: RequestInit & { hostToken?: string | null; claimToken?: string | null },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.hostToken) headers.set("x-host-token", init.hostToken);
  if (init?.claimToken) headers.set("x-claim-token", init.claimToken);
  const body = init?.body;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const url = path.startsWith("http") ? path : `${getApiUrl()}${path}`;
  const res = await fetch(url, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    remaining?: number;
    itemId?: string;
  };
  if (!res.ok) {
    const err = new Error(data.error ?? "request_failed") as ApiError;
    err.code = data.error;
    err.remaining = data.remaining;
    err.itemId = data.itemId;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function pingApi(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/receipts/demo`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function createDraftReceipt(): Promise<{ receiptId: string; hostToken: string }> {
  return api("/api/receipts", { method: "POST", body: "{}" });
}

/** Native FormData file uploads often fail on device; use FileSystem.uploadAsync instead. */
export async function parseReceiptWithImage(
  receiptId: string,
  opts: {
    image?: PickedImage | null;
    sample?: boolean;
    hostToken?: string | null;
  },
): Promise<ParseResponse> {
  const path = `/api/receipts/${receiptId}/parse`;

  if (opts.sample || !opts.image) {
    return api<ParseResponse>(path, {
      method: "POST",
      hostToken: opts.hostToken,
      body: JSON.stringify({ sample: opts.sample ? true : undefined }),
    });
  }

  if (Platform.OS === "web") {
    const form = new FormData();
    await appendReceiptImage(form, opts.image);
    return api<ParseResponse>(path, {
      method: "POST",
      body: form,
      hostToken: opts.hostToken,
    });
  }

  const headers: Record<string, string> = {};
  if (opts.hostToken) headers["x-host-token"] = opts.hostToken;

  const result = await FileSystem.uploadAsync(`${getApiUrl()}${path}`, opts.image.uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "image",
    mimeType: opts.image.mimeType ?? "image/jpeg",
    headers,
  });

  let data: ParseResponse & { error?: string } = { receipt: undefined as unknown as PublicReceipt };
  try {
    data = JSON.parse(result.body) as ParseResponse & { error?: string };
  } catch {
    /* ignore */
  }
  if (result.status < 200 || result.status >= 300) {
    const err = new Error(data.error ?? "request_failed") as ApiError;
    err.code = data.error;
    err.status = result.status;
    throw err;
  }
  return data;
}

export async function appendReceiptImage(form: FormData, image: PickedImage) {
  if (Platform.OS === "web") {
    const res = await fetch(image.uri);
    const blob = await res.blob();
    const file = new File([blob], image.fileName ?? "receipt.jpg", {
      type: image.mimeType || blob.type || "image/jpeg",
    });
    form.append("image", file);
    return;
  }
  form.append("image", {
    uri: image.uri,
    name: image.fileName ?? "receipt.jpg",
    type: image.mimeType ?? "image/jpeg",
  } as unknown as Blob);
}
