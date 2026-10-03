import { Pool, type PoolClient } from "pg";

/**
 * Dedicated schema on a shared Railway Postgres instance — other apps use their own schemas.
 * Override with DB_SCHEMA (e.g. `split_the_wine_dev` for Plan-an-outing / staging).
 * Only allow safe identifiers (no injection via env).
 */
function resolveDbSchema(): string {
  const raw = process.env.DB_SCHEMA?.trim() || "split_the_wine";
  if (!/^[a-z][a-z0-9_]*$/i.test(raw)) {
    throw new Error(`Invalid DB_SCHEMA: ${raw}`);
  }
  return raw;
}

export const DB_SCHEMA = resolveDbSchema();

const globalForDb = globalThis as typeof globalThis & {
  __splitTheWinePool?: Pool;
  __splitTheWineMigrated?: Promise<void>;
};

export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function usingDatabase(): boolean {
  return Boolean(databaseUrl());
}

export function getPool(): Pool {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForDb.__splitTheWinePool) {
    globalForDb.__splitTheWinePool = new Pool({
      connectionString: url,
      // Railway public proxy uses TLS; local docker often does not.
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalForDb.__splitTheWinePool;
}

export async function ensureSchema(): Promise<void> {
  if (!globalForDb.__splitTheWineMigrated) {
    globalForDb.__splitTheWineMigrated = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA};

        CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.receipts (
          id text PRIMARY KEY,
          host_token text NOT NULL,
          body jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.claim_lookup (
          claim_id text PRIMARY KEY,
          receipt_id text NOT NULL REFERENCES ${DB_SCHEMA}.receipts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.host_push_tokens (
          receipt_id text NOT NULL REFERENCES ${DB_SCHEMA}.receipts(id) ON DELETE CASCADE,
          token text NOT NULL,
          platform text,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (receipt_id, token)
        );

        CREATE INDEX IF NOT EXISTS host_push_tokens_receipt_idx
          ON ${DB_SCHEMA}.host_push_tokens (receipt_id);

        CREATE INDEX IF NOT EXISTS receipts_updated_at_idx
          ON ${DB_SCHEMA}.receipts (updated_at DESC);

        CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.launch_notify (
          email text PRIMARY KEY,
          platforms text[] NOT NULL DEFAULT '{}',
          source text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        -- Photo metadata (bytes live in blob store when configured).
        -- Must live in ensureSchema so new DB_SCHEMA envs (e.g. split_the_wine_dev)
        -- are not missing it until the first upload/delete.
        CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.receipt_images (
          receipt_id text PRIMARY KEY REFERENCES ${DB_SCHEMA}.receipts(id) ON DELETE CASCADE,
          mime text NOT NULL,
          bytes bytea,
          byte_size integer,
          storage_key text,
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        -- Nearby top 7, 30 days per neighborhood cell. Photo bytes, kept per ref.
        CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.place_nearby_cache (
          cell_key text PRIMARY KEY,
          places jsonb NOT NULL,
          stored_at timestamptz NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.place_photo_cache (
          photo_name text PRIMARY KEY,
          content_type text NOT NULL,
          bytes bytea NOT NULL,
          stored_at timestamptz NOT NULL DEFAULT now()
        );
      `);
    })();
  }
  await globalForDb.__splitTheWineMigrated;
  // Additive: safe if an older in-process migrate already completed without these.
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.host_push_tokens (
      receipt_id text NOT NULL REFERENCES ${DB_SCHEMA}.receipts(id) ON DELETE CASCADE,
      token text NOT NULL,
      platform text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (receipt_id, token)
    );
    CREATE INDEX IF NOT EXISTS host_push_tokens_receipt_idx
      ON ${DB_SCHEMA}.host_push_tokens (receipt_id);

    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.launch_notify (
      email text PRIMARY KEY,
      platforms text[] NOT NULL DEFAULT '{}',
      source text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.receipt_images (
      receipt_id text PRIMARY KEY REFERENCES ${DB_SCHEMA}.receipts(id) ON DELETE CASCADE,
      mime text NOT NULL,
      bytes bytea,
      byte_size integer,
      storage_key text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.place_nearby_cache (
      cell_key text PRIMARY KEY,
      places jsonb NOT NULL,
      stored_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.place_photo_cache (
      photo_name text PRIMARY KEY,
      content_type text NOT NULL,
      bytes bytea NOT NULL,
      stored_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // Older installs: bytes was NOT NULL / missing blob columns.
  await getPool()
    .query(`ALTER TABLE ${DB_SCHEMA}.receipt_images ALTER COLUMN bytes DROP NOT NULL`)
    .catch(() => undefined);
  await getPool().query(
    `ALTER TABLE ${DB_SCHEMA}.receipt_images ADD COLUMN IF NOT EXISTS byte_size integer`,
  );
  await getPool().query(
    `ALTER TABLE ${DB_SCHEMA}.receipt_images ADD COLUMN IF NOT EXISTS storage_key text`,
  );
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
