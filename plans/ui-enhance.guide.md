# UI enhance guide — Split the Wine

**Status:** design contract for the next visual pass  
**Scope:** guest claim board + settle (web + native), then host interview chrome  
**Authority:** does not override [requirements.md](./requirements.md) §0; it sharpens it.

Built for the table, not the ledger. The product should feel like a **quiet check folder on linen paper** — not a fintech dashboard, not a social feed, not a marketing site stuffed into a phone.

---

## 1. What’s wrong today (honest audit)

From live `/r/[id]` review (web prototype + native parity target):

| Symptom | Why it hurts |
|---|---|
| **Sparse “empty room”** | Title + kicker float above a huge gap; the sticky CTA eats the first viewport before lines feel tangible. |
| **Hairlines without rhythm** | Every row looks the same weight; selection barely sings; “8 left” competes with the drink name. |
| **Generic chrome** | WineMark + wordmark + “Live” read as a template header, not a claim ritual. |
| **Desktop gutter stare** | Wide viewports show a thin phone column on flat canvas — correct constraint, but the *outside* feels abandoned, not intentional. |
| **Settle used to shout “message apps”** | Texts / WhatsApp / Copy belonged to a host-nudge stub; guests need **pay methods**, not SMS theater (fixed in product; keep visual weight on You owe). |
| **Motion is shy** | Step slides exist; claim ticks and selection don’t celebrate enough to feel “live at the table.” |
| **Hydration / shell noise** | Dev “1 Issue” and shell flicker break the spell — fix `PhoneShell` SSR/client parity before polishing paint. |

Enhance density and hierarchy **without** adding a second accent color, cards-for-cards’-sake, or purple/gradient AI defaults.

---

## 2. North star

**One composition, one job, one accent.**

Someone standing at Josephine with sticky fingers should, in under two seconds, know:

1. Whose check this is (venue / kicker)  
2. What to do next (claim what you had)  
3. What still exists (remaining)  
4. Where their thumb goes (sticky merlot)

If you remove the nav wordmark and the screen could belong to Splitwise or Venmo, the branding is too weak *or* the chrome is too loud. Aim for **quiet brand, loud clarity**.

### Emotional tone

| Do | Don’t |
|---|---|
| Warm paper, night-out merlot | Cold fintech blue / purple gradient |
| Editorial restraint (check / wine list) | Dashboard tiles, KPI strips |
| Confident progress hairline | Rainbow steppers, badge piles |
| Live = soft pulse of presence | Aggressive “ONLINE” chrome |

---

## 3. Tokens (keep; refine usage)

Canonical mobile tokens live in `apps/mobile/src/lib/theme.ts`. Web mirrors via CSS variables in `src/app/globals.css`.

```
paper     #F6F4F1     canvas
ink       #2A241C     titles, selected names
inkSoft   #7A7268     kickers, secondary
muted     #8A847C     meta, hints
border    #E6E0D8     hairlines only
merlot    #6E2E35     primary CTA, progress fill, “your” remaining, Live
merlotFg  #FBF8F5     on-merlot text
danger    #A33B32     errors only
```

**Usage law (stricter than before):**

- Merlot appears in **at most three roles per screen**: sticky CTA, progress fill, and *one* of { Live meta | remaining on the row you’re touching | selected check }.
- Do **not** tint whole cards merlot. Do **not** invent a second brand color for food vs drink — use glyph weight / line-kind icon, not a new hue.
- Dark mode (if ever): deeper paper, same merlot — never a new palette ([requirements §11](./requirements.md)).

### Typography

Current stack is system / Geist — acceptable for v0 speed, weak for memory.

**Enhance direction (ship when ready, both clients):**

| Role | Direction | Notes |
|---|---|---|
| Display / titles | A slightly condensed or soft-serif display with night-out character | Avoid Inter / Roboto / Arial as *display*. One expressive face only. |
| Body / amounts | Clean grotesque with excellent tabular figures | Money and “N left” must be `tabular-nums`. |
| Kickers / step | Small caps or tracked uppercase at 11–13px | “2 of 3”, “The Bar”, “Everyone’s share”. |

Title scale (claim): **~26–28px** semibold, tracking tight (−0.02em). Lead under title: **15px / 22** muted — one sentence max.

### Spacing rhythm

Use the existing `space` scale; prefer **8 / 12 / 16 / 24**.  
First viewport budget for claim pick:

1. Chrome (mark + progress) ~72–88px  
2. Kicker + title + one lead ~100px  
3. **List starts immediately** — no ornamental void  
4. Sticky footer reserved (~88px including safe area)

If the list doesn’t start above the fold on a 667–844pt phone, the layout failed.

---

## 4. Surfaces & atmosphere

Requirements forbid decorative color blocks. Atmosphere still allowed if **quiet**:

- **Paper grain (optional, 2–4% opacity)** on canvas — SVG noise or CSS, never busy. Native: subtle or skip.
- **Outer desktop frame:** outside the 430px column, use the same paper (not gray void). Optional 1px `--border` edge on the column only (`PhoneShell` already does a hairline on `md`).
- **Selected row:** paper stays paper; selection = merlot check disc + ink weight + remaining turns merlot. No filled pink rows.
- **You owe card (settle):** the *one* place a soft wash (`#FBFAF8` or paper + 4% ink) is allowed — because it’s the money moment. Still hairline border, no shadow stack.

No multi-layer drop shadows. No glow. No rounded-full pills except the primary CTA and small Live/meta chips if needed.

---

## 5. Claim board — enhancement recipe

File targets: `src/components/claim-board.tsx`, `apps/mobile/src/app/r/[id]/index.tsx` (+ qty).

### 5.1 Hierarchy

```
[ WineMark  Split the Wine                    Live ]
[ ‹     2 of 3  ────────●───────                 ]
The Bar
What did you have?
Claiming as Alex · tap everything that’s yours

☐  Josephine Old Fashioned          8 left
   $120.00 for 8
☐  Monkey 47                        2 left
   …
```

- Venue kicker above title (already).  
- Lead names the guest (“Claiming as …”) — identity before inventory.  
- Row primary = **drink name**; secondary = price · qty; trailing = **remaining** (tabular).  
- Checkbox / disc: 44×44 hit target; selected fills merlot with cream check.

### 5.2 Density

- Row vertical padding ~12–14px (not 20+).  
- Gone / claimed-out section collapses under a quiet “Already claimed” hairline — don’t delete; de-emphasize (muted name, no checkbox).  
- Dispute list (“who claimed”) stays below the fold or behind a short disclosure — don’t compete with picking.

### 5.3 Live feeling

- When SSE updates remaining, **tick the number** (crossfade or count) — don’t restyle the whole row.  
- Soft “Live” in merlot; if reconnecting, inkSoft + no alarm red.  
- Optimistic select: immediate check; failure rolls back with a one-line error above the list (danger text only).

### 5.4 Sticky CTA

- Disabled: muted label (“Pick what you had”) on quiet fill — still full width, still 48px.  
- Enabled: merlot, cream label, press scale 0.98.  
- Secondary “Running totals” is a **text button**, not a second filled CTA.

### 5.5 Qty step

- Same chrome. One stepper per queued line.  
- Show running subtotal for *your* queue under the title (“3 drinks · ~$42 before tax”).  
- Primary: “Claim N items” with live N.

---

## 6. Settle — enhancement recipe

Files: `src/components/settle-view.tsx`, `apps/mobile/src/app/r/[id]/settle.tsx`.

### 6.1 Story order

1. Tab totals (items / fees / grand) — compact, hairline frame  
2. **You owe** — amount hero (28–32px tabular)  
3. Pay copy + **payment method list** (icons)  
4. Everyone’s share — roster, no message actions  

### 6.2 Payment rows

| Method | Treatment |
|---|---|
| Venmo / Cash App / PayPal | Full-width row: icon · label · handle · “Pay” — merlot text CTA; tap opens app (same as `openHostPay`) |
| Zelle / MonCash / Natcash / Other | Same row chrome but **no Pay**; handle is the content (email/phone). Optional long-press / tap-to-copy later — not SMS buttons |

Icons: official tiles on native; brand-color mark tiles on web (`PayMethodIcon`). Size ~48. Corner radius ~28% of size.

### 6.3 What not to bring back

- Texts / WhatsApp / Copy on people’s shares  
- Pre-filled “Hey {name}, your share is…” paragraphs under every person  
- Multiple competing primary buttons

---

## 7. Host interview — light pass (after claim)

Keep TurboTax one-question flow. Enhancements:

- Sparse mode when a place is pinned (map fills) — already directionally right; ensure map and address are **immediate** after parse (product requirement).  
- Progress hairline + merlot fill only — never a thick bar.  
- Footer hint one line; primary always reserved.  
- Same paper / type / CTA as guest so host→guest feels like one product.

---

## 8. Motion (2–3 intentional moments)

Honor `prefers-reduced-motion`.

1. **Step enter** — slide with direction (already). Keep 220–280ms, ease-out.  
2. **Select check** — scale 0.92 → 1 on the disc; remaining color crossfade to merlot.  
3. **Remaining tick** — when another guest claims, the number eases; optional 120ms highlight on that row only.

No confetti. No parallax. No scroll-jacking.

---

## 9. Web ↔ native parity

| Surface | Must match |
|---|---|
| Tokens | Same hex values |
| Claim pick / qty / settle structure | Same copy, same order, same CTA labels |
| Pay deep links | Same URL builders; native `Linking`, web `location` / https fallback |
| Phone width | 430px composition; native is the design target |

Web is a **delivery channel** for guests without the app ([requirements §10](./requirements.md), [dns-todos.md](./dns-todos.md) → `api.splitthewine.app`). It must not become a second visual language.

---

## 10. Anti-patterns (hard no)

- Purple-on-white or purple→indigo gradients  
- Second accent (ice blue, neon green, gold)  
- Card grids, stat strips, “this week” marketing blocks on claim  
- Floating badges / stickers on the claim list  
- Inter-only branding with no display character (once fonts land)  
- Dark mode as a different product  
- Autogenerated illustration clutter  
- Making guests install before they can claim

---

## 11. Implementation checklist (next visual PR)

**P0 — claim page feels intentional**

- [x] Fix `PhoneShell` hydration (no SSR/client text mismatch)  
- [x] Kill empty first-viewport gap; list starts under lead  
- [x] Tighten row padding + remaining typography (tabular, merlot when selected)  
- [x] Disabled vs enabled sticky CTA contrast  
- [x] Outer canvas = paper on large screens  

**P1 — settle polish**

- [ ] You owe hero + pay intro copy hierarchy  
- [ ] Payment rows match native icon sizing / tap targets (44px+)  
- [ ] Everyone’s share quiet roster only  

**P2 — character**

- [ ] Distinctive display font wired in web + Expo  
- [ ] Optional paper grain  
- [ ] Remaining-count tick on live updates  
- [ ] Align web claim board spacing with native after native pass  

**Done when:** a screenshot of `/r/{id}` on a phone, with marketing chrome cropped off, is still recognizably Split the Wine — and a guest can claim in one thumb-zone without scrolling past void.

---

## 12. Reference files

| Concern | Where |
|---|---|
| Design law | [requirements.md](./requirements.md) §0, §11 |
| Mobile tokens | `apps/mobile/src/lib/theme.ts` |
| Web tokens | `src/app/globals.css` |
| Claim web | `src/components/claim-board.tsx` |
| Claim native | `apps/mobile/src/app/r/[id]/` |
| Settle | `src/components/settle-view.tsx`, mobile `settle.tsx` |
| Pay links | `src/lib/pay.ts`, `apps/mobile/src/lib/pay.ts` |
| Positioning | [marketing/strategy.md](../marketing/strategy.md) |

---

*Enhance the theme; don’t reinvent it. Paper, ink, merlot — denser, clearer, alive at the table.*
