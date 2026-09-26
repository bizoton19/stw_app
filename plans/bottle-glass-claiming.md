# Bottle ↔ glass claiming (wine packages)

**Status:** design plan — not building yet  
**Goal:** Let a table share a bottle (or champagne / wine package) fairly by **bottle or by glass**, without breaking the live claim board, money math, or the “one job per screen” feel.  
**Related:** [requirements.md](./requirements.md) (whole-number claims, tax/tip follow items), money `unitCentsArray` / remaining.

---

## The problem

Vision often sees one line:

> `BQ Wine Package · qty 1 · $420`

In the room that may mean **1 bottle ≈ 6 glasses**, and three friends each want **2 glasses**. Today we only claim **whole package units** (qty on the check). Claiming “1 package” dumps the whole bottle on one person — wrong socially and financially.

We need:

1. **Recognize** bottle-like lines (package / bottle / magnum / champagne).
2. **Decide** claim grain: bottle vs glass (host-guided, not silent auto-magic).
3. **Expose** claim UX: “2 glasses” or “1 bottle” with live remaining that still feels instant.
4. **Keep money exact** (cents, fees proportional to claimed dollars).

---

## Recommendation: hybrid, host-confirmed (not fully auto)

| Approach | Verdict |
|---|---|
| **Fully auto** expand every wine to glasses | Too risky — beer flights, sake carafes, “package” of food, 750ml vs pour size vary by venue. Silent wrong splits destroy trust. |
| **Never split** (status quo) | Safe but fails the product’s own namesake. |
| **Hybrid** — detect → propose → host confirms once → claimers use the chosen grain | **Ship this.** Feels smart; host stays in control; claim board stays simple. |

**Principle:** AI / heuristics **suggest**; the **host seals** the pour size once before share. Claimers never negotiate ontology mid-claim.

---

## Recognition stack (layered)

Run in order; stop when confident enough to ask the host.

### 1. Vision signal (cheap, already in parse)

Extend parse schema with optional:

```ts
pour?: {
  candidate: boolean;          // model thinks bottle/package
  suggestGlasses?: number;     // e.g. 6
  confidence: "high" | "med" | "low";
  rationale?: string;          // short, for host UI only
}
```

Prompt cues: “bottle”, “btl”, “magnum”, “package”, “pkg”, “champagne”, “prosecco”, “750ml”, “1.5L”, wine varietals + high line total.

### 2. Curated mapping table (deterministic)

`pour_profiles` (code or small JSON, versioned):

| Pattern / kind | Default glasses | Notes |
|---|---|---|
| `bottle` / `btl` / `750` | 6 | Standard wine pour heuristic |
| `magnum` / `1.5` | 12 | |
| `champagne` / `sparkling` bottle | 6 | Same default; host can change |
| `package` + wine-like name | 6 | Only if kind=drink |
| `carafe` / `pitcher` | null | Ask host — don’t assume |
| beer / cocktail / “glass of …” | null | Already glass-grain; skip |

Regex + `kind === "drink"` first; curated beats vague vision.

### 3. Venue / history (later)

If the same Places venue repeatedly confirmed “6 glasses / bottle”, bias the suggestion. Phase 2+; not required for v1.

### 4. What we never invent

- Don’t invent glasses for **food** packages.
- Don’t invent if qty already looks like glasses (`qty ≥ 4` and name says “glass”).
- Don’t change a line after **any claim** exists on it (freeze pour config).

---

## Data model (claim grain)

Keep the check’s printed line as the **source of truth for money**; add a **claim unit** overlay:

```ts
type ItemPour = {
  /** printed check units stay in item.qty / item.totalCents */
  mode: "as_printed" | "glasses";
  glassesPerPrintedUnit: number; // e.g. 6
  /** claim inventory = qty * glassesPerPrintedUnit when mode=glasses */
};
```

**Money:**  
`claimCents = sum(unitCentsArray(totalCents, claimCapacity).slice(...))`  
where `claimCapacity = qty * glassesPerPrintedUnit` in glasses mode.  
Same penny-fair splitter we already use — just finer slices.

**Remaining:** track in **claim units** (glasses or bottles), not a second currency.

**API claims:** still `{ itemId, units }` where `units` means **claim units** for that line. Clients and host UI label them “glasses” or “bottles”.

---

## Host flow (awe sequence)

After items review, **only if** ≥1 pour candidate:

1. **One screen:** “How should people claim these?”
2. Card per candidate:
   - Name + printed price  
   - Suggested: **“6 glasses in this bottle”** (editable 2–24 stepper)  
   - Choices: **Keep as 1 bottle** · **Split into glasses**
3. Soft copy: “Friends can take a glass each — tax still follows what they claim.”
4. Confirm → store `ItemPour` → continue to fees / pay / share.

If host skips or picks “bottle”: claim board unchanged for that line.  
If glasses: board shows e.g. `BQ Wine · $70.00 × 6 glasses · $420 bottle`.

**No mid-party reconfiguration** after the first claim (SSE would thrash). Host can only change pour before claim opens, or after reopen + clear claims (rare; show warning).

---

## Claimer flow (smooth + delightful)

### Pick board
- Bottle mode: same as today (`1 left`).
- Glass mode: trailing **“N glasses left”**; secondary “from 1 bottle”.
- Multi-select still works; qty step asks **glasses**.

### Qty step copy
- “How many glasses?” (not “how many of each?”) for pour lines.
- Max = remaining glasses; show unit $ ≈ bottle/6.

### Live board / settle
- History: `2× BQ Wine (glass)`.
- Host leftover: glasses remaining, not “0.33 bottle”.

### Optional delight (later)
- Soft haptic + “2 of 6 poured” microcopy when glasses drop — don’t retheme the whole board.

---

## Edge cases

| Case | Behavior |
|---|---|
| 2 bottles printed (`qty: 2`) | Capacity = `2 × 6` glasses; or host can claim by bottle (mode=as_printed). |
| Someone wants whole bottle in glass mode | Claim 6 glasses in one go (or “Whole bottle” shortcut = 6). |
| Odd pour (5 oz house pour → 5 glasses) | Host edits glasses-per-bottle on confirm screen. |
| Package is tasting flight already by glass | Mapping table + host “Keep as printed”. |
| Race on last glasses | Same `not_enough_remaining` + claimed-by copy. |
| Fees | Unchanged: proportional to **claimed item cents**. |

---

## Implementation phases

### Phase A — Host confirm + glass inventory (MVP)
- Mapping table + light name heuristics (no new vision fields required).
- `ItemPour` on item; host confirm step when candidates found.
- Claim board / qty / totals / remaining in claim units.
- Tests: 1 bottle → 6 glasses, 2 claimers × 3, fees exact.

### Phase B — Vision assist
- Parse `pour` suggestion; pre-fill host stepper; log accept/reject for eval.

### Phase C — Polish
- “Whole bottle” shortcut; venue memory; champagne defaults; i18n pour words.

---

## Why this keeps the tab smooth

1. **One decision, once** — host sets grain before the link goes out.  
2. **Claim UX stays integer steppers** — no fractions, no “0.17 bottle”.  
3. **Money path unchanged** — finer `unitCentsArray`, same fee math.  
4. **SSE stays simple** — remaining is still an int per item.  
5. **Trust** — hybrid beats silent AI; users feel the product “gets wine” without guessing wrong.

---

## Open product choices (decide at build time)

1. Default glasses = **5 or 6**? (Recommend **6**, editable.)  
2. Show glass mode on **guest join** as a one-line tip? (“Glasses available on wine.”)  
3. Allow **mixed**: some bottles split, some not — yes (per-line).

---

## Done when

- Host can turn a wine package into N claimable glasses in under 10 seconds.  
- Claimers take glasses; live remaining and settle dollars match the bottle total to the penny.  
- No claim exists that requires understanding “fractional bottles.”
