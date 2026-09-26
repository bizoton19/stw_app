# Expected party size (claimant headcount hint)

Status: **product plan — not scheduled.** Optional host signal only.  
Related: live board / close claiming in [requirements.md](./requirements.md); guest-first reconcile is separate ([guest-first-reconcile.md](./guest-first-reconcile.md)).

---

## Idea

Host optionally enters **how many people are claiming** (approximate headcount at the table). The live board then shows progress like **“3 of ~5 claimed”** and, before close, can warn **“~2 may still be out.”**

Not a census. Not required to publish. Never auto-assigns leftovers from this number.

---

## Why it helps

| Moment | Without | With optional size |
|---|---|---|
| Live board | Host guesses who’s missing | Soft “expecting ~5” |
| Before close | Easy to close too early | “2 may still be out — close anyway?” |
| After close | Leftovers dump on host silently | Same math; clearer *social* cue beforehand |

Does **not** fix: one phone for two people, couples under one name, no-shows, or late leavers.

---

## UX

### Capture (host)

- Placement: late interview — **after pay confirm / on share**, or a one-line on live board “Set expected guests.”
- Control: stepper `2…20` (or “Just me”) + **Skip**.
- Copy: “About how many people will claim? (optional)”
- Editable later on host settle / live board.

### Display (host live board / settle)

- If set: `Claimed 3 · expecting ~5` (unique `personName`s with ≥1 claim, or distinct join identities — pick one rule and stick to it).
- If unset: hide entirely (no “of ?”).
- Guests: **do not** show expected headcount (avoids pressure / gaming).

### Close claiming

- If `claimedPeople < expected` and expected was set: confirm sheet  
  “Looks like ~N people haven’t claimed yet. Close and take leftovers?”
- Host can still close in one tap after confirm.

---

## Counting rule (v1)

**Claimed people** = distinct guest identities who have at least one claim on this receipt  
(prefer stable guest session / saved name+contact for that receipt; fallback = distinct `personName` on claims).

Do **not** count:

- Host unless they also claimed under a guest identity  
- Soft-deleted / unclaimed-only joins with zero claims (optional: show “joined but empty” later)

`remainingHint = max(0, expectedPartySize - claimedPeople)`.

---

## Data model

On receipt (jsonb body), optional:

```ts
expectedPartySize?: number | null; // integer 1–20, omit/null = unset
```

- Set via existing `PUT /api/receipts/:id` (host token) or a tiny `PATCH` field on save/publish.
- Public GET may include it for host UI; **guests can ignore** (or omit from public payload if we want zero leakage — prefer omit from guest-facing DTO later; v1 can leave in body and only render for `isHost`).

No new table. Lives and dies with the tab.

---

## Non-goals

- Requiring party size to publish  
- Matching names to seats  
- Pushing “you’re the missing one” to unknown phones  
- Using size for fee math (fees stay claim-proportional)  
- Browser extension or desktop-only flow  

---

## Sequencing

| Stage | Ship |
|---|---|
| **0** | Field on share + persist + host-only “3 of ~5” on settle |
| **1** | Close-claiming confirm when under expected |
| **2** | Edit size from live board; telemetry: did hosts who set size close later / with fewer leftovers? |

Friend-test: skip until you’ve watched a few closes without it. Add when hosts say “I didn’t know who was left.”

---

## Success signal

Hosts who set a size close with fewer “oops reopen” moments; no spike in support “the app said I was missing.” Guests never feel counted/shamed.
