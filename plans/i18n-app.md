# App i18n — marketing languages (en / es / fr / ht)

Status: **product + engineering plan — not scheduled.**  
Related: marketing site (`marketing/index.html` lang menu), mobile starter (`apps/mobile/src/lib/i18n.ts`), [requirements.md](./requirements.md) §0 philosophy.

**Out of scope for this plan:** in-app language switcher / picker. Locale follows the **device** (and later, for web guests, the **browser**). Marketing’s EN / ES / FR / Kreyòl menu stays marketing-only.

---

## One-line goal

Ship the product UI in the same four languages as marketing — **English, Español, Français, Kreyòl (ht)** — so a Haitian / Spanish / French host or guest sees the interview and claim flow in their OS/browser language without choosing a language inside the app.

---

## Current state

| Surface | Locales defined | Wired to UI |
|---|---|---|
| Marketing landing | en, es, fr, ht | Yes (page picker) |
| Mobile `i18n-js` | en, es, fr, ht | **Only** host `items` + `fees` |
| Web (Next host + claim) | — | None |
| Push / API user-facing errors | — | English hardcodes |

Brand name **Split the Wine** stays English everywhere (already noted in mobile chrome).

Device detection already exists on mobile (`expo-localization` → `refreshLocaleFromDevice`); `ht` aliases `hat` / `cpf`. Fallback: English. No need for a new i18n framework.

---

## Principles

1. **Device / browser locale only** — no settings screen, no persisted user language preference, no “Language” row on host desk.
2. **Same four codes as marketing** — `en`, `es`, `fr`, `ht`. Do not add more locales in this plan.
3. **Host receipt text stays as printed** — item names, venue strings, guest names are not translated.
4. **Suggest, don’t invent** — pour heuristics / OCR prompts stay English-first until a later locale-aware pass (Phase D optional).
5. **Parity over perfection** — ship complete mobile, then web claim (guests), then push; don’t block App Store on ht literary polish if a native speaker can fix strings in one pass.

---

## Phases

### Phase A — Finish mobile (highest ROI for host binary)

**Work**

1. Expand `Dict` in `apps/mobile/src/lib/i18n.ts` (or split into `locales/{en,es,fr,ht}.json` imported by the same module) to cover all host + claim screens:
   - Host: ready, capture, parsing, restaurant, pour, pay, share, desk/tabs
   - Claim: join, pick, qty, settle / live board, closed, errors / alerts
2. Replace hardcodes with `t("…")` in `apps/mobile/src/app/**` and shared mobile components used there.
3. Keep existing `items.*` / `fees.*` keys; don’t break current translations.
4. Native-speaker pass on **ht** and **fr** (es can start from marketing tone + items/fees already done).
5. Smoke: set Simulator language to Español / Français / Kreyòl → walk host interview + claim once each.

**Done when:** no user-visible English left on those paths when device locale is `es` / `fr` / `ht` (except brand, payment method brand names, and receipt content).

**Explicitly not in A:** language picker UI; web; App Store listing localization.

---

### Phase B — Web claim + settle (guest without the app)

Guests on `/r/:id` often never install native. Browser `navigator.language` (or `Accept-Language`) → same four codes → shared or mirrored dictionary.

**Work**

1. Add a small web i18n helper (can mirror mobile JSON keys where copy matches; don’t force one monorepo package on day one).
2. Wire `src/components/claim-*.tsx`, `join-guest`, `settle-view`, claim board chrome.
3. Host web interview (`host-interview.tsx`) — same pass or immediately after claim, so host/web and host/native don’t diverge in meaning.

**Done when:** opening a claim link on a Spanish-locale browser shows Spanish claim/settle chrome.

**Not in B:** marketing HTML refactor; in-app/web language toggle.

---

### Phase C — Push + API-facing copy

**Work**

1. Host claim push body (“Alex claimed 2× …”) — store host device locale at push-token register time (or derive from `Accept-Language` on register), format notification in that locale.
2. Map common API error codes to localized client strings (prefer client-side `t(error.code)` over translating on the server).
3. Keep server logs / ops messages English.

**Done when:** TestFlight host with device in `es` gets Spanish claim pushes.

---

### Phase D — Optional later (not required for “marketing langs”)

- Locale-aware pour name heuristics (`botella`, `bouteille`, `boutèy`, …).
- Vision / parse system prompts: only if eval shows systematic miss on non-English checks.
- Extract marketing `i18n` blob into shared JSON with the app (nice cleanup; not a blocker).
- App Store Connect / Play listing screenshots + descriptions for es/fr (ht availability depends on store).

---

## Key inventory (Phase A checklist)

Group keys by screen; keep flat or nested like today’s `items.*` / `fees.*`:

| Area | Examples |
|---|---|
| Host ready / capture / parsing | Ready to split…, How should we add the tab?, Looking over every pour… |
| Restaurant / pour / pay / share | Place, pour resolve prompts, payment methods chrome, share CTA |
| Desk / tabs | Host desk empty/list, open/closed labels |
| Claim join / pick / qty | What should we call you?, What did you have?, How many…, Finish |
| Settle / live board | Live board, Settle Payment, still on the table, Close claiming…, pay confirm leave |
| System | Network errors, race claim copy, delete confirm |

Reuse marketing phrasing only where the product meaning matches (privacy one-liners, “we never hold money”). Do **not** paste marketing hero copy into the interview.

---

## Explicit non-goals

- In-app (or in-web) **language switch** — omit; change OS/browser language to test.
- Translating **receipt line items**, venues, or guest-entered names.
- New locales beyond en/es/fr/ht.
- Full RTL / new scripts.
- Auto-detecting language from the receipt photo.

---

## Risks

| Risk | Mitigation |
|---|---|
| ht quality | One native Kreyòl pass before friend-test in HT; fallback to en for any missing key (`enableFallback` already on) |
| Key sprawl / drift mobile vs web | Prefer shared JSON under `packages/` or `src/locales/` once Phase B starts; until then copy keys deliberately |
| Push locale wrong | Persist locale with push token; default `en` |
| Longer strings break layout | Design for ~30% expansion (fr); check pour resolve + settle footer |

---

## Suggested build order

1. Phase A mobile complete  
2. Phase B web claim (+ host web if still used in friend-test)  
3. Phase C push  
4. Phase D only if non-English receipts or App Store locales demand it  

No dependency on Phase 2 venue or Phase 3 voice. Compatible with friend-test anytime after A.

---

## Success

- Device in `es` / `fr` / `ht` → full host + claim UI in that language (mobile).  
- Browser in those locales → claim/settle in that language (web).  
- No language control inside the product.  
- English fallback never shows half-translated screens for missing keys (fallback per key is OK; empty keys are not).
