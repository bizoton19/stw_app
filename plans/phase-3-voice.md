# Phase 3 — Guest voice order memory + reconcile

Status: **design + technical plan — later.** Depends on [Phase 2 venue typeahead](./phase-2-venue.md) storing structured `venue` on the receipt. Do not build until Phase 2 is live and App Store / privacy copy already covers venue storage.

Parent plan: [requirements.md](./requirements.md) §5 / §17.

---

## Philosophy risks (Phase 3–specific)

Phase 2 risks (location on receipt, Places, friction) are in [phase-2-venue.md](./phase-2-venue.md). Phase 3 adds the sharper tension:

| Risk | How it fights the philosophy | Mitigation if we proceed |
|---|---|---|
| **Ambient mic** | Listening is the opposite of “we don’t want your life.” | Guest **arms** the night (default off); venue-gated; **manual Listen** always preferred; auto only when Places category confirmed; session-bound kill switch. |
| **Scope creep to accounts** | Matching guests across nights tempts “sign in to sync drafts.” | Forbid accounts. Drafts stay **on-device** (or ephemeral guest token tied to one night). |
| **Trust / review** | App Store will scrutinize mic + location together. | Purpose string: “Optional: remember what you ordered to suggest claims.” Never always-on. |

**Bottom line:** Phase 3 is compatible **only** as optional guest assist with hard kill switches. If it needs long-lived user profiles or continuous upload of ambient audio, stop — that is a different product.

---

## Problem

Guests forget orders by claim time. Phase 2 does not fix that; it only gives a **stable place key** to match against. Without `placeId`/coords, reconcile falls back to weaker time + fuzzy name only.

Real-world scene: phone on the table at a loud bar; several people order; we want **this guest’s** lines later on the claim board — not the whole table’s chatter.

## Goal — “Shazam for my order”

Product metaphor: **Shazam-like listen**, but gated to food/drink places and aimed at order lines, not songs.

1. **Venue gate:** only offer / auto-arm listening when device location matches a Google Places (or MapKit) category of restaurant / bar / cafe / nightlife.
2. **Ways to listen** (all still no typing for the guest):
   - **Hold-to-order (best signal):** guest intentionally aims the phone at themselves (or holds it out) while they speak their order. App is already Listening; they say the order out loud — **nothing to type**. UI tip: “Hold your phone toward you when you order.”
   - **Manual Listen (Shazam tap):** big Listen control — tap when about to order / right after; tap Stop when done. Same pipeline.
   - **Auto (optional):** if guest has armed “listen tonight” and venue category is confirmed, app may keep a session while they’re at the place — still session-bound, still killable. Lower precision (table chatter); guest prunes later.
3. Produce a **personal order draft** from what was heard — guest should not need to type item names if listen worked.
4. When opening host link `/r/:id`, suggest claims if draft overlaps receipt **time + venue** (+ fuzzy items).
5. Human confirms (check / uncheck). Existing claim API unchanged. Typing remains a fallback only if listen missed something.

This is **guest assist**, not a second host path. The host still photographs the receipt. Vision parse + host review remain source of truth for what’s on the check.

**Design preference:** optimize the **intentional hold-out** moment first. A guest who *wants* the phone to hear them will beat any AI trying to isolate one voice from a phone left in the middle of a loud table.

---

## Why plain ASR is not enough (and where AI helps)

**ASR alone** turns mic audio → text. It does **not** know whose mouth said “Negroni,” and in a loud room it will happily transcribe the neighbor’s order too. No per-user voice training is required for basic speech-to-text — but **disambiguating speakers** is a harder problem.

| Layer | Job | Needs AI? |
|---|---|---|
| Venue gate | Confirm resto/bar via Places + GPS | No (Places API) |
| Capture | Mic while session armed | No (OS mic) |
| Speech → text | Words from noisy audio | Cloud ASR often better than on-device at bars (Whisper / Google STT / Deepgram) |
| “Is this an order?” | Drop “how was your weekend,” keep “two oysters” | **Yes — small LLM / classifier** on transcript snippets |
| “Likely mine?” | Prefer first-person (“I’ll have…”, “for me…”) over third-person / server talk | **Yes — LLM or rules + LLM**; still imperfect |
| Structure | `{ guessName, qty, confidence }` | **Yes — LLM** (or regex for v0) |
| Speaker separation | Isolate *this* phone-owner’s voice from the table | **Hard** — true diarization / enrollment is research-grade on a phone on a table; **do not bet Phase 3 on it** |

**Honest product stance:** prefer **intentional capture** (phone held toward the guest while they order → no typing). Auto table-listen will **over-hear**, then **filter + rank**, then **let the guest prune**. Success = “suggested 4 lines, 3 were mine, I uncheck 1” — not “only my voice forever.” Typing is the fallback, not the happy path.

### Practical pipeline (recommended)

```
Places category OK + (manual Listen tap | auto-armed session)
        ↓
  short audio windows (not infinite raw upload)
        ↓
  cloud ASR (noisy bars) → transcript snippets
        ↓
  LLM filter/structure → candidate order lines (confidence scores)
        ↓
  on-device draft (guest can edit / delete live)
        ↓
  later: reconcile to host receipt → suggest claims
```

**Manual Listen** is the escape hatch when auto is confused: tap → listen ~15–60s while *you* order → stop. Same pipeline, much higher signal.

Enrollment (“say three phrases so we know your voice”) is **optional later**, not required for v1, and still fails when the phone sits in the middle of the table.

---

## Activation gates (hard)

| Gate | Rule |
|---|---|
| Place type | Only venues classified as restaurant / bar / cafe / nightlife (Places category). Homes, offices, transit, parks → **never** offer or auto-arm listening. |
| User consent | Explicit arming: “Listen for my orders tonight?” Default **off**. Easy kill switch (notification / in-app Stop). |
| Manual always available | Shazam-style **Listen** button whenever venue gate is green (and optionally a “I’m not at a listed place — listen anyway” override with extra confirm). |
| Auto | Only if armed + category confirmed + still inside geofence / recent Places check. Leave venue → stop. |
| Duration | Session-bound (leave geofence, host link claimed, N hours, or Stop). No indefinite background listen. |
| OS permission | Microphone + Location. If either denied → feature unavailable; claim board works as today. |
| Platform | Store / dev-client build (not Expo Go) for background/geofence + mic patterns Apple will accept. |

Phrase as **“Shazam for your order — only at restaurants you choose.”** Never as always-on eavesdropping.

---

## APIs / models this phase actually needs

| Piece | Provider (examples) | Notes |
|---|---|---|
| Venue category | Google Places (Phase 2) | Gate auto + badge “Listening OK here” |
| Location | OS / `expo-location` | Geofence / proximity |
| ASR (likely cloud for bars) | OpenAI Whisper API, Google Speech-to-Text, or Deepgram | On-device first is fine for quiet tests; **loud bar → plan on cloud** |
| Order extract / filter | LLM via existing OpenRouter (or similar) | “From this transcript, extract order lines that sound like the speaker ordering for themselves” |
| Reconcile | Our code (± light fuzzy / LLM) | Match draft lines → receipt remaining |

Keys stay **server-side** (same pattern as vision). App sends short consented snippets or transcripts, not a permanent audio diary.

---

## Data model

### On-device draft (primary)

```ts
type GuestOrderDraft = {
  sessionId: string;
  activation: "manual" | "auto";
  venue: {
    placeId?: string;
    name: string;
    lat?: number;
    lng?: number;
    category?: string;
  };
  startedAt: string;
  endedAt?: string;
  lines: {
    id: string;
    raw: string;              // transcript snippet
    guessName: string;
    qty: number;
    confidence: number;
    likelySelf?: boolean;     // LLM / heuristic: first-person order?
    at: string;
  }[];
};
```

If cloud ASR/LLM is used, send **audio snippets or transcripts only with consent**, never continuous upload without a session boundary. Do **not** store raw audio longer than needed to produce the draft unless the user explicitly saves it for support.

### Optional server table

Only if cross-device sync is required — default **off** for philosophy:

```sql
CREATE TABLE split_the_wine.guest_order_drafts (
  id text PRIMARY KEY,
  guest_token text NOT NULL,          -- random, not an account
  place_id text,
  lat double precision,
  lng double precision,
  body jsonb NOT NULL,                -- lines, times; no raw audio
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL     -- hard TTL, e.g. 24–72h
);
CREATE INDEX guest_order_drafts_expiry_idx
  ON split_the_wine.guest_order_drafts (expires_at);
CREATE INDEX guest_order_drafts_place_time_idx
  ON split_the_wine.guest_order_drafts (place_id, created_at DESC);
```

Prefer **client-only drafts** first so the server never holds guest speech products.

---

## Reconcile algorithm

Inputs: draft + `PublicReceipt` (includes Phase 2 `venue`, `createdAt`, `remaining`).

Match if:

1. Time: draft window overlaps `receipt.createdAt` ± 3–6h, and  
2. Place: `draft.venue.placeId === receipt.venue.placeId` **or** haversine < ~150–300m, and  
3. Items: fuzzy match `guessName` → remaining lines; qty ≤ remaining.

Output: ranked suggestions for UI checklist. Never auto-claim. Low-confidence lines become “suggestions to ignore,” not auto-claims.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/receipts/:id/reconcile-suggest` | Optional server rank; or pure client-side match against GET receipt (**preferred first**). |
| — | Claim | Existing `POST …/claims` after guest confirms. |

Does **not** replace host vision parse or parse-review eval. Orthogonal feature.

---

## UI

- Venue badge when Places says resto/bar: “Listening available here.”
- **Listen** (Shazam-style primary) — tap to start; coaching copy while active: “Hold your phone toward you and say your order.” Tap Stop when done.
- Optional toggle: “Keep listening while I’m here tonight” (auto-arm / phone-on-table) — off by default; explain it may catch others’ orders.
- Live draft list as candidates appear — guest reviews by tap (keep / not mine), **not by retyping** when listen worked.
- Claim board banner: “We think you ordered these — claim them?”
- Checklist (pre-check only high confidence + `likelySelf`); confirm → existing multi-claim API.
- Always: “Ignore suggestions” → normal claim board; add lines manually only if something was missed.

No silent claims. No blocking the board if reconcile fails. Host never sees guest audio or private drafts unless the guest claims (then only the claim, as today).

---

## Out of scope

- Always-on mic or location outside food/drink context (or without arming).
- Perfect speaker ID / “only my voice” as a v1 requirement.
- Auto-claim / auto-fill without review.
- Host voice as substitute for receipt photo.
- Long-lived dining history or accounts.
- Shipping this in the first App Store binary.
- Putting ASR / LLM keys in the mobile app.

---

## Done when

Guest can **manually** Listen at a Places-confirmed venue and get usable draft lines; optional auto-arm works only at resto/bar; same-night host link suggests claims when Phase 2 venue matches; guest can prune false positives; store review accepts mic/location copy.

---

## Build order (relative)

1. [Phase 2](./phase-2-venue.md) live + friend-tested venue / category accuracy.
2. **Intentional Listen path:** tap Listen → hold phone toward self → cloud ASR → LLM extract → on-device draft (no typing) → reconcile.
3. Live prune UI (“not mine”) during the meal; manual add only as fallback.
4. Optional auto-arm when Places category confirmed + geofence (phone on table).
5. Only later: voice enrollment / diarization experiments (not blocking).

---

## Open questions

- ASR vendor for loud bars (Whisper vs Deepgram vs Google STT) — quality vs cost vs latency.
- LLM prompt/model for “extract self-orders only” — false positive rate at a real table.
- How aggressive auto-arm can be before App Review / users feel watched.
- Approximate vs precise location (privacy vs category match).
- Web guests: native-only vs no voice on web.
- Retention: minutes vs until claim vs until link expires.
- Whether a short “hold phone near you when you order” tip beats any AI separation.
