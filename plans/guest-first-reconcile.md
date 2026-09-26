# Guest-first / dual-entry + reconcile — feasibility plan

Status: **analysis + product plan — not scheduled.**  
Related: [phase-3-voice.md](./phase-3-voice.md) (voice capture), [phase-2-venue.md](./phase-2-venue.md) (venue match key), [requirements.md](./requirements.md) §0 philosophy.

---

## One-line idea

Someone opens the app and can start as **host** (today) *or* **guest**. A guest can record what they ordered (type, voice, and/or menu photo) **before** the check exists. When the host later shares `/r/:id`, AI helps match those draft lines to remaining receipt items — guest confirms, then the existing claim API runs.

---

## Verdict (feasibility)

| Slice | Feasible now? | Notes |
|---|---|---|
| **Dual home: Host vs Guest** | **Yes — easy** | Pure UX + routing. No new backend if drafts stay on-device. |
| **Guest types orders + venue/time** | **Yes — easy** | Local draft; reconcile later with fuzzy/LLM match. Highest ROI first. |
| **Guest voice → structured lines** | **Yes — medium** | Already sketched in Phase 3. Needs ASR + LLM; App Store mic story. |
| **Snap menu → pick what I ordered** | **Yes — medium/hard** | Vision already in stack (OpenRouter). Menu OCR ≠ receipt OCR; multi-page, prices, “market” items. Cost + false picks. |
| **Auto-reconcile when host link opens** | **Yes — medium** | Needs shared **venue + time window**; Phase 2 `venue` on receipt is the hard dependency. Fuzzy name match is good enough for suggest; not for silent auto-claim. |
| **True dual source of truth (guest draft = check)** | **No — don’t** | Host receipt photo + review must remain authoritative. Guests propose; host check decides. |

**Bottom line:** Feasible as **guest assist + suggest-to-claim**, not as a second ledger. Ship typed draft + reconcile first; voice and menu photo as add-ons. Do **not** build until Phase 2 venue is reliable enough to match nights.

---

## How it fits the product philosophy

Split the Wine: *tonight’s table, not a ledger; no accounts; host photo is truth; we never hold money.*

| Tension | Risk | Keep / kill |
|---|---|---|
| Guest-first feels like a second app | Dilutes “host starts with check” | Home: two equal entries, same claim end-state |
| Storing guest orders before a tab | Becomes a food diary / social graph | Draft **on-device**, dies with night or after claim; no cross-night identity |
| Menu scan + cloud AI | Cost, privacy, wrong items | Opt-in per session; ephemeral image; never train on user menus |
| Silent auto-claim | Wrong pour, fights, support hell | Always **suggest + confirm**; never claim without tap |
| Accounts to sync draft → link | Philosophy break | Deep link / same device / optional one-night guest token only |

If reconcile needs long-lived user profiles, **stop** — that’s a different product.

---

## Dual-entry UX (home)

```
┌─────────────────────────────┐
│  Split the Wine             │
│                             │
│  [ I’m hosting ]            │  → existing interview (snap check…)
│  [ I ordered something ]    │  → guest draft flow (new)
│                             │
│  Open a claim link…         │  → paste / recent / camera QR later
└─────────────────────────────┘
```

**Host path:** unchanged (capture → review → pour → pay → share).

**Guest path (v1 typed):**

1. Where? (venue typeahead — reuse Phase 2)  
2. Roughly when? (tonight / now — default)  
3. What did you have? (add lines: name + qty; optional note)  
4. Done — “We’ll suggest these when the host sends the link.”

**Voice / menu** appear as optional capture methods on step 3, not as separate apps.

---

## Capture modalities (ranked)

### A. Type (v1 — ship first)

- Pros: no new permissions; cheap; clear; works in Expo Go.  
- Cons: friction at a loud table.  
- Data: `{ name, qty }[]` + venue + timestamps.

### B. Voice (Phase 3 overlap)

- Pros: fits “no typing” fantasy; pipeline already designed.  
- Cons: mic + privacy review; ASR noise; cost.  
- Prefer **hold-to-speak my order** over ambient table listen (same as Phase 3).

### C. Menu photo → select items (v1.5 / v2)

```
Snap menu page(s)
    → vision: extract dish names (+ prices if visible)
    → guest multi-selects “I ordered these”
    → optional qty / notes
    → same draft as typed
```

| Feasibility check | Reality |
|---|---|
| Vision extract menu lines | **Doable** with current OpenRouter pattern |
| Multi-page / fold-out menus | Painful — allow 1–3 photos, guest selects across |
| Prices on menu vs check | Often differ (happy hour, mods) — use **names** for match, not prices |
| “I’ll have the special” with no printed name | Guest must type/voice fallback |
| Cost | Similar to receipt parse; **rate-limit** hard; host token ≠ guest — need guest session budget or on-device only later |

**Recommendation:** menu snap is a **selector UI**, not auto-order. Never invent items the model “thinks” they might want.

---

## Reconcile (when host link opens)

### Preconditions

1. Guest has a local draft with `venue` (ideally `placeId`) + `startedAt` / night key.  
2. Receipt has Phase 2 `venue` + `createdAt` / `receiptDate`.  
3. Match gate: same `placeId` **or** fuzzy venue name + within **N hours** (e.g. 6–12h). Else: no auto-suggest (avoid wrong dinner).

### Matching pipeline

```
draft lines × receipt remaining items
        ↓
  normalize names (lowercase, strip size words)
        ↓
  score: exact > fuzzy (Levenshtein / token) > LLM batch rank (optional)
        ↓
  respect pour capacity (glasses vs bottle) — suggest units, don’t invent capacity
        ↓
  UI: pre-checked suggestions + “not these” 
        → existing claimQueued / claim API
```

**Human gate:** guest must confirm. Wrong matches uncheckable. Overclaim still blocked by server.

### Storage

| Thing | Where | Retention |
|---|---|---|
| Guest draft | AsyncStorage (device) | Until claimed / discarded / TTL (e.g. 36h) |
| Optional cloud draft | Only if needed for web→app handoff | Ephemeral id + TTL; **no account** |
| Menu images | Upload for parse then delete, or never persist | Prefer delete after extract |
| Receipt | Existing Postgres jsonb | Tab lifetime |

Prefer **on-device only** for v1. Cloud draft only if “typed on phone A, claim link on phone B” becomes a real friend-test pain.

---

## Behind-the-scenes AI / storage (honest)

| Job | AI? | Store? |
|---|---|---|
| Menu → candidate dishes | Vision LLM | Transient |
| Voice → transcript → lines | ASR + LLM | Transient audio / transcript |
| Draft ↔ receipt match | Fuzzy code first; LLM if scores mid | No — compute at open |
| Claim write | No | Existing claims |

AI **does not** replace host vision on the check. AI **does** help guests remember and map words → lines.

---

## Architecture sketch

```
Guest app                          API (existing + small)
────────                           ─────────────────────
draft (local)                      
  venue, lines[]                   
                                   POST /api/menu-parse (optional)
                                     → dish candidates (no receipt id)
open /r/:id ─────────────────────► GET receipt (venue + items)
  reconcile(local draft, receipt)  
  suggest claims                   
  POST /api/receipts/:id/claims    (unchanged)
```

No new “guest order” table required for v1. Optional later: `guest_drafts` with TTL if multi-device.

---

## Sequencing (if we build it)

| Stage | Ship | Depends on |
|---|---|---|
| **0** | Dual home CTA (Host / I ordered) + typed draft + local store | Nothing |
| **1** | Reconcile suggest on claim open (venue + time + fuzzy) | Phase 2 venue on receipt |
| **2** | Voice into same draft | Phase 3 mic/ASR plan |
| **3** | Menu snap → select → draft | Parse budget + rate limits |
| **4** | Optional ephemeral cloud draft / QR join code for cross-device | Proven need |

Do **not** start at menu+voice. Typed + reconcile proves the product loop.

---

## Success metrics (friend test)

- Guest who drafted finds **≥1 correct** suggestion when opening a matching host link.  
- False venue match rate near **zero** (wrong restaurant suggestions).  
- Time-to-first-claim for drafted guests **lower** than blank join.  
- Menu parse: guest selects without needing >1 retry most nights.  
- No increase in overclaim / support “I got charged for…” from bad auto-match.

---

## Risks & open questions

1. **Who is “the guest” without accounts?** Same phone = fine. Different phone = paste link / share draft QR / type name again.  
2. **Host publishes from home later** — GPS at draft ≠ GPS at snap; **venue affirmation** (Phase 2) is the match key, not live GPS.  
3. **Bottle vs glass** — draft says “Pinot”; check is one bottle → suggest glass units after pour confirm, or “1 bottle” if they meant the whole thing (host pour step still owns capacity).  
4. **Cost** — guest menu + voice could dwarf host receipt parses; hard caps per device/day.  
5. **App Store** — mic + camera + location for guests needs crisp purpose strings; dual-entry increases review surface.  
6. **Does this delay friend-test polish?** Yes if built now. Keep as **post–Phase 1/2** unless typed-only Stage 0 is a weekend experiment with a feature flag.

---

## Recommendation

1. **Treat as feasible** under the Phase 3 philosophy: assist + confirm, host check is truth.  
2. **Write it as Stage 0–1** after Phase 2 venue quality is good enough to match nights.  
3. **Reuse** Phase 3 voice pipeline as an input to the same draft, not a separate product.  
4. **Menu snap** only after typed reconcile works — it’s the expensive, error-prone modality.  
5. **Do not** auto-claim or invent a cloud social graph of orders.

When ready to schedule: add Stage 0 to the roadmap in [requirements.md](./requirements.md) §17 and gate behind a feature flag for one friend table.
