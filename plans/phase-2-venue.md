# Phase 2 — Host venue typeahead

Status: **in progress — shipping.** iOS uses on-device **Apple MapKit** (free). Android + web use **Mapbox Search Box** via server proxy (`MAPBOX_ACCESS_TOKEN`). Typed-only venue still allowed if Places fails or location is denied.

Parent plan: [requirements.md](./requirements.md) §5 / §17.

---

## Philosophy risks — read before building

Split the Wine’s pitch is: **tonight’s table, not a ledger; no social graph; ephemeral links; host photo + guest claim; we never hold money.** Phase 2/3 pull us toward place history and (later) ambient audio. That is a real tension — not a reason to never ship, but we must not lie to ourselves.

| Risk | How it fights the philosophy | Mitigation if we proceed |
|---|---|---|
| **Location as identity** | Lat/lng + place IDs are sticky personal data; easy to accidentally build “where Alex eats.” | Store venue **on the receipt only**, same retention as the tab. No user place history table. Expire with the link. |
| **Interview friction** | “Start typing the place” is an extra host step vs snap→continue. | Keep typeahead fast; allow exact free-text if Places fails; don’t block publish on GPS deny — only on empty name. |
| **Third-party Places** | Google/Apple see queries + optional location → new privacy disclosure, cost, ToS. | Server-proxy Places (key never in app). Document in Privacy Policy. Prefer Apple MapKit on iOS where policy fits. |
| **“Require typing” vs low-friction** | Force-typing can feel like bureaucracy. | Require a **selected or typed name**; GPS only **ranks** suggestions, never auto-fills without confirmation. |
| **Snap ≠ dine location** | Host may photograph the check at home later — GPS wrong. | Product truth: venue is **what the host affirms**, biased by proximity when available. Don’t pretend GPS is ground truth. |
| **Scope creep to accounts** | Matching guests across nights tempts “sign in to sync drafts.” | Forbid accounts. No long-lived place history. |
| **Trust / review** | App Store will ask why Location. Vague answers get rejected. | Purpose string: “Find nearby restaurants when naming the venue.” |

**Bottom line:** Phase 2 is compatible with the philosophy **if venue lives and dies with the receipt**. If this feature starts needing long-lived user profiles, stop — that is a different product.

---

## Problem

Today the host types a free-string restaurant name (requirements §3 step 4). That string is weak for later reconcile (typos, “Joe’s” vs “Josephine”). Hosts also often leave the venue before photographing the check, so GPS-at-snap ≠ dinner place.

## Goal

When capturing / confirming the place:

1. Host **must** enter a venue name (typed).
2. As they type, show **suggested typeahead** of nearby food/drink places (standard Places autocomplete pattern).
3. Ranking uses **device location when permitted** to bias results; if location denied or far from the meal, typing still works (global/name search).
4. Persist a structured **venue** on the receipt so Phase 3 can match by `placeId` / coords / time — not by fuzzy string alone.

Follow existing UX patterns: Google Places Autocomplete / Apple `MKLocalSearchCompleter` — debounce (~200–300ms), session tokens for billing, “powered by” attribution where required.

---

## UX (host interview)

Replace or upgrade current “What’s the name on the check?” screen:

| Element | Behavior |
|---|---|
| Field | Required. Placeholder: “Restaurant or bar.” |
| Typeahead list | Appears after ≥2 characters (or immediately if location granted and query empty → “Nearby”). |
| Row | Place name + short address / neighborhood + **venue kind icon** (restaurant or bar only; omit if neither). |
| Select | Locks structured venue; selected card shows **same name + address + kind icon** as the dropdown row. |
| Map | After a Places select with lat/lng, show a **static map** under the selected card (server-proxied Mapbox Static Images — token never in the app). Typed-only venues skip the map. |
| Location banner | Soft: “Using nearby places to rank results” / “Location off — search by name only.” Never a hard wall. |
| Manual | Host can accept typed name **without** picking a Places row → `placeId` null, `source: "typed"`. Still valid for publish; Phase 3 match quality lower. |

Do **not** auto-select the nearest restaurant without a tap — wrong-venue bugs destroy trust.

**Venue kind icons (Phase 2 UX):** From Places/`category` (and MapKit POI). `restaurant` / `cafe` / `bakery` → plate/utensils. `bar` / `pub` / `nightlife` / `wine_bar` / `brewery` → wine glass. Anything else → no icon. Merlot / warm paper palette — restrained, not emoji.

**Static map:** `GET /api/places/static-map?lat=&lng=&w=&h=` (Mapbox light style + merlot pin). Client `<Image>` under the selected venue.

---

## Data model

Extend receipt body (jsonb already on Postgres) with:

```ts
type VenueSource = "places" | "typed";

type ReceiptVenue = {
  name: string;                 // display / receipt header
  placeId?: string | null;      // Google place_id or Apple identifier
  provider?: "google" | "apple" | null;
  formattedAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;     // restaurant | bar | cafe | …
  source: VenueSource;
  confirmedAt: string;          // ISO
};
```

Keep legacy `restaurant: string` as the display name (= `venue.name`) so old clients keep working. New clients read/write `venue` and mirror `restaurant`.

**Schema (Postgres — additive):**

```sql
-- Existing: split_the_wine.receipts (id, host_token, body jsonb, …)
-- Phase 2: venue lives inside body jsonb — no new table required.

CREATE INDEX IF NOT EXISTS receipts_created_at_idx
  ON split_the_wine.receipts (created_at DESC);

-- Optional later if Phase 3 queries by place get hot (expression indexes):
-- CREATE INDEX receipts_venue_place_id_idx
--   ON split_the_wine.receipts ((body #>> '{venue,placeId}'));
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/places/autocomplete?q=&lat=&lng=&session=` | Mapbox suggest (Android/web; iOS Expo Go fallback). |
| `GET` | `/api/places/details?placeId=&session=` | Mapbox retrieve after select. |
| `GET` | `/api/places/static-map?lat=&lng=&w=&h=` | Proxied Mapbox Static Image for the selected venue. |
| `PUT` | `/api/receipts/:id` | Existing save — accept `venue` (+ keep `restaurant`). |

**iOS native:** `apps/mobile/modules/mapkit-search` — `MKLocalSearch` on-device (no Mapbox cost). Falls back to Mapbox API in Expo Go.

Do **not** put Mapbox tokens in the mobile bundle.

Env (server):

```
MAPBOX_ACCESS_TOKEN=
```

Autocomplete response sketch:

```json
{
  "predictions": [
    {
      "placeId": "ChIJ…",
      "name": "Josephine",
      "secondary": "Adams Morgan, Washington, DC",
      "distanceMeters": 120
    }
  ]
}
```

---

## UI changes

| Client | Change |
|---|---|
| `apps/mobile` host restaurant step | Typeahead under field; `expo-location` for optional coords; on select → details → set `restaurant` + `venue` in host draft. |
| Web `host-interview` | Same; browser Geolocation optional. |
| Guests | Show venue name only (existing restaurant). Do not expose lat/lng in claim UI. |
| Privacy Policy + App Store | Disclose location for venue suggestions; retention = tab lifetime. |

### Host draft / client state

```ts
venue: ReceiptVenue | null  // alongside restaurant string
```

Publish payload includes `venue`. Vision parse pipeline unchanged.

---

## Out of scope (this phase)

- Always-on location outside the host venue step.
- Auto-selecting nearest place without a tap.
- Long-lived dining history or accounts.
- Putting Places API keys in the mobile app.
- Phase 3 voice / mic (see [phase-3-voice.md](./phase-3-voice.md)).

---

## Done when

- Host cannot publish without a non-empty venue name.
- With location on, typing 2+ letters returns nearby food/drink suggestions (debounced).
- Selecting a suggestion persists `placeId` + lat/lng on the receipt.
- Location denied still allows typed-only venue.
- Privacy strings + policy updated.

---

## Build order (relative)

1. Finish App Store / TestFlight for current v0 (Phase 2 not required to submit).
2. **This phase:** Places proxy + host typeahead + `venue` on receipt + privacy copy.
3. Friend-test venue accuracy (typed vs Places-selected rate).
4. Then [Phase 3](./phase-3-voice.md).

---

## Open questions

- Google Places vs Apple MapKit Completer (iOS UX vs one Android provider).
- Debounce / session-token billing.
- Whether sample-tab demos need a fake venue object.
