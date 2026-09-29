# DIY Postgres backups (daily)

Logical dumps of schema **`split_the_wine`** → gzip → your existing S3-compatible bucket (Railway Buckets / R2 / S3).

**Why DIY:** Railway managed volume backups / PITR need Pro. Free-tier Supabase also has no managed restores. This is the free path.

## What runs

| Piece | Role |
|---|---|
| [`scripts/backup-db.sh`](../scripts/backup-db.sh) | `pg_dump --schema=split_the_wine` → upload → prune old files |
| [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml) | Daily **06:15 UTC** + manual **Run workflow** |

Objects land at:

```text
s3://<bucket>/db-backups/split_the_wine/<UTC-timestamp>.sql.gz
```

Default retention: **14 days** (override with secret `BACKUP_RETENTION_DAYS`). Daily is fine for this app’s size; prune keeps egress/storage bounded.

## One-time setup

### 1. Database URL GitHub can reach

The Action runs on GitHub’s network, **not** inside Railway’s private mesh.

- Use Railway Postgres **public TCP proxy** / public `DATABASE_URL` as the Action secret, **or**
- Keep prod API on the **private** URL (recommended) and only expose public TCP for backups / ops.

Never commit the URL. Prefer a DB user limited to schema `split_the_wine` when you can.

### 2. GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Source |
|---|---|
| `DATABASE_URL` | Railway public Postgres URL |
| `OBJECT_STORAGE_BUCKET` | Same as Railway / `.env` bucket |
| `OBJECT_STORAGE_ENDPOINT` | e.g. Railway bucket endpoint |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | Bucket credentials |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | Bucket credentials |
| `OBJECT_STORAGE_REGION` | optional (`auto`) |
| `OBJECT_STORAGE_FORCE_PATH_STYLE` | optional (`true` only if needed) |
| `BACKUP_RETENTION_DAYS` | optional (`14`) |

Reuse the same bucket as receipt images; backups stay under `db-backups/`.

### 3. Enable & test

1. Push this workflow to `main` (Actions must be enabled for the repo).
2. **Actions → DB backup → Run workflow**.
3. Confirm a new object under `db-backups/split_the_wine/` in the bucket UI / `aws s3 ls`.

## Restore (drill this once)

```bash
# download
aws s3 cp s3://$OBJECT_STORAGE_BUCKET/db-backups/split_the_wine/<file>.sql.gz ./restore.sql.gz \
  --endpoint-url "$OBJECT_STORAGE_ENDPOINT"

gunzip -c restore.sql.gz > restore.sql

# restore into an empty target DB / schema (destructive if objects exist — prefer a fresh DB)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f restore.sql
```

Receipt **photos** live in object storage keys `receipts/…`, not in the SQL dump. Restoring the schema restores metadata + claim JSON; blobs remain in the bucket if you didn’t delete them.

## Local manual run

```bash
export DATABASE_URL='postgresql://…'   # public or local
export OBJECT_STORAGE_BUCKET=…
export OBJECT_STORAGE_ENDPOINT=…
export OBJECT_STORAGE_ACCESS_KEY_ID=…
export OBJECT_STORAGE_SECRET_ACCESS_KEY=…
# optional: OBJECT_STORAGE_REGION OBJECT_STORAGE_FORCE_PATH_STYLE BACKUP_RETENTION_DAYS

./scripts/backup-db.sh
```

Needs `pg_dump`, `gzip`, and AWS CLI v2.

## Limits / honesty

- This is a **daily snapshot**, not point-in-time recovery. Worst case you lose up to ~24h of writes.
- Failed Actions = no dump that day — watch the workflow email / badge.
- When you’re ready for one-click restore + PITR, Railway Pro (or similar) can sit **on top of** this; keep the DIY dump as an off-site copy.
