# Phase 3 — Guest voice order memory + reconcile

Status: **design + technical plan — later.** Depends on [Phase 2 venue typeahead](./phase-2-venue.md) storing structured `venue` on the receipt. Do not build until Phase 2 is live and App Store / privacy copy already covers venue storage.

Parent plan: [requirements.md](./requirements.md) §5 / §17.

---

## Philosophy risks (Phase 3–specific)

Phase 2 risks (location on receipt, Places, friction) are in [phase-2-venue.md](./phase-2-venue.md). Phase 3 adds the sharper tension:

| Risk | How it fights the philosophy | Mitigation if we proceed |
|---|---|---|
| **Ambient mic + pushes** | Geofence notices + invites to listen can feel surveilly. | Arrival push must be **opt-in Yes** before mic; never silent listen; unclear recall is an offer not a demand; easy “don’t ask tonight.” |
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
| User consent | Never auto-start mic from a geofence alone. First contact is a **push** (or in-app prompt): guest must tap Yes. Default **off**. Easy kill switch. |
| Manual always available | Shazam-style **Listen** + **re-speak remembered orders** whenever venue gate is/was green. |
| Auto listen | Only after guest accepts the arrival push (or in-app Yes) + category still confirmed. Leave venue → stop listen; may fire **unclear-orders** push (below). |
| Duration | Session-bound (leave geofence, host link claimed, N hours, or Stop). No indefinite background listen. |
| OS permission | Microphone + Location + **Push Notifications**. If mic/location denied → feature unavailable; claim board works as today. Push denied → in-app prompts only. |
| Platform | Store / dev-client build (not Expo Go) for background/geofence + mic + push patterns Apple will accept. |

Phrase as **“Shazam for your order — only at restaurants you choose.”** Never as always-on eavesdropping.

---

## Push notifications (explicit product flows)

Two pushes are **first-class**, not nice-to-haves. Copy is illustrative; final strings go through i18n + App Review tone check.

### 1. Arrival — offer to listen

**When:** device is at a Places-confirmed restaurant / bar / cafe (geofence enter or periodic place check), and guest has not already armed/dismissed for this visit.

**Push (example):**  
> We notice you’re at a bar or restaurant. Would you like Split the Wine to listen for your orders?

**Actions:**
- **Yes** → open app, request mic if needed, start Listening session (coach: hold phone toward you when you order).
- **Not now** → dismiss; do not listen; optionally snooze for this visit.
- **Don’t ask again tonight** → suppress further arrival pushes until next calendar day / next distinct venue.

Never start the mic from the notification alone without a Yes tap (OS + trust).

### 2. Unclear / leave — offer to re-speak from memory

**When** (any of):
- Guest leaves the venue (geofence exit) **and** draft is empty or mostly low-confidence / “unclear,” **or**
- Listening session ends and capture quality is poor, **or**
- Guest armed listen but produced no usable lines after a reasonable window.

**Push (example):**  
> Your orders weren’t clear. Want to speak them to me now while you still remember? I’ll save them for when the host sends the check.

**Actions:**
- **Speak now** → open app straight into a **recall Listen** mode (same ASR → LLM pipeline; activation: `"recall"`). Guest holds phone and says what they remember (“I had the Negroni and the oysters”).
- **Skip** → keep whatever draft exists (or none); normal claim board later.

This is the safety net so the guest still avoids typing: **voice recall**, not a form.

### Push infra (engineering)

| Piece | Notes |
|---|---|
| Client | Expo Notifications (or APNs + FCM); local notification may be enough for geofence-on-device; remote push if server-driven |
| Trigger | Prefer **on-device** place/geofence → local notification (less server stalking). Remote push only if we must wake a killed app and policy allows |
| Dedupe | One arrival offer per visit; one unclear offer per session |
| Privacy | Do not put venue name + fine coords in notification body if avoidable; “a bar or restaurant” is enough |

---

## APIs / models this phase actually needs

| Piece | Provider (examples) | Notes |
|---|---|---|
| Venue category | Google Places (Phase 2) | Gate arrival push + badge “Listening OK here” |
| Location | OS / `expo-location` | Geofence enter/exit for arrival + leave pushes |
| Push | Expo Notifications / APNs / FCM | Arrival offer + unclear recall offer |
| ASR (likely cloud for bars) | OpenAI Whisper API, Google Speech-to-Text, or Deepgram | Live listen + recall re-speak |
| Order extract / filter | LLM via existing OpenRouter (or similar) | Extract self-orders; score clarity for “unclear” trigger |
| Reconcile | Our code (± light fuzzy / LLM) | Match draft lines → receipt remaining |

Keys stay **server-side** (same pattern as vision). App sends short consented snippets or transcripts, not a permanent audio diary.

---

## Data model

### On-device draft (primary)

```ts
type GuestOrderDraft = {
  sessionId: string;
  activation: "manual" | "auto" | "recall";  // recall = re-speak from memory after unclear push
  venue: {
    placeId?: string;
    name: string;
    lat?: number;
    lng?: number;
    category?: string;
  };
  startedAt: string;
  endedAt?: string;
  clarity: "ok" | "unclear" | "empty";  // drives leave / unclear push
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

- **Arrival push** → Yes opens Listening with coaching: “Hold your phone toward you and say your order.”
- In-app **Listen** (Shazam-style) always available when venue gate is green.
- Optional “keep listening while I’m here” only after Yes on the arrival offer.
- Live draft list — keep / not mine by tap; **no typing** when listen/recall worked.
- **Unclear / leave push** → Speak now opens **recall** mode: “Tell me what you ordered — I’ll save it for the host’s check.”
- Claim board banner: “We think you ordered these — claim them?”
- Checklist (pre-check only high confidence + `likelySelf`); confirm → existing multi-claim API.
- Always: “Ignore suggestions” → normal claim board; add lines manually only if voice missed something.

No silent claims. No blocking the board if reconcile fails. Host never sees guest audio or private drafts unless the guest claims (then only the claim, as today).

---

## Out of scope

- Starting the mic from a push without an explicit Yes.
- Always-on mic or location outside food/drink context (or without arming).
- Perfect speaker ID / “only my voice” as a v1 requirement.
- Auto-claim / auto-fill without review.
- Host voice as substitute for receipt photo.
- Long-lived dining history or accounts.
- Shipping this in the first App Store binary.
- Putting ASR / LLM keys in the mobile app.

---

## Done when

Arrival push only at Places-confirmed resto/bar; Yes starts listen; intentional hold-out produces drafts without typing; unclear/leave push offers recall re-speak; same-night host link suggests claims when Phase 2 venue matches; guest can prune; store review accepts mic/location/notification copy.

---

## Build order (relative)

1. [Phase 2](./phase-2-venue.md) live + friend-tested venue / category accuracy.
2. Geofence + **arrival push** → Yes → intentional Listen → ASR → LLM → draft.
3. Clarity scoring + **unclear/leave push** → recall re-speak mode.
4. Reconcile to host claim link; live prune UI.
5. Optional longer auto-listen while at venue (phone on table).
6. Only later: voice enrollment / diarization experiments (not blocking).

---

## Open questions

- Local vs remote push for geofence (battery, killed-app wake, privacy).
- How “unclear” is defined (no lines vs mean confidence &lt; X vs LLM says low quality).
- How long after leave to offer recall (immediate vs 10–30 min while memory is fresh).
- ASR vendor for loud bars (Whisper vs Deepgram vs Google STT).
- LLM false-positive rate at a real table.
- How often arrival pushes before users disable notifications entirely.
- Approximate vs precise location.
- Web guests: native-only vs no voice on web.
- Retention: minutes vs until claim vs until link expires.
