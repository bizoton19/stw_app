import "server-only";

/**
 * Provider-agnostic blob store for receipt photos.
 *
 * Backends are selected by env — app code only talks to `blobStore()`.
 * Today: any S3-compatible API (Railway Buckets, Cloudflare R2, AWS S3).
 * Swap provider by changing env vars; no store-pg / receipt-image changes.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type BlobObject = {
  bytes: Buffer;
  mime: string;
};

export type BlobStore = {
  readonly backend: "s3";
  put(key: string, object: BlobObject): Promise<void>;
  get(key: string): Promise<BlobObject | null>;
  delete(key: string): Promise<void>;
};

export type S3BlobConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Railway newer buckets = virtual-hosted (false). Older / some R2 setups = path-style (true). */
  forcePathStyle: boolean;
};

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Read S3-compatible credentials. Works with Railway Bucket variable refs + R2/S3. */
export function s3BlobConfig(): S3BlobConfig | null {
  const bucket = firstEnv(
    "OBJECT_STORAGE_BUCKET",
    "AWS_S3_BUCKET_NAME",
    "AWS_BUCKET",
    "BUCKET",
    "R2_BUCKET",
  );
  const endpoint = firstEnv(
    "OBJECT_STORAGE_ENDPOINT",
    "AWS_ENDPOINT_URL",
    "AWS_ENDPOINT",
    "ENDPOINT",
    "R2_ENDPOINT",
  );
  const accessKeyId = firstEnv(
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "OBJECT_STORAGE_KEY",
    "AWS_ACCESS_KEY_ID",
    "ACCESS_KEY_ID",
    "R2_ACCESS_KEY_ID",
  );
  const secretAccessKey = firstEnv(
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    "OBJECT_STORAGE_SECRET",
    "AWS_SECRET_ACCESS_KEY",
    "SECRET_ACCESS_KEY",
    "R2_SECRET_ACCESS_KEY",
  );
  const region = firstEnv("OBJECT_STORAGE_REGION", "AWS_REGION", "REGION", "R2_REGION") || "auto";
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;

  const pathStyleRaw = firstEnv("OBJECT_STORAGE_FORCE_PATH_STYLE", "AWS_S3_FORCE_PATH_STYLE");
  // Railway Buckets default to virtual-hosted URLs; only force path-style when asked.
  const forcePathStyle = pathStyleRaw === "1" || pathStyleRaw.toLowerCase() === "true";

  return { bucket, endpoint, region, accessKeyId, secretAccessKey, forcePathStyle };
}

export function usingBlobStore(): boolean {
  return Boolean(s3BlobConfig());
}

/** @deprecated use usingBlobStore */
export function usingObjectStorage(): boolean {
  return usingBlobStore();
}

export function receiptImageObjectKey(receiptId: string, mime: string): string {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return `receipts/${receiptId}/original.${ext}`;
}

function createS3BlobStore(config: S3BlobConfig): BlobStore {
  const s3 = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  return {
    backend: "s3",
    async put(key, object) {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: object.bytes,
          ContentType: object.mime || "image/jpeg",
        }),
      );
    },
    async get(key) {
      try {
        const out = await s3.send(
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }),
        );
        if (!out.Body) return null;
        return {
          bytes: Buffer.from(await out.Body.transformToByteArray()),
          mime: out.ContentType || "image/jpeg",
        };
      } catch (err) {
        const name = (err as { name?: string }).name;
        if (name === "NoSuchKey" || name === "NotFound") return null;
        throw err;
      }
    },
    async delete(key) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }),
        );
      } catch {
        /* ignore missing */
      }
    },
  };
}

let cached: { key: string; store: BlobStore } | null = null;

/** Active blob backend, or null when unset (local disk / legacy bytea fallback). */
export function blobStore(): BlobStore | null {
  const config = s3BlobConfig();
  if (!config) return null;
  const key = `${config.endpoint}|${config.bucket}|${config.accessKeyId}|${config.forcePathStyle}`;
  if (!cached || cached.key !== key) {
    cached = { key, store: createS3BlobStore(config) };
  }
  return cached.store;
}

/** Thin wrappers kept for call sites that prefer free functions. */
export async function putObjectBytes(opts: {
  key: string;
  bytes: Buffer;
  mime: string;
}): Promise<void> {
  const store = blobStore();
  if (!store) throw new Error("object_storage_not_configured");
  await store.put(opts.key, { bytes: opts.bytes, mime: opts.mime });
}

export async function getObjectBytes(
  key: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const store = blobStore();
  if (!store) throw new Error("object_storage_not_configured");
  return store.get(key);
}

export async function deleteObjectKey(key: string): Promise<void> {
  const store = blobStore();
  if (!store) return;
  await store.delete(key);
}
