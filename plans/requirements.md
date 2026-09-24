Split the Wine — Product & Technical Plan

Owner: Alex Salomon
Updated: 24 Sep 2026 — Roadmap: Phase 2 venue typeahead on host capture (proximity Places); Phase 3 guest voice order memory + reconcile. Philosophy risks called out in §17.0.



0. Design direction (authoritative — ship to these)

This slice is a phone product, not a website with a theme. Next.js is the runtime. Native is the design target.

Product frame





Mobile native first. Drop web as a target. Compose for a hand: one column (~430px), safe-area insets, sticky bottom action, 44px taps. No desktop layout, no marketing page, no color-blocked browser chrome. A large screen still shows the same phone canvas — that is a fallback, not a second composition. Do not add a wide breakpoint.



One job per screen (TurboTax, not a dashboard). The host interview asks one question, then Continue. Progress is confident: “n of m” plus a hairline that fills. The primary action is sticky. Copy is conversational (“Got the check in front of you?”) not product-speak. Guests get a claim board, not the interview.



Always oriented. The person can answer: where am I, what happens next, how do I go back. Back is a chevron, never a buried link. Never strand someone on a dead screen.



Visual language





Very minimal color. Neutral paper canvas (#f6f4f1), ink type, hairline dividers. One restrained merlot accent — only the sticky primary action, the progress tick, and the remaining count of the line you are claiming. No decorative color blocking, no ice-blue secondary surfaces, no red-heavy headers or canvases. Cards are not tinted; lists are hairlines on paper.



Brilliant and smooth. Steps slide in the direction of travel and carry state (draft lines, preview, progress). Buttons press (scale 0.98). The sticky footer is reserved so content never jumps when the CTA appears. Remaining counts tick in place. Honor prefers-reduced-motion.



What stays from v0 engineering





Vision is live through OpenRouter, stub is the fallback. OPENROUTER_API_KEY lives in a gitignored .env.local (see .env.example). The call is server-side only (src/lib/vision.ts, never in the client bundle). Model: google/gemini-2.5-flash, structured JSON matching the parser contract, max_tokens: 2048. No key, explicit sample tab, or a failed call → reference bar tab (§12) so the interview never dead-ends. An unreadable photo or empty extract goes to manual entry. Human review between parse and publish is still mandatory.



Two clients, one API. Next.js remains the parse/claims server and a web prototype. apps/mobile is a real Expo / React Native app (not a WebView wrapper). It stays Expo Go compatible so a phone can scan a QR immediately, and npx expo run:ios builds with Xcode. The OpenRouter key never ships in the native bundle. The API base URL is env-configurable (EXPO_PUBLIC_API_URL); localhost will not work from a physical phone.

v0 stack

Expo (iOS / Android / Expo Go)  →  host interview + guest claim board
Next.js (phone shell, web)      →  same interview + claim board (prototype)
                                →  Route Handlers (in-memory receipts/claims)
                                →  OpenRouter vision (gemini-2.5-flash) → stub fallback
                                →  SSE (+ poll fallback) for live remaining qty

Later: Postgres, object storage, host accounts. The API contract in §7.2 is the migration target. The native app is already a first-class client of that contract.





1. Problem

A group eats/drinks together and one check arrives. Whoever pays wants to
get reimbursed without manually itemizing who had what, texting everyone
individually, and chasing payments. Today this is done by memory,
guesswork, or an even/flat split that isn't fair when orders vary a lot
(e.g. one person's $420 wine package vs. another's $4 apple juice).

2. Goal

A phone app where:





The host photographs (or uploads) the receipt — v0: photo upload or “use the sample tab.”



The server extracts every line item, quantity, and price (plus tax/tip/fees separately) — v0: OpenRouter vision when a key is present; stub fallback otherwise. Manual review always.



The app generates a shareable claim link.



Anyone with the link opens the claim board on their phone, sees only what's still unclaimed, and claims an item + a whole-number quantity of it.



The claimed quantity is subtracted from what's available in real time, visible to everyone.



Once claiming is done, the app computes what each person owes (their items + their proportional share of tax/tip/fees) and generates a payment-request message per person (never auto-sends money).



3. User flow (authoritative — build to this exactly)

Host path is an interview (modified TurboTax). Guest path is a board. Both are phone screens.

HOST (interview)                                GUESTS (claim board)
 |
 | 1. Welcome → “Start with the receipt”
 v
 | 2. Capture: Take photo / choose library / use sample tab
 |    (v0: file picker + sample; camera where the device allows it)
 v
 | 3. Parsing beat — OpenRouter vision when a key is present (several seconds).
 |    No key / failed call → sample tab. Empty/unreadable → manual entry.
 v
 | 4. Confirm restaurant name (one question)
 v
 | 5. Review/edit line items (fix misreads, add/remove rows)
 v
 | 6. Review fees (tax, gratuity, admin — not Subtotal/Total lines)
 v
 | 7. How should people pay you? method + handle
 v
 | 8. Confirm → publish → shareable claim URL
 |--------------------------------------------->| 9. Guest opens claim URL
 |                                              | 10. Enters name + optional contact
 |                                              | 11. Sees remaining qty per item
 |                                              | 12. Picks item, WHOLE NUMBER qty
 |                                              |     (<= remaining), taps Claim
 |                                              | 13. Remaining decrements live
 |                                              |     (repeat 11–13)
 v                                              v
 | 14. Host closes claiming (host-only)
 |     Unclaimed leftovers assign to the host
 v
 | 15. Per-person totals + pre-filled payment-request messages
 |     (sms: / WhatsApp / copy — not auto-sent)

Interview chrome on every host step: back chevron, “n of m”, filling hairline, one title, sticky primary action. Guest join uses the same chrome (1 of 2). The claim board keeps a persistent header + sticky Claim.

4. Non-negotiable requirements





Computer vision receipt parsing is the primary product path, done server-side via OpenRouter (google/gemini-2.5-flash). Without a key, or if the call fails, the stub returns the sample tab so the rest of the product still runs. Manual entry/edit is always the correction layer — never trust a parse unreviewed.



Integer-only claim quantities. No fractional/partial units. Validate client- and server-side.



Real-time decrement. When any guest claims N units, every other open client sees the reduced remaining count without a manual refresh. v0: SSE with poll fallback.



No overclaiming, even under concurrent requests (see §8).



Shareable link, not phone-number-gated. Anyone with the URL can claim. The URL opens the same phone UI — it is not a desktop site.



Dispute-resolution visibility. Per item: who claimed how many, plus contact.



Host-controlled payment info, entered once in the interview, shown to all guests.



Proportional fee splitting. Tax, gratuity, admin/delivery fees split by each person's share of the claimed subtotal — never evenly by headcount.



Downloadable/runnable: npm install && npm run build && npm run start. In-memory store is fine for v0; data resets on server restart.



5. High-level architecture (v0 vs later)

v0 prototype (this repo)

┌──────────────────────────────┐     JSON / SSE      ┌─────────────────────────┐
│  Next.js phone shell         │ <─────────────────> │  Route Handlers         │
│  - TurboTax-style interview  │                     │  - in-memory receipts   │
│  - Guest claim board         │                     │  - OpenRouter vision    │
│  - Settle / pay-request stub │                     │    (stub fallback)      │
│                              │                     │  - claim transactions   │
└──────────────────────────────┘                     └─────────────────────────┘

Later production sketch (do not scaffold now)

Native wrapper  +  Node API  +  Postgres  +  object storage

A separate native binary is a future milestone. v0 proves the interview, claiming, math, and visual language as a phone app running in a webview-shaped shell.

**Phase 2 (see §17):** host venue typeahead (proximity Places) stored on the receipt — foundation for Phase 3 match.  
**Phase 3 (see §17):** guest-side voice order memory at bars/restaurants only, reconciled against the host’s claim link by time/place — opt-in, not always-on.

6. Client — native-feeling phone app



6.1 Stack





Framework: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Motion.



Shell: PhoneShell — max-width 430px paper column, wine-glass mark, no colored eyebrow.



Navigation: interview steps as client state (not a maze of routes) for the host; /r/[id] for guests. Step transitions slide with direction (forward vs back).



Realtime: EventSource on GET /api/receipts/:id/live; poll GET /api/receipts/:id every few seconds if the socket drops; remaining counts animate in place.



Camera/photo: file input + capture="environment" where supported; explicit Use sample tab so demos never depend on a camera or a key.



Share: Web Share API when present; always a copy-link control.



Payment-request stub: sms: and https://wa.me/ plus copy. Do not auto-send.



6.2 Interview & screens







Step / screen



Purpose





Welcome



“Ready to split this check?” Sticky start + quiet sample-tab link





Capture



Photo / library / sample tab — one choice, then Continue





Parsing



Quiet spinner; never a dead end — Continue to manual entry on “failure”





Restaurant



One field: name on the check





Items



Editable hairline list (name, qty, line total); add/remove rows





Fees



Tax / gratuity / admin; add/remove





Pay-you



Host method + handle (Venmo, Zelle, Cash App, other)





Share



Claim URL, copy, native share





Live / Claim



Remaining qty, integer stepper, name, Claim; claim history per item





Settle



Per-person totals, message stubs, dispute board



6.3 Motion & chrome (must feel native)





Progress is a 2px merlot hairline that animates width — not a chunky bar, not a percentage label.



Step body uses AnimatePresence with a 32px directional slide. Going back reverses it.



Primary CTA is a full-width merlot pill, sticky, h-12, press scale 0.98. Disabled is opacity, not a grey brick.



Secondary is a quiet text pill, never a second color.



No layout jump when the footer appears: the chrome always reserves the sticky action slot.



6.4 Client-side validation (must mirror server rules)





Quantity: integer only, min=1, max=remaining at render; re-validate on submit.



Name required before claiming.



Disable Claim while a request is in flight.



On 409 not_enough_remaining, refresh and show the new remaining count.



6.5 Offline / connectivity





If SSE drops, poll and show reconnecting.



A claim submitted while offline fails explicitly — no silent optimistic claim.



7. Server (v0 Route Handlers)



7.1 Stack (v0)





Next.js Route Handlers, module-level in-memory store.



Integer cents for all money.



Per-receipt mutex around claim writes.



Vision: src/lib/vision.ts calls OpenRouter (google/gemini-2.5-flash, structured JSON). src/lib/vision-stub.ts is the fallback and the shared validator. Key: OPENROUTER_API_KEY in .env.local (never committed).



7.2 API contract (keep stable for later)

POST   /api/receipts                 optional image → { receiptId }
POST   /api/receipts/:id/parse       image bytes → vision (or stub) → { receipt, parse }
PUT    /api/receipts/:id             save reviewed items[] + fees[] + hostInfo → publishes, claim URL
GET    /api/receipts/:id             current state
POST   /api/receipts/:id/claims      { itemId, personName, personContact?, units } → decrement
DELETE /api/claims/:claimId          owner-token required
PUT    /api/receipts/:id/host-info   { method, handle }
GET    /api/receipts/:id/totals      per-person totals (subtotal + fee share)
POST   /api/receipts/:id/finalize    host-only; leftovers → host
GET    /api/receipts/:id/live        SSE: claim added/removed, item updated, finalized

Seed demo on boot so /r/demo is always claimable.

7.3 Vision parsing — request/response contract

Wired now: POST /api/receipts/:id/parse reads image bytes on the server. If OPENROUTER_API_KEY is set, it sends the photo to OpenRouter (google/gemini-2.5-flash, max_tokens: 2048) with structured JSON output. The client never sees the key or the model call.

Fallback: no key, explicit sample tab, oversized image, or a failed/aborted call → parseReceiptStub returns the §12 sample tab so the interview continues. An extract with zero items (reason: empty) goes to manual entry instead of substituting the sample. The parsing screen copy says it can take a few seconds; the sticky action stays disabled until the server returns.

Input: JPEG/PNG/WebP (and other image/*) as multipart image. Cap 8MB.

Output contract (validated before trust):

{
  "restaurant": "string or empty string",
  "items": [
    { "name": "string", "qty": 1, "total": 0.0 }
  ],
  "fees": [
    { "name": "string", "amount": 0.0 }
  ]
}

Prompt rules (enforced in the system prompt + normalizeParse):





items = orderable lines with quantity and line total (unit price = total / qty).



fees = tax, gratuity/service, admin, delivery only when they are added on top of the item subtotal. If printed total equals the item sum (VAT-inclusive prices), omit included tax from fees.



Never “Subtotal”, “Total”, tender, or change lines as items or fees.



Missing quantity → 1. Quantities coerced to whole numbers.



Numbers only, no currency symbols, no thousands separators.

Failure handling: salvage JSON if fenced; empty or unreadable → manual entry; transport/model errors → sample tab. Sums that don’t reconcile → flag on review, don’t silently “fix.” Always require human review between parsing and publishing.

Live check (photographed paper tab, not the sample): Berghotel Grosse Scheidegg. google/gemini-2.5-flash returned 4/4 lines with correct whole quantities and line totals (2× Latte Macchiato 9.00, Gloki 5.00, Schweinschnitzel 22.00, Chässpätzli 18.50; items $54.50). Printed Total was not an item. Included 7.6% MwSt (3.85) was omitted from fees, which matches the VAT-inclusive total. A non-receipt image returned reason: empty (manual entry). Sample-tab / no-image still use the stub.

Reference fixture: §12 bar tab (stub + claim/fee-split math). Item subtotal $895.80, fees $327.35, grand $1,223.15.

8. Claiming mechanics & concurrency (server-enforced)





POST /api/receipts/:id/claims must:





Lock or serialize the receipt.



remaining = qty - sum(existing claims.units).



Reject 409 { error: "not_enough_remaining", remaining: N } if requested > remaining.



Else insert the claim.



Broadcast on the live channel after success.



Delete only with the claim-owner token issued at create time (not by name match).



Claim screen is the dispute board: every claim listed with name + contact.



9. Payment requests — v1 is a stub, be explicit about it

Generate a pre-filled message per person
("Hey {name}, your share is ${amount}, send it to {host_handle} via {host_method}")
and open sms: / https://wa.me/ or copy. The human still taps send.
Do not claim or imply automatic sending.

True auto-send would need Twilio/WhatsApp Business, server credentials, per-message cost, and an explicit confirm. Real payment apps do not offer public request-money APIs for arbitrary third-party apps. This product requests payment; it never moves money.

10. Product decisions (resolved for v0)





Guest accounts? No. Typed name + optional contact. Revisit if spoofing becomes a problem.



Who finalizes? Host-only.



Unclaimed leftovers? Host may finalize anyway; unclaimed units assign to the host so fee math still closes. Show a warning before close.



Edit after claims? Block deleting/reducing an item below claimed units. Allow additive edits.



Link expiry? v0 process memory: gone on restart. Later: retention policy (this is spending data — not “forever by accident”).



Guest without a native install? The shareable URL opens the same phone UI in the browser. That is a delivery channel, not a web product. A native wrapper is a later milestone.



11. Non-functional requirements





Phone in the hand, one-handed — claim screen used standing at a table. Thumb reaches the sticky action. Back is top-leading.



Color: paper + ink + one merlot. No second accent. Dark mode, if present, is the same grammar on a deeper paper — never a new palette.



Accessibility: 44px tap targets, contrast, labels on steppers and money. Reduced-motion skips slides.



Privacy: don’t log full receipt payloads. v0 has no persistence beyond process memory.



Currency: integer cents only.



12. Sample regression data (from the reference receipt)

Use this to sanity-check parsing (stub) and claim/fee-split math:







Item



Qty



Line total





Josephine Old Fashioned



8



$120.00





Monkey 47



2



$64.00





Negroni



1



$6.00





Hemingway's Kir Royale



6



$78.00





Apple Juice



1



$4.00





The Botanist



1



$18.00





Negroni



1



$3.00





pom noir N/A



1



$10.00





Altos Reposado Tequila



2



$28.00





Margarita



1



$6.00





Sundress Season



1



$15.00





Pear Pressure



1



$10.00





BQ Wine Package ($60)



7



$420.00





Pineapple Juice



2



$10.00





Espresso



5



$25.00





Unmett Min Booze



1



$78.80

Fees: Admin fee (5%) $44.79 · Gratuity (20%) $179.16 · Tax $103.40
Item subtotal: $895.80 · Fees total: $327.35 · Grand total: $1,223.15

13. Lessons from the first (web-only, hosted) prototype — avoid repeating





A client-side-only build hit a wall: the host environment rejected image input (images_unavailable). Vision stays server-side. The OpenRouter call never ships in the client bundle.



Platform sharing permissions blocked outside guests from writing claims. Claiming goes through our API with our rules, even in v0 (in-memory is still our store).



“Auto-send a payment request” is not “auto-send money.” The app requests payment via a message a human still sends (§9).



Do not design a website. The first hosted prototype looked like a page. This slice is a phone interview.



14. Repo structure (v0)

/
├── src/app/                 # web prototype: interview, /r/[id] claim + settle
├── src/app/api/             # receipts, claims, totals, live SSE (shared by both clients)
├── src/components/          # web phone shell, interview chrome, claim board, settle
├── src/lib/                 # store, money, OpenRouter vision, stub, sample tab
├── apps/mobile/             # Expo React Native client (Expo Go + Xcode)
│   ├── src/app/             # native stacks: host interview, /r/[id] claim + settle
│   └── README.md            # Expo Go + npx expo run:ios steps
└── README.md

The native app is a separate client of the same Route Handlers. Exact run steps: apps/mobile/README.md.

15. Environment/config

# Repo root — live receipt scanning (server only, never commit the value)
OPENROUTER_API_KEY=

# apps/mobile/.env.local — where the phone should send parse/claims
# A physical device cannot use localhost. Example:
# EXPO_PUBLIC_API_URL=http://192.168.1.12:43147
EXPO_PUBLIC_API_URL=

# Later:
DATABASE_URL=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_KEY=
OBJECT_STORAGE_SECRET=
JWT_SECRET=

# Future SMS milestone, not v0:
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=



16. Native client (Expo)





Not a wrapper. apps/mobile is Expo Router + React Native. Host steps are a real native stack (gesture back). Camera uses expo-image-picker so it works in Expo Go; no custom dev client.



API URL. Defaults: EXPO_PUBLIC_API_URL, else Metro LAN host + port 43147, else Android emulator 10.0.2.2, else localhost. Home screen shows reachability and lets you override (stored on device). Localhost is wrong on a physical phone.



Expo Go: npx expo start --lan and scan the QR. Phone and Mac on the same Wi-Fi; Next.js already binds 0.0.0.0:43147.



Xcode: npx expo run:ios (Simulator) or npx expo run:ios --device. Bundle id com.splitthewine.app. Generated ios/ is gitignored.



Physical device only: system camera, haptics, real share sheet. Simulator / Expo web fall back to library, sample tab, and clipboard.



Key: still only in repo-root .env.local. Native env files must never contain OPENROUTER_API_KEY.



17. Product roadmap — Phase 2 (venue) then Phase 3 (voice reconcile)

Status: **design + technical plan.** Phase 2 is the near-term addressable slice (Places typeahead + store venue on receipt). Phase 3 is the later voice listener that **depends on Phase 2’s venue record** to match guest drafts to host tabs. Do not build Phase 3 until Phase 2 is live and App Store / privacy copy already covers venue storage.

### 17.0 Philosophy risks — read before building

Split the Wine’s pitch is: **tonight’s table, not a ledger; no social graph; ephemeral links; host photo + guest claim; we never hold money.** Phase 2/3 pull us toward place history and (later) ambient audio. That is a real tension — not a reason to never ship, but we must not lie to ourselves.

| Risk | How it fights the philosophy | Mitigation if we proceed |
|---|---|---|
| **Location as identity** | Lat/lng + place IDs are sticky personal data; easy to accidentally build “where Alex eats.” | Store venue **on the receipt only**, same retention as the tab. No user place history table. Expire with the link. |
| **Interview friction** | “Start typing the place” is an extra host step vs snap→continue. | Keep typeahead fast; allow exact free-text if Places fails; don’t block publish on GPS deny — only on empty name. |
| **Third-party Places** | Google/Apple see queries + optional location → new privacy disclosure, cost, ToS. | Server-proxy Places (key never in app). Document in Privacy Policy. Prefer Apple MapKit on iOS where policy fits. |
| **“Require typing” vs low-friction** | Force-typing can feel like bureaucracy. | Require a **selected or typed name**; GPS only **ranks** suggestions, never auto-fills without confirmation. |
| **Snap ≠ dine location** | Host may photograph the check at home later — GPS wrong. | Product truth: venue is **what the host affirms**, biased by proximity when available. Don’t pretend GPS is ground truth. |
| **Phase 3 mic** | Ambient listen is the opposite of “we don’t want your life.” | Phase 3 stays guest-opt-in, venue-gated, session-bound. Phase 2 must not bake in always-on assumptions. |
| **Scope creep to accounts** | Matching guests across nights tempts “sign in to sync drafts.” | Forbid accounts for Phase 2/3. Drafts stay on-device (or ephemeral guest token tied to one night). |
| **Trust / review** | App Store will ask why Location (and later Mic). Vague answers get rejected. | Purpose strings: “Find nearby restaurants when naming the venue” / “Optional: remember what you ordered to suggest claims.” |

**Bottom line:** Phase 2 is compatible with the philosophy **if venue lives and dies with the receipt**. Phase 3 is compatible **only** as optional guest assist with hard kill switches. If either feature starts needing long-lived user profiles, stop — that is a different product.

---

### 17.1 Phase 2 — Host venue typeahead (immediate)

#### Problem

Today the host types a free-string restaurant name (§3 step 4). That string is weak for later reconcile (typos, “Joe’s” vs “Josephine”). Hosts also often leave the venue before photographing the check, so GPS-at-snap ≠ dinner place.

#### Goal

When capturing / confirming the place:

1. Host **must** enter a venue name (typed).
2. As they type, show **suggested typeahead** of nearby food/drink places (standard Places autocomplete pattern).
3. Ranking uses **device location when permitted** to bias results; if location denied or far from the meal, typing still works (global/name search).
4. Persist a structured **venue** on the receipt so Phase 3 can match by `placeId` / coords / time — not by fuzzy string alone.

Follow existing UX patterns: Google Places Autocomplete / Apple `MKLocalSearchCompleter` — debounce (~200–300ms), session tokens for billing, “powered by” attribution where required.

#### UX (host interview)

Replace or upgrade current “What’s the name on the check?” screen:

| Element | Behavior |
|---|---|
| Field | Required. Placeholder: “Restaurant or bar.” |
| Typeahead list | Appears after ≥2 characters (or immediately if location granted and query empty → “Nearby”). |
| Row | Place name + short address / neighborhood. |
| Select | Fills field + locks structured venue metadata (editable by clearing and retyping). |
| Location banner | Soft: “Using nearby places to rank results” / “Location off — search by name only.” Never a hard wall. |
| Manual | Host can accept typed name **without** picking a Places row → `placeId` null, `source: "typed"`. Still valid for publish; Phase 3 match quality lower. |

Do **not** auto-select the nearest restaurant without a tap — wrong-venue bugs destroy trust.

#### Data model

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

#### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/places/autocomplete?q=&lat=&lng=&session=` | Proxied Places suggestions (food/drink types). Rate-limit by IP (+ host token if present). |
| `GET` | `/api/places/details?placeId=&session=` | Resolve lat/lng/address/category after select. |
| `PUT` | `/api/receipts/:id` | Existing save — accept `venue` (+ keep `restaurant`). |

Do **not** put Places API keys in the mobile bundle.

Env (server):

```
GOOGLE_PLACES_API_KEY=
PLACES_PROVIDER=google   # google | apple
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

#### UI changes

| Client | Change |
|---|---|
| `apps/mobile` host restaurant step | Typeahead under field; `expo-location` for optional coords; on select → details → set `restaurant` + `venue` in host draft. |
| Web `host-interview` | Same; browser Geolocation optional. |
| Guests | Show venue name only (existing restaurant). Do not expose lat/lng in claim UI. |
| Privacy Policy + App Store | Disclose location for venue suggestions; retention = tab lifetime. |

#### Host draft / client state

```ts
venue: ReceiptVenue | null  // alongside restaurant string
```

Publish payload includes `venue`. Vision parse pipeline unchanged.

#### Phase 2 done when

- Host cannot publish without a non-empty venue name.
- With location on, typing 2+ letters returns nearby food/drink suggestions (debounced).
- Selecting a suggestion persists `placeId` + lat/lng on the receipt.
- Location denied still allows typed-only venue.
- Privacy strings + policy updated.

---

### 17.2 Phase 3 — Guest voice order memory + reconcile (depends on Phase 2)

Builds on Phase 2’s structured `venue`. Without `placeId`/coords, reconcile falls back to weaker time + fuzzy name only.

#### Problem

Guests forget orders by claim time. Phase 2 does not fix that; it only gives a **stable place key** to match against.

#### Goal

1. Guest **opt-in listening** only at food/drink venues (category gate + geofence).
2. Produce an on-device **order draft**.
3. When opening host link `/r/:id`, suggest claims if draft overlaps receipt **time + venue** (+ fuzzy items).
4. Human confirms. Existing claim API unchanged.

#### Activation gates (hard)

Place category, explicit opt-in, session-bound, mic + location permissions, store build (not Expo Go). Never always-on.

#### Data model (Phase 3)

**On-device draft (primary):**

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

**Optional server table** (only if cross-device sync is required — default **off** for philosophy):

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

#### Reconcile algorithm

Inputs: draft + `PublicReceipt` (includes `venue`, `createdAt`, `remaining`).

Match if:

1. Time: draft window overlaps `receipt.createdAt` ± 3–6h, and  
2. Place: `draft.venue.placeId === receipt.venue.placeId` **or** haversine &lt; ~150–300m, and  
3. Items: fuzzy match `guessName` → remaining lines; qty ≤ remaining.

Output: ranked suggestions for UI checklist. Never auto-claim.

#### API (Phase 3)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/receipts/:id/reconcile-suggest` | Optional server rank; or pure client-side match against GET receipt (**preferred first**). |
| — | Claim | Existing `POST …/claims` after guest confirms. |

#### UI (Phase 3)

- At venue: “Listen for my orders?” (default off).
- Listening indicator + stop.
- Claim board: “Suggest from what we heard?” → checklist → confirm.

#### Phase 3 done when

Opt-in session produces usable drafts; same-night host link shows sensible suggestions when Phase 2 venue was Places-confirmed; dismiss is one tap; store review accepts mic/location copy.

---

### 17.3 Explicitly out of scope (both phases)

- Always-on mic or location outside food/drink context.
- Auto-claim / auto-fill without review.
- Host voice as substitute for receipt photo.
- Long-lived dining history or accounts.
- Shipping Phase 3 in the first App Store binary.
- Putting Places or ASR keys in the mobile app.

---

### 17.4 Suggested build order

1. Finish App Store / TestFlight for current v0 (Phase 2 not required to submit).  
2. **Phase 2:** Places proxy + host typeahead + `venue` on receipt + privacy copy.  
3. Friend-test venue accuracy (typed vs Places-selected rate).  
4. **Phase 3:** on-device draft + client-side reconcile against Phase 2 venues.  
5. Only then consider server-side drafts or cloud ASR.

---

### 17.5 Open questions

**Phase 2**

- Google Places vs Apple MapKit Completer (iOS UX vs one Android provider).
- Debounce / session-token billing.
- Whether sample-tab demos need a fake venue object.

**Phase 3**

- On-device vs cloud ASR at loud venues.
- Approximate vs precise location.
- Web guests: native-only vs no voice on web.
- Retention minutes vs until claim vs link expiry.
