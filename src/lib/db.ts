import { Pool, type PoolClient } from "pg";

/** Dedicated schema on a shared Railway Postgres instance — other apps use their own schemas. */
export const DB_SCHEMA = "split_the_wine";

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

        CREATE INDEX IF NOT EXISTS receipts_updated_at_idx
          ON ${DB_SCHEMA}.receipts (updated_at DESC);
      `);
    })();
  }
  await globalForDb.__splitTheWineMigrated;
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
