import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { usingDatabase, ensureSchema, getPool, DB_SCHEMA } from "./db";
import {
  blobStore,
  deleteObjectKey,
  receiptImageObjectKey,
  usingBlobStore,
} from "./object-storage";
import type { ReceiptImage } from "./parse-receipt";

/**
 * Receipt photo persistence:
 * - Bytes → blob store when configured (Railway Bucket / R2 / S3 via env)
 * - Metadata → Postgres `receipt_images` (mime, size, storage_key)
 * - Local / no-DB → memory + `.data/receipt-images`
 * - Legacy rows with `bytes` bytea still readable until migrated
 */

const memoryImages = new Map<string, { mime: string; bytes: Buffer }>();

type ImageRow = {
  mime: string;
  byte_size: number | null;
  storage_key: string | null;
  bytes: Buffer | null;
};

function diskDir() {
  return path.join(process.cwd(), ".data", "receipt-images");
}

async function ensureImageTable() {
  await ensureSchema();
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.receipt_images (
      receipt_id text PRIMARY KEY REFERENCES ${DB_SCHEMA}.receipts(id) ON DELETE CASCADE,
      mime text NOT NULL,
      bytes bytea,
      byte_size integer,
      storage_key text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // Additive for older installs that created NOT NULL bytes without storage_key.
  await getPool().query(`
    ALTER TABLE ${DB_SCHEMA}.receipt_images
      ALTER COLUMN bytes DROP NOT NULL;
  `).catch(() => undefined);
  await getPool().query(`
    ALTER TABLE ${DB_SCHEMA}.receipt_images
      ADD COLUMN IF NOT EXISTS byte_size integer;
  `);
  await getPool().query(`
    ALTER TABLE ${DB_SCHEMA}.receipt_images
      ADD COLUMN IF NOT EXISTS storage_key text;
  `);
}

async function putLocal(receiptId: string, image: ReceiptImage): Promise<void> {
  memoryImages.set(receiptId, { mime: image.type || "image/jpeg", bytes: image.bytes });
  try {
    await mkdir(diskDir(), { recursive: true });
    await writeFile(path.join(diskDir(), `${receiptId}.bin`), image.bytes);
    await writeFile(
      path.join(diskDir(), `${receiptId}.mime`),
      image.type || "image/jpeg",
      "utf8",
    );
  } catch {
    /* memory map is enough for local */
  }
}

async function getLocal(receiptId: string): Promise<{ mime: string; bytes: Buffer } | null> {
  const mem = memoryImages.get(receiptId);
  if (mem) return mem;
  try {
    const bytes = await readFile(path.join(diskDir(), `${receiptId}.bin`));
    const mime = await readFile(path.join(diskDir(), `${receiptId}.mime`), "utf8");
    return { mime: mime.trim() || "image/jpeg", bytes };
  } catch {
    return null;
  }
}

export async function putReceiptImage(receiptId: string, image: ReceiptImage): Promise<void> {
  const mime = image.type || "image/jpeg";
  const store = blobStore();

  if (store && usingDatabase()) {
    const key = receiptImageObjectKey(receiptId, mime);
    await store.put(key, { bytes: image.bytes, mime });
    await ensureImageTable();
    await getPool().query(
      `INSERT INTO ${DB_SCHEMA}.receipt_images
         (receipt_id, mime, bytes, byte_size, storage_key, updated_at)
       VALUES ($1, $2, NULL, $3, $4, now())
       ON CONFLICT (receipt_id) DO UPDATE
         SET mime = EXCLUDED.mime,
             bytes = NULL,
             byte_size = EXCLUDED.byte_size,
             storage_key = EXCLUDED.storage_key,
             updated_at = now()`,
      [receiptId, mime, image.bytes.length, key],
    );
    console.log(
      JSON.stringify({
        event: "receipt.image.put",
        ts: new Date().toISOString(),
        receiptId,
        backend: store.backend,
        storageKey: key,
        imageBytes: image.bytes.length,
      }),
    );
    return;
  }

  if (usingDatabase()) {
    // No blob store configured — legacy bytea path (friend-test / local with only Postgres).
    await ensureImageTable();
    await getPool().query(
      `INSERT INTO ${DB_SCHEMA}.receipt_images
         (receipt_id, mime, bytes, byte_size, storage_key, updated_at)
       VALUES ($1, $2, $3, $4, NULL, now())
       ON CONFLICT (receipt_id) DO UPDATE
         SET mime = EXCLUDED.mime,
             bytes = EXCLUDED.bytes,
             byte_size = EXCLUDED.byte_size,
             storage_key = NULL,
             updated_at = now()`,
      [receiptId, mime, image.bytes, image.bytes.length],
    );
    return;
  }

  await putLocal(receiptId, image);
}

export async function getReceiptImage(
  receiptId: string,
): Promise<{ mime: string; bytes: Buffer } | null> {
  if (usingDatabase()) {
    await ensureImageTable();
    const { rows } = await getPool().query<ImageRow>(
      `SELECT mime, byte_size, storage_key, bytes
         FROM ${DB_SCHEMA}.receipt_images
        WHERE receipt_id = $1`,
      [receiptId],
    );
    const row = rows[0];
    if (!row) return null;

    if (row.storage_key && usingBlobStore()) {
      const store = blobStore();
      if (!store) return null;
      const object = await store.get(row.storage_key);
      if (!object) return null;
      return { mime: object.mime || row.mime, bytes: object.bytes };
    }

    if (row.bytes?.length) {
      return { mime: row.mime, bytes: row.bytes };
    }
    return null;
  }

  return getLocal(receiptId);
}

export async function hasReceiptImage(receiptId: string): Promise<boolean> {
  if (usingDatabase()) {
    await ensureImageTable();
    const { rows } = await getPool().query<{ ok: number }>(
      `SELECT 1 AS ok FROM ${DB_SCHEMA}.receipt_images WHERE receipt_id = $1 LIMIT 1`,
      [receiptId],
    );
    return rows.length > 0;
  }
  return Boolean(await getLocal(receiptId));
}

export async function deleteReceiptImage(receiptId: string): Promise<void> {
  if (usingDatabase()) {
    await ensureImageTable();
    const { rows } = await getPool().query<{ storage_key: string | null }>(
      `SELECT storage_key FROM ${DB_SCHEMA}.receipt_images WHERE receipt_id = $1`,
      [receiptId],
    );
    const key = rows[0]?.storage_key;
    await getPool().query(`DELETE FROM ${DB_SCHEMA}.receipt_images WHERE receipt_id = $1`, [
      receiptId,
    ]);
    if (key) await deleteObjectKey(key);
    return;
  }
  memoryImages.delete(receiptId);
  try {
    await unlink(path.join(diskDir(), `${receiptId}.bin`));
    await unlink(path.join(diskDir(), `${receiptId}.mime`));
  } catch {
    /* ignore */
  }
}
