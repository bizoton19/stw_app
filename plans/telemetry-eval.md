# Vision telemetry & model eval plan

Status: friend-test. Prefer Railway built-ins first; add app JSON logs next; golden-set eval only when swapping models.

## Goal

Know how long OpenRouter takes per receipt parse, whether it succeeded, and later whether a new model is actually better — without standing up Datadog/Sentry yet.

---

## What Railway already gives you (use this now)

No code required. Your `api` service already emits **edge HTTP logs** and **HTTP metrics**.

### Dashboard

1. Open the project → **Observability** (or the `api` service → deployment → **Network** / logs).
2. Add panels if useful: **HTTP Requests**, **HTTP Latency** (p50/p90/p95/p99), **HTTP 5xx Rate**, **HTTP Logs**.
3. Filter parse traffic:

```text
@path:/api/receipts/*/parse
```

or exact-ish path filters Railway supports for your routes.

### CLI (linked project)

```bash
cd /path/to/splitTheWine-main
railway logs --service api --http --path /api/receipts --lines 100
railway metrics --service api --http
```

Useful fields on each HTTP line:

| Field | Meaning |
|---|---|
| `@totalDuration` | Full request time at the edge (ms) |
| `@upstreamRqDuration` | Time your Next.js process took to answer (ms) — closest proxy to “vision call” today |
| `@httpStatus` | Status code |
| `@requestId` | Correlate with deploy logs if you add matching app logs later |

**Limitation:** Railway’s HTTP duration is **whole `/parse` request** (upload + vision + DB write), not OpenRouter alone. Still enough to spot “parses are 20s tonight” during friend test.

**Retention:** Hobby ~7 days logs; Pro longer. For permanent history, later ship stdout to a drain (Phase 3) or keep a Postgres `parse_events` table (Phase 1b).

---

## Phase 0 — Ops (this week, zero/low code)

- [ ] Pin an Observability view filtered to `POST …/parse`
- [ ] Cap OpenRouter spend + email alerts (already in railway-security plan)
- [ ] When a friend hits a bad parse, note time + receipt id; pull HTTP log by `@requestId` / timestamp

**Done when:** you can answer “how slow was parse in the last day?” from Railway alone.

---

## Phase 1 — App structured logs (small code change)

Emit **one JSON line per vision attempt** to stdout (Railway deploy logs pick these up automatically).

Suggested fields (no photo bytes, no PII beyond receipt id):

```json
{
  "event": "vision.parse",
  "ts": "2026-09-21T21:00:00.000Z",
  "receiptId": "rc_…",
  "model": "google/gemini-2.5-flash",
  "source": "vision",
  "reason": "ok",
  "ms": 4230,
  "imageBytes": 1844221,
  "itemCount": 6,
  "feeCount": 2
}
```

Implementation sketch:

1. Time `parseReceiptVision` in `src/lib/parse-receipt.ts` / `vision.ts` with `performance.now()` (or `Date.now()`).
2. `console.log(JSON.stringify({ … }))` — Railway indexes JSON-ish deploy logs; filter with `vision.parse` in the log explorer.
3. Optionally persist the same row on the receipt (`parseFlag` → richer `parseMeta` jsonb) or a `split_the_wine.parse_events` table so restarts don’t lose history.

**Filter in Railway:** deploy logs containing `vision.parse`  
**CLI:** `railway logs --service api | rg vision.parse`

**Done when:** each live OpenRouter call has a duration you can copy into a spreadsheet if needed.

This is **telemetry**, not model eval.

---

## Phase 2 — Product quality proxy (still not formal eval)

When the host saves items after parse, record a lightweight signal:

- `edited: true|false` (any name/qty/cents change vs first vision result)
- optional: count of lines added/removed

Store on receipt or in `parse_events`. Aggregate later: `edit_rate = edited / vision_ok`.

**Done when:** you know “friends fix ~40% of parses” without labeling photos.

---

## Phase 3 — Real model eval (when you change models)

Only then:

1. **Golden set:** 15–30 receipt photos (your own + friends’, with consent) + expected JSON (items/fees).
2. **Runner:** script posts each image through `parseReceiptVision` (or a CI job with the key in secrets).
3. **Score:** exact/fuzzy item match, fee presence, empty/fail rate, **p50/p95 ms**, estimated cost.
4. Compare `OPENROUTER_VISION_MODEL=A` vs `B` in a table; pick winner; set Railway env.

Latency from Phase 1 feeds the scorecard; quality scores decide the model.

**Done when:** swapping Flash → something else is a measured decision, not a vibe.

---

## What not to do yet

- Datadog / Sentry / full OpenTelemetry collector (unless incidents force it)
- Logging full images or raw model completions (cost + privacy)
- Treating Railway HTTP p99 alone as “model quality”

---

## Railway how-to cheat sheet

| Question | Where |
|---|---|
| Is `/parse` slow? | Observability → HTTP Latency, or `railway metrics --http` |
| This one request? | HTTP logs → `@requestId` / `@totalDuration` |
| OpenRouter-only ms? | Phase 1 JSON `ms` in **deploy** logs (not HTTP edge logs) |
| Keep forever? | Phase 1b Postgres table, or log forwarder later |
| Crash / OOM? | Deploy logs + CPU/memory metrics on the `api` service |

Docs: [Railway logs](https://docs.railway.com/observability/logs), [CLI logs](https://docs.railway.com/cli/logs), [CLI metrics](https://docs.railway.com/cli/metrics).

---

## Suggested order of work

1. **Today:** Use Railway HTTP logs/metrics for `/parse` (Phase 0).  
2. **Next coding slice:** Phase 1 JSON vision log (~small PR).  
3. **After a dozen friend tabs:** Phase 2 edit-rate if parse quality feels flaky.  
4. **Before a model swap:** Phase 3 golden set.

No infra vendor required until retention or multi-service tracing becomes painful.
