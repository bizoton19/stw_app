import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Durable Places cache.
 *
 * Postgres (`place_nearby_cache`, `place_photo_cache`) when `DATABASE_URL`
 * is set — the same database as the rest of the app. Without it, files under
 * `.data/places-cache` (same local pattern as receipt images). Either store
 * survives a process restart. Process memory is only a read-through of that store.
 *
 * Nearby rows last 30 days per neighborhood cell. Openings and closures
 * inside that window stay stale on purpose: one Google Nearby call per cell
 * per month. Photo bytes are kept for the life of the photo ref.
 */

export const NEARBY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NEARBY_CACHE_MAX_AGE_SECONDS = NEARBY_CACHE_TTL_MS / 1000;
export const PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

type NearbyRow = { storedAt: number; places: unknown[] };
type PhotoRow = { bytes: Uint8Array; contentType: string };

const nearbyMemory = new Map<string, NearbyRow>();
const photoMemory = new Map<string, PhotoRow>();

let backendOverride: "file" | null = null;

/** Unit tests must not touch a real DATABASE_URL. */
export function useFilePlacesCacheForTests(): void {
  backendOverride = "file";
}

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function usePostgres(): boolean {
  return backendOverride !== "file" && databaseConfigured();
}

async function postgres() {
  return import("./db");
}

function cacheDir(): string {
  return path.join(process.cwd(), ".data", "places-cache");
}

function fileId(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function fresh(storedAt: number, now: number): boolean {
  return now - storedAt < NEARBY_CACHE_TTL_MS;
}

export function forgetPlacesCacheMemory(): void {
  nearbyMemory.clear();
  photoMemory.clear();
}

export async function clearPlacesCache(): Promise<void> {
  forgetPlacesCacheMemory();
  if (usePostgres()) {
    const { DB_SCHEMA, ensureSchema, getPool } = await postgres();
    await ensureSchema();
    await getPool().query(`DELETE FROM ${DB_SCHEMA}.place_nearby_cache`);
    await getPool().query(`DELETE FROM ${DB_SCHEMA}.place_photo_cache`);
    return;
  }
  await rm(cacheDir(), { recursive: true, force: true });
}

export async function readNearbyPlaces<T>(key: string, now: number): Promise<T[] | null> {
  const mem = nearbyMemory.get(key);
  if (mem && fresh(mem.storedAt, now)) return mem.places as T[];
  const durable = usePostgres() ? await readNearbyPostgres(key) : await readNearbyFile(key);
  if (!durable || !fresh(durable.storedAt, now)) {
    nearbyMemory.delete(key);
    return null;
  }
  nearbyMemory.set(key, durable);
  return durable.places as T[];
}

export async function writeNearbyPlaces(key: string, places: unknown[], now: number): Promise<void> {
  const row: NearbyRow = { storedAt: now, places };
  nearbyMemory.set(key, row);
  if (usePostgres()) {
    await writeNearbyPostgres(key, row);
    return;
  }
  await writeNearbyFile(key, row);
}

export async function readCachedPhoto(name: string): Promise<PhotoRow | null> {
  const mem = photoMemory.get(name);
  if (mem) return mem;
  const durable = usePostgres() ? await readPhotoPostgres(name) : await readPhotoFile(name);
  if (!durable) return null;
  photoMemory.set(name, durable);
  return durable;
}

export async function writeCachedPhoto(name: string, photo: PhotoRow): Promise<void> {
  const row: PhotoRow = {
    bytes: new Uint8Array(photo.bytes),
    contentType: photo.contentType,
  };
  photoMemory.set(name, row);
  if (usePostgres()) {
    await writePhotoPostgres(name, row);
    return;
  }
  await writePhotoFile(name, row);
}

async function readNearbyPostgres(key: string): Promise<NearbyRow | null> {
  const { DB_SCHEMA, ensureSchema, getPool } = await postgres();
  await ensureSchema();
  const result = await getPool().query<{ places: unknown; stored_at_ms: string | number }>(
    `SELECT places, (EXTRACT(EPOCH FROM stored_at) * 1000) AS stored_at_ms
     FROM ${DB_SCHEMA}.place_nearby_cache
     WHERE cell_key = $1`,
    [key],
  );
  const row = result.rows[0];
  if (!row || !Array.isArray(row.places)) return null;
  const storedAt = Number(row.stored_at_ms);
  if (!Number.isFinite(storedAt)) return null;
  return { storedAt, places: row.places };
}

async function writeNearbyPostgres(key: string, row: NearbyRow): Promise<void> {
  const { DB_SCHEMA, ensureSchema, getPool } = await postgres();
  await ensureSchema();
  await getPool().query(
    `INSERT INTO ${DB_SCHEMA}.place_nearby_cache (cell_key, places, stored_at)
     VALUES ($1, $2::jsonb, to_timestamp($3 / 1000.0))
     ON CONFLICT (cell_key) DO UPDATE
       SET places = EXCLUDED.places,
           stored_at = EXCLUDED.stored_at`,
    [key, JSON.stringify(row.places), row.storedAt],
  );
}

async function readPhotoPostgres(name: string): Promise<PhotoRow | null> {
  const { DB_SCHEMA, ensureSchema, getPool } = await postgres();
  await ensureSchema();
  const result = await getPool().query<{ content_type: string; bytes: Buffer }>(
    `SELECT content_type, bytes FROM ${DB_SCHEMA}.place_photo_cache WHERE photo_name = $1`,
    [name],
  );
  const row = result.rows[0];
  if (!row?.bytes || !row.content_type.startsWith("image/")) return null;
  return { bytes: new Uint8Array(row.bytes), contentType: row.content_type };
}

async function writePhotoPostgres(name: string, photo: PhotoRow): Promise<void> {
  const { DB_SCHEMA, ensureSchema, getPool } = await postgres();
  await ensureSchema();
  await getPool().query(
    `INSERT INTO ${DB_SCHEMA}.place_photo_cache (photo_name, content_type, bytes)
     VALUES ($1, $2, $3)
     ON CONFLICT (photo_name) DO NOTHING`,
    [name, photo.contentType, Buffer.from(photo.bytes)],
  );
}

async function readNearbyFile(key: string): Promise<NearbyRow | null> {
  try {
    const raw = await readFile(path.join(cacheDir(), "nearby", `${fileId(key)}.json`), "utf8");
    const parsed = JSON.parse(raw) as { storedAt?: unknown; places?: unknown };
    if (typeof parsed.storedAt !== "number" || !Array.isArray(parsed.places)) return null;
    return { storedAt: parsed.storedAt, places: parsed.places };
  } catch {
    return null;
  }
}

async function writeNearbyFile(key: string, row: NearbyRow): Promise<void> {
  const dir = path.join(cacheDir(), "nearby");
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${fileId(key)}.json`);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(row));
  await rename(tmp, target);
}

async function readPhotoFile(name: string): Promise<PhotoRow | null> {
  const id = fileId(name);
  try {
    const [bytes, contentType] = await Promise.all([
      readFile(path.join(cacheDir(), "photos", `${id}.bin`)),
      readFile(path.join(cacheDir(), "photos", `${id}.type`), "utf8"),
    ]);
    const type = contentType.trim();
    if (!type.startsWith("image/") || bytes.byteLength === 0) return null;
    return { bytes: new Uint8Array(bytes), contentType: type };
  } catch {
    return null;
  }
}

async function writePhotoFile(name: string, photo: PhotoRow): Promise<void> {
  const dir = path.join(cacheDir(), "photos");
  await mkdir(dir, { recursive: true });
  const id = fileId(name);
  await writeFile(path.join(dir, `${id}.bin`), photo.bytes);
  await writeFile(path.join(dir, `${id}.type`), photo.contentType, "utf8");
}
