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

**Status:** shipped — filter deploy logs for `vision.parse`. Hard timeout: `VISION_TIMEOUT_MS` (40s) via Promise.race + AbortSignal.

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

`reason` may also be `timeout` | `failed` | `empty` | `no_key` | `no_image`.

**Filter in Railway:** deploy logs containing `vision.parse`  
**CLI:** `railway logs --service api --deployment | rg vision.parse`

---

## Phase 1b — Friend-test usage funnel (product, not vision)

Vision logs tell you if parse works. This tells you if **people finish a night**.

**Practical minimum:** durable rows (or JSON lines you keep) for three events only:

| Event | When | Fields |
|---|---|---|
| `tab.published` | Host publish succeeds | `tabId`, `client` (`ios` \| `android` \| `web`), `ts` |
| `claim.created` | Each successful claim (single or batch → one event per batch ok) | `tabId`, `client`, `ts`, optional `claimCount` |
| `tab.finalized` | Host closes claiming | `tabId`, `client`, `ts` |

Optional later (same table): `tab.deleted`, `pour.glasses` / `pour.bottle`, `settle.opened`.

**Store:** Postgres `usage_events (id, event, tab_id, client, ts, meta jsonb)` — survives Railway log retention. Or stdout JSON with the same shape until volume hurts (then copy into the table).

**No PII:** no names, contacts, payment handles, item strings, or photos.

**Questions this answers:**

- Tabs published / week  
- % of published tabs with ≥1 claim  
- % of published tabs that finalize  
- Rough publish → first claim / publish → finalize latency (from timestamps)

**Not the same as** [b2b-venue-insights.md](./b2b-venue-insights.md) (`tab_facts` = anonymized venue economics). Finalize may write **both** a usage event and a tab fact; different tables.

**Done when:** you can chart a friend-test funnel without PostHog/Amplitude.

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
3. **Friend-test funnel:** Phase 1b `tab.published` / `claim.created` / `tab.finalized` (table or retained JSON).  
4. **After a dozen friend tabs:** Phase 2 edit-rate if parse quality feels flaky.  
5. **Before a model swap:** Phase 3 golden set.

No infra vendor required until retention or multi-service tracing becomes painful.
