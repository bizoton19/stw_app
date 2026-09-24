Split the Wine — Product & Technical Plan

Owner: Alex Salomon
Updated: 24 Sep 2026 — Roadmap split: [phase-2-venue.md](./phase-2-venue.md), [phase-3-voice.md](./phase-3-voice.md). Pointers in §17.



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



Once claiming is done, the app computes what each person owes (their items + their proportional share of tax/tip/fees). Guests pay the host via the payment methods the host entered (deep link into Venmo / Cash App / PayPal when possible — never auto-sends money).



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
 | 5. Review/edit line items (fix misreads, soft-remove rows, food/drink cues)
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
 | 15. Per-person totals + guest “You owe” with clickable host payment methods
 |     (Venmo/Cash App/PayPal open apps; Zelle etc. display handle only)

Interview chrome on every host step: back chevron, “n of m”, filling hairline, one title, sticky primary action. Guest join uses the same chrome (1 of 2). The claim board keeps a persistent header + sticky Claim.

4. Non-negotiable requirements





Computer vision receipt parsing is the primary product path, done server-side via OpenRouter (google/gemini-2.5-flash). Without a key, or if the call fails, the stub returns the sample tab so the rest of the product still runs. Manual entry/edit is always the correction layer — never trust a parse unreviewed.



Integer-only claim quantities. No fractional/partial units. Validate client- and server-side.



Real-time decrement. When any guest claims N units, every other open client sees the reduced remaining count without a manual refresh. v0: SSE with poll fallback.



No overclaiming, even under concurrent requests (see §8).



Shareable link, not phone-number-gated. Anyone with the URL can claim. The URL opens the same phone UI — it is not a desktop site. Guests who already have the native app open the same claim + settle flow (deep link / in-app `/r/[id]`); the board and “who owes what” must stay identical between web and app.



Dispute-resolution visibility. Per item: who claimed how many, plus contact.



Host-controlled payment info, entered once in the interview, shown to all guests. On settle, guests see clickable payment methods (Venmo / Cash App / PayPal open the host’s app or https pay link with amount; Zelle / MonCash / Natcash / Other display handle only — no deep link). No Texts / WhatsApp / Copy on the guest settle screen.



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

**Phase 2:** [phase-2-venue.md](./phase-2-venue.md) — host venue typeahead (proximity Places) stored on the receipt; resto/bar icons + static map on select.  
**Phase 3:** [phase-3-voice.md](./phase-3-voice.md) — guest voice order memory + reconcile (depends on Phase 2).

### Host items review UX (step 5) — ship with Phase 2 polish

On the “does it look right?” line-item screen:

| Cue | Behavior |
|---|---|
| **Food / drink icons** | Each row shows a small colorful icon when the line is food or drink. **Primary:** vision sets `kind` on each item at parse (`food` \| `drink` \| unknown→null), stored on the receipt body (Postgres jsonb / in-memory). **Fallback:** name heuristic if `kind` missing. Drink → wine/glass in merlot. Food → plate/utensils in warm olive/amber. Ambiguous → no icon. |
| **Swipe to soft-delete** | Swipe a row to mark it removed. Soft delete: **strikethrough**, row stays visible, **subtotal recalculates** without that line. Not hard-removed until publish filters it out. |
| **Undo** | Soft-deleted rows expose **Undo** (and an optional brief toast). Restoring puts the line back into the subtotal. |
| **Trash affordance** | Existing trash control also soft-deletes (same as swipe), not hard-delete. |

Publish sends only non-removed items. Fees step still follows.

6. Client — native-feeling phone app



6.1 Stack





Framework: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Motion.



Shell: PhoneShell — max-width 430px paper column, wine-glass mark, no colored eyebrow.



Navigation: interview steps as client state (not a maze of routes) for the host; /r/[id] for guests. Step transitions slide with direction (forward vs back).



Realtime: EventSource on GET /api/receipts/:id/live; poll GET /api/receipts/:id every few seconds if the socket drops; remaining counts animate in place.



Camera/photo: file input + capture="environment" where supported; explicit Use sample tab so demos never depend on a camera or a key.



Share: Web Share API when present; always a copy-link control.



Settle pay: openable host methods (Venmo / Cash App / PayPal) via deep link / https; Zelle and similar display handle only. Do not auto-send money.



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



9. Settle / pay the host — guest-facing, not a message stub

**Parity:** Web `/r/[id]/settle` and native `apps/mobile/.../settle` show the same screen.

**You owe card (when the viewer has claimed):**
- Amount owed.
- Copy: “You can pay your share of {amount} to the host{, hostname,} via the following payment method(s):”
- Hostname when known (host’s join name on their device); otherwise omit and say “the host”.
- List every `hostInfo.payments` row with brand icon + label + handle.
  - **Openable** (tap → same deep-link pattern as mobile `openHostPay` / web `openHostPayWeb`): Venmo, Cash App, PayPal (paypal.me / @user). Prefills amount + note when the scheme allows.
  - **Display only** (no app open): Zelle, MonCash, Natcash, Other — show label + the phone/email/handle the host entered. Guest pays in that app themselves.
- Split the Wine never moves money and never auto-sends.

**Everyone’s share:** name, contact, line items, fee share, amount. No Texts / WhatsApp / Copy buttons (those were host-nudging stubs and are useless for a guest paying their own share).

**Do not** imply automatic sending or in-app wallet transfer.

True auto-send would need Twilio/WhatsApp Business, server credentials, per-message cost, and an explicit confirm. Real payment apps do not offer public request-money APIs for arbitrary third-party apps.

10. Product decisions (resolved for v0)





Guest accounts? No. Typed name + optional contact. Revisit if spoofing becomes a problem.



Who finalizes? Host-only.



Unclaimed leftovers? Host may finalize anyway; unclaimed units assign to the host so fee math still closes. Show a warning before close.



Edit after claims? Block deleting/reducing an item below claimed units. Allow additive edits.



Link expiry? v0 process memory: gone on restart. Later: retention policy (this is spending data — not “forever by accident”).



Guest without a native install? The shareable URL opens the same phone UI in the browser. Guests who installed the app use the identical claim board + settle flow in-app. Browser and native must stay feature-parity for guest paths.



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



“Auto-send a payment request” is not “auto-send money.” Guests open the host’s pay app (or copy Zelle details) themselves (§9).



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



17. Product roadmap — Phase 2 / Phase 3

Full technical plans live in separate files (schema, API, UI, philosophy risks, open questions):

| Phase | File | Summary |
|---|---|---|
| **2** | [phase-2-venue.md](./phase-2-venue.md) | Host venue typeahead (proximity Places); structured `venue` on receipt. Near-term. |
| **3** | [phase-3-voice.md](./phase-3-voice.md) | Guest opt-in voice order drafts; reconcile to host claim link by time/place. Later; depends on Phase 2. |

**Build order:** App Store / TestFlight for current v0 → Phase 2 → friend-test venue accuracy → Phase 3 (on-device drafts first).

Do not scaffold Phase 3 until Phase 2 is live and privacy copy covers venue storage. Philosophy risks are spelled out in each plan file — Phase 2 is compatible if venue dies with the receipt; Phase 3 only as optional guest assist.
