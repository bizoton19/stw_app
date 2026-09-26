import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { usingDatabase, ensureSchema, getPool, DB_SCHEMA } from "./db";
import type { ReceiptImage } from "./parse-receipt";

const memoryImages = new Map<string, { mime: string; bytes: Buffer }>();

function diskDir() {
  return path.join(process.cwd(), ".data", "receipt-images");
}

async function ensureImageTable() {
  await ensureSchema();
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.receipt_images (
      receipt_id text PRIMARY KEY REFERENCES ${DB_SCHEMA}.receipts(id) ON DELETE CASCADE,
      mime text NOT NULL,
      bytes bytea NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function putReceiptImage(receiptId: string, image: ReceiptImage): Promise<void> {
  if (usingDatabase()) {
    await ensureImageTable();
    await getPool().query(
      `INSERT INTO ${DB_SCHEMA}.receipt_images (receipt_id, mime, bytes, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (receipt_id) DO UPDATE
         SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, updated_at = now()`,
      [receiptId, image.type || "image/jpeg", image.bytes],
    );
    return;
  }
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

export async function getReceiptImage(
  receiptId: string,
): Promise<{ mime: string; bytes: Buffer } | null> {
  if (usingDatabase()) {
    await ensureImageTable();
    const { rows } = await getPool().query<{ mime: string; bytes: Buffer }>(
      `SELECT mime, bytes FROM ${DB_SCHEMA}.receipt_images WHERE receipt_id = $1`,
      [receiptId],
    );
    return rows[0] ?? null;
  }
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

export async function hasReceiptImage(receiptId: string): Promise<boolean> {
  return Boolean(await getReceiptImage(receiptId));
}

export async function deleteReceiptImage(receiptId: string): Promise<void> {
  if (usingDatabase()) {
    await ensureImageTable();
    await getPool().query(`DELETE FROM ${DB_SCHEMA}.receipt_images WHERE receipt_id = $1`, [
      receiptId,
    ]);
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
