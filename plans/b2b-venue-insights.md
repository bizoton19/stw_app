# B2B venue insights — aggregate tabs, not raw receipts

**Status:** design plan — not building yet  
**Goal:** Learn from real tables (party size, mix, ticket, wine splits) for **venue / market analytics**, without retaining raw checks, photos, or guest PII.  
**Related:** [phase-2-venue.md](./phase-2-venue.md) (venue lives on the receipt), [requirements.md](./requirements.md) (ephemeral tabs), delete-closed-tab behavior (close → delete).

---

## Philosophy (non‑negotiable)

Split the Wine’s pitch is **tonight’s table, not a ledger**. Analytics must not quietly become a second product that stores every receipt forever.

| Keep | Never keep (in insights store) |
|---|---|
| Anonymized **tab facts** + venue rollups | Receipt JSON body, line names as printed, claimer names/contacts |
| Coarse drink/food mix, ticket buckets | Tab photos / blob keys |
| Structured venue ids (`placeId`) when host confirmed Places | Venmo/Zelle/MonCash handles |
| Counts of “unique tabs” with clear lifecycle | Cross-night identity of a host or guest (“Alex’s history”) |

**Rule:** Raw receipt dies with the tab (finalize + optional delete). Insights persist only as **derived, irreversible aggregates** written at lifecycle edges.

---

## The uniqueness problem

Hosts often **close → delete → start again** (friend tests, wrong parse, second seating). Without care, analytics double-count or merge nights incorrectly.

| Event | What it is | Analytics identity |
|---|---|---|
| **Publish** | New claim link | New `tab_id` (= receipt id) |
| **Finalize (close)** | Claiming closed; settle still works | Emit **one** `tab_fact` snapshot (or upsert) for that `tab_id` |
| **Reopen** | Claiming opens again | Same `tab_id` — do **not** mint a new fact; update open duration / claim counts on next finalize |
| **Delete (closed only)** | Receipt + image gone | Mark fact `disposition = deleted`; never rehydrate raw body |
| **New tab same venue/day** | After delete (or different host) | **New** `tab_id` — counts as a **separate unique tab** |

### Definition: unique tab

A **unique tab** = one `receipt.id` from first successful **publish** until that id is gone.

- Restart after delete ⇒ **new unique tab** (even same place, same calendar day).  
- Close then reopen without delete ⇒ **same unique tab**.  
- Soft “remove from phone” without server delete ⇒ fact still exists if finalize already fired; local list ≠ analytics.

Optional later: a **night soft-key** `(place_key, receipt_day, host_fingerprint?)` for “how many sittings at Joe’s on Friday” — but **primary grain stays `tab_id`**, not night soft-key. Soft-key is a dimension, not a merge.

Do **not** use host device push token or payment handle as a durable person id.

---

## When to write aggregates

Emit only at server lifecycle edges (source of truth), not from the phone.

```
publish  → optional: tab_started (thin: venue + day + created_at)
finalize → tab_fact upsert (full snapshot; preferred primary write)
reopen   → optional: tab_reopened counter / clear finalized_at
delete   → tab_fact.disposition = deleted (+ deleted_at); raw already gone
```

**Why finalize is the main write:** open drafts and abandoned parses are noise. A closed tab has a settled claim picture (including host leftovers).

If a tab is deleted **without** finalize — product forbids that today (delete only when finalized). Keep that invariant.

---

## What a `tab_fact` contains (no raw receipt)

```ts
type TabFact = {
  /** = receipt.id — unique tab forever in insights land */
  tabId: string;

  /** Lifecycle */
  publishedAt: string;       // ISO
  finalizedAt: string;       // ISO — set/updated on finalize
  deletedAt?: string | null;
  disposition: "finalized" | "deleted";

  /** Venue (structured only) */
  placeKey: string | null;   // e.g. place:mapbox:… or null if typed-only
  placeId?: string | null;
  provider?: "google" | "apple" | "mapbox" | null;
  venueNameHash?: string | null; // optional keyed hash of normalized name — not the name itself in export
  geoHash?: string | null;   // coarse (e.g. geohash precision ~ city block / neighborhood), not exact lat/lng in B2B export
  receiptDay: string;        // YYYY-MM-DD (check date or publish day)

  /** Size of night (counts only) */
  partySize: number;         // distinct claimer names (or claim rows people)
  lineCount: number;
  drinkLineCount: number;
  foodLineCount: number;
  claimEventCount: number;   // number of claim rows, not units

  /** Money — rounded / bucketed for B2B (prefer buckets in exports) */
  itemSubtotalCents: number;
  feeTotalCents: number;
  grandTotalCents: number;
  claimedItemCents: number;
  /** e.g. 0–25, 25–50, 50–100, 100–200, 200+ — store both exact int (internal) and bucket (export) */
  ticketBucket: string;

  /** Mix — categories, never SKU strings */
  drinkShareBps: number;     // drink item $ / item subtotal, basis points
  winePackageTabs: boolean;  // any pour.mode glasses or bottle-heuristic line claimed
  glassesClaimed?: number | null; // sum of claim units on glasses-pour lines
  bottlesPrintedQty?: number | null;

  /** Ops quality (product, not advertiser) */
  parseReview?: "looks_good" | "remove_items" | "needs_edits" | null;
  hadImage: boolean;         // boolean only — no bytes/key retained after delete
  openDurationSec?: number;  // publish → finalize

  /** Schema */
  schemaVersion: number;
};
```

### Explicitly excluded from `tab_fact`

- Item names, qty/price lines, fee names  
- Claimer `personName` / `personContact`  
- `hostInfo.payments` handles  
- Receipt image / `storage_key`  
- Full `claims[]` / remaining map  
- Exact lat/lng in any **exported** B2B feed (internal ops may keep coarse `geoHash` only)

Typed venue with no `placeId`: still emit fact with `placeKey = null`; rollups under **“unscoped / typed”** — useful for product quality, weak for venue CRM.

---

## Rollup tables (what data folks actually query)

Build from `tab_fact` only — never join back to receipts.

### 1. `venue_day_rollup`

Grain: `(place_key, receipt_day)`

- `unique_tabs` — count distinct `tab_id`  
- `deleted_tabs` — count where disposition=deleted  
- `median_ticket`, `p90_ticket`  
- `avg_party_size`  
- `drink_share_avg`  
- `wine_split_tabs` — tabs with glass pour claiming  
- `total_grand_cents_sum` (optional; sensitive — gate behind contract)

**Restart after delete:** two `tab_id`s same place/day ⇒ `unique_tabs = 2`. That is correct for “how many Split the Wine sittings,” not “how many physical checks.”

### 2. `venue_week_rollup` / `venue_month_rollup`

Same metrics, coarser time. For B2B dashboards.

### 3. `category_mix_rollup` (optional Phase B)

Grain: `(place_key, month, kind)` where kind ∈ food|drink|wine_glass|wine_bottle — derived at finalize from item `kind` + `pour`, **without** storing line names.

---

## Pipeline shape

```
┌─────────────┐     finalize/delete      ┌──────────────┐
│ receipts    │ ───────────────────────► │ tab_facts    │  (append/upsert)
│ (ephemeral) │     extract + drop PII   │ (long-lived) │
└─────────────┘                          └──────┬───────┘
       │                                        │
       │ delete                                 ▼
       ▼                                 ┌──────────────┐
   gone (+ blob)                         │ venue_*_rollup│
                                         └──────────────┘
```

Implementation options (decide at build):

| Option | Pros | Cons |
|---|---|---|
| **A. Same Postgres schema** `split_the_wine.tab_facts` | Simple; Railway already there | Mixes product DB with warehouse |
| **B. Separate analytics DB / schema** | Clear blast radius; easier B2B isolation | Ops overhead |
| **C. Event bus → warehouse** (later) | Scale | Overkill for early volume |

**Recommend A → B:** start with `split_the_wine_insights` schema or `tab_facts` table beside product tables; move if a venue customer appears.

Extractor runs **in-process** on finalize/delete (same as host push) — small, sync, transactional with lifecycle. Rollups: nightly job or incremental trigger.

---

## Differentiating close / delete / restart (product copy for analysts)

Document in the insights README / dashboard glossary:

1. **Unique tabs** = distinct `tab_id` finalized at least once.  
2. **Deleted tabs** ⊂ unique tabs that were later hard-deleted (row remains in `tab_facts` with `disposition=deleted`, **no** raw receipt).  
3. **Restarts** = new `tab_id` at same `place_key` + `receipt_day` after a prior delete (or parallel hosts). Show as separate sittings; optional UI “likely restart” if `published_at` within N hours of previous `deleted_at` for same place — heuristic badge only, not a merge.

Never collapse restarts into one tab automatically.

---

## Privacy, consent, ToS

- **Privacy policy:** state that after close we may keep **anonymous venue statistics** (party size, ticket band, drink share) and that deletes remove the check/photo but not irreversible aggregates.  
- **No ad-ID / cross-app tracking.**  
- **B2B contracts:** sell rollups by `place_id` / region, not row-level `tab_facts` with timestamps fine enough to re-identify a private party (aggregate k-anonymity: e.g. suppress venue-days with `< 5` tabs).  
- **Host opt-out (Phase B):** “Contribute anonymous venue insights” toggle — default **on** only if policy + UX are clear; safer default **off** until legal review.  
- Typed-only venues without Places id: exclude from named-venue B2B packs.

---

## Monetization fit (why this structure)

| Buyer | What they get | What we never sell |
|---|---|---|
| Bar groups / venues | Nightly unique sittings, ticket bands, wine-split rates | Guest names, photos, handles |
| Distributors / CPG (later) | Category mix by city/geohash | Brand SKUs unless host later tags |
| Tourism / BI | Neighborhood aggregates | Single-table re-identification |

This is **insights SaaS / data partnership**, not an advertiser pixel.

---

## Implementation phases

### Phase 0 — Spec lock (this doc)
- Agree: unique tab = `receipt.id`; finalize writes fact; delete only marks disposition.  
- Agree: no raw lines/PII/images in insights store.

### Phase A — Write path (MVP)
- `tab_facts` table + extractor on **finalize** and **delete**.  
- Unit tests: open→finalize→fact; finalize→reopen→finalize updates same `tab_id`; finalize→delete sets `deleted`; new publish after delete ⇒ new `tab_id`.  
- No B2B UI yet; internal SQL / CSV export for founders.

### Phase B — Rollups + k-anonymity
- `venue_day_rollup` job.  
- Suppress thin cells.  
- Optional host opt-in/out.

### Phase C — Customer surface
- Venue dashboard or partner API keyed by Places id.  
- Glossary: unique tabs vs deleted vs restarts.

---

## Done when

- Deleting a closed tab removes receipt + blob; **`tab_fact` remains** without any raw receipt fields.  
- Starting a new tab the same night creates a **new** `tab_id` and a **new** fact.  
- Reopen does not create a second unique tab.  
- A venue rollup can answer: “How many unique Split the Wine sittings, median ticket band, % wine glass-split tabs — without reconstructing a single check.”

---

## Open choices (decide at build)

1. Store exact cents internally vs buckets only? (Recommend exact internal, buckets in B2B export.)  
2. Host opt-in default on or off? (Recommend **off** until policy ships.)  
3. Coarse geo: geohash-6 vs city-only for exports?  
4. Same Postgres vs separate insights schema on day one?
