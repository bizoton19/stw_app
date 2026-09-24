# Phase 3 — Guest voice order memory + reconcile

Status: **design + technical plan — later.** Depends on [Phase 2 venue typeahead](./phase-2-venue.md) storing structured `venue` on the receipt. Do not build until Phase 2 is live and App Store / privacy copy already covers venue storage.

Parent plan: [requirements.md](./requirements.md) §5 / §17.

---

## Philosophy risks (Phase 3–specific)

Phase 2 risks (location on receipt, Places, friction) are in [phase-2-venue.md](./phase-2-venue.md). Phase 3 adds the sharper tension:

| Risk | How it fights the philosophy | Mitigation if we proceed |
|---|---|---|
| **Ambient mic** | Listening is the opposite of “we don’t want your life.” | Guest **opt-in**, venue-gated (food/drink only), session-bound, easy kill switch. Default **off**. |
| **Scope creep to accounts** | Matching guests across nights tempts “sign in to sync drafts.” | Forbid accounts. Drafts stay **on-device** (or ephemeral guest token tied to one night). |
| **Trust / review** | App Store will scrutinize mic + location together. | Purpose string: “Optional: remember what you ordered to suggest claims.” Never always-on. |

**Bottom line:** Phase 3 is compatible **only** as optional guest assist with hard kill switches. If it needs long-lived user profiles or continuous upload of ambient audio, stop — that is a different product.

---

## Problem

Guests forget orders by claim time. Phase 2 does not fix that; it only gives a **stable place key** to match against. Without `placeId`/coords, reconcile falls back to weaker time + fuzzy name only.

## Goal

1. Guest **opt-in listening** only at food/drink venues (category gate + geofence).
2. Produce an on-device **order draft**.
3. When opening host link `/r/:id`, suggest claims if draft overlaps receipt **time + venue** (+ fuzzy items).
4. Human confirms. Existing claim API unchanged.

This is **guest assist**, not a second host path. The host still photographs the receipt. Vision parse + host review remain source of truth for what’s on the check.

---

## Activation gates (hard)

| Gate | Rule |
|---|---|
| Place type | Only venues classified as restaurant / bar / cafe / nightlife. Homes, offices, transit, parks → **never** offer listening. |
| User consent | Explicit opt-in per session (“Listen for my orders tonight?”). Default **off**. Easy kill switch. |
| Duration | Session-bound (leave geofence, host link claimed, or N hours). No indefinite background listen. |
| OS permission | Microphone + (Approximate or Precise) Location. If either denied → feature unavailable; claim board works as today. |
| Platform | Requires a **dev client / store build** (not Expo Go) for reliable background/geofence + mic patterns Apple will accept. |

Phrase and implement as **“order notepad with voice, only at restaurants you choose.”**

---

## Data model

### On-device draft (primary)

```ts
type GuestOrderDraft = {
  sessionId: string;
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
    raw: string;
    guessName: string;
    qty: number;
    confidence: number;
    at: string;
  }[];
};
```

Prefer **on-device** speech→text where quality allows. If cloud ASR/LLM is used, send audio snippets or transcripts **only with consent**, never continuous upload of ambient audio without a clear session boundary. Do **not** store raw audio longer than needed to produce the draft unless the user explicitly saves it for support.

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

- At venue: “Listen for my orders?” (default off).
- Listening indicator + stop.
- Claim board banner: “We heard you order these — claim them?”
- Checklist of suggested lines (pre-checked only above a confidence bar).
- One tap: confirm selected → existing multi-claim API.
- Always: “Ignore suggestions” → normal claim board.

No silent claims. No blocking the board if reconcile fails. Host never sees guest audio or private drafts unless the guest claims (then only the claim, as today).

---

## Out of scope

- Always-on mic or location outside food/drink context.
- Auto-claim / auto-fill without review.
- Host voice as substitute for receipt photo.
- Long-lived dining history or accounts.
- Shipping this in the first App Store binary.
- Putting ASR keys in the mobile app.

---

## Done when

Opt-in session produces usable drafts; same-night host link shows sensible suggestions when Phase 2 venue was Places-confirmed; dismiss is one tap; store review accepts mic/location copy.

---

## Build order (relative)

1. [Phase 2](./phase-2-venue.md) live + friend-tested venue accuracy.
2. **This phase:** on-device draft + client-side reconcile against Phase 2 venues.
3. Only then consider server-side drafts or cloud ASR.

---

## Open questions

- On-device vs cloud ASR at loud venues — quality bar for “good enough to suggest.”
- Approximate vs precise location (privacy vs match rate).
- Web guests: native-only vs no voice on web.
- Retention: minutes vs until claim vs until link expires.
