# Split the Wine — theme spec (one file)

Brand identity for **marketing (`www`)** and the product **linen** day theme. Use this for second opinions, video end cards, and AI generators.

Sources (canonical code): [`marketing/index.html`](index.html) · [`src/lib/card-theme/themes.ts`](../src/lib/card-theme/themes.ts) · [`plans/card-design-themes.md`](../plans/card-design-themes.md) · [`marketing/strategy.md`](strategy.md)

---

## Positioning (drives visual choices)

- Built for the table, not the ledger.
- Low-friction utility at the end of dinner — not fintech purple, not social-expense chrome.
- Host puts the card down; guests claim via link/QR without an app.

---

## Core palette (ships everywhere)

| Role | Token | Hex | Use |
|------|--------|-----|-----|
| Canvas | `paper` | `#F6F4F1` | Page / app background |
| Raised surface | `sheet` | `#FFFC8` → `#fffcf8` | Cards, “You owe”, link boxes (app; marketing often uses pure white — see gaps) |
| Body text | `ink` | `#2A241C` | Headlines, primary copy |
| Secondary text | `inkSoft` | `#7A7268` | Supporting lines |
| Tertiary | `muted` | `#8A847C` | Hints, placeholders |
| Hairline | `border` | `#E6E0D8` | Dividers, chips, section rules |
| Sticky chrome | `chrome` | `#EDE8E1` | Interview / tab footers (app) |
| Chrome edge | `chromeBorder` | `#D4CDC3` | Footer top border (app) |
| Brand / CTA | `merlot` | `#6E2E35` | Buttons, mark fill, kickers |
| On merlot | `merlotFg` | `#FBF8F5` | Text/icons on CTAs (app; marketing often uses `paper`) |
| Claimed / select | `select` | `#2F5D50` | Selected claim lines (bottle green — **not** CTA) |
| Select wash | `selectWash` | `rgba(47, 93, 80, 0.14)` | Selected row tint |
| Danger | `danger` | `#A33B32` | Errors, destructive |
| Kind · drink | `kindDrink` | `#9C1F3D` | Drink chip |
| Kind · food | `kindFood` | `#C9892A` | Food chip |
| Watermark | `wash` | `rgba(110, 46, 53, 0.05)` | Jagged split wash (~3–5%) |
| Grain | `grain` | `0.035` | Paper tooth opacity (2–4% cap) |

**Marketing site Tailwind subset** (what `index.html` declares today):

```
merlot   #6E2E35
paper    #F6F4F1
ink      #2A241C
inkSoft  #7A7268
muted    #8A847C
border   #E6E0D8   (hardcoded, not always a token)
```

---

## Dusk variant (app only — not www)

**`candlelight`** after local 19:00 until 06:00. Same identity, warmer/dimmer. No picker; clock only.

| Token | linen | candlelight |
|-------|-------|-------------|
| paper | `#F6F4F1` | `#EFE7DC` |
| sheet | `#FFFC8` | `#F8F2E8` |
| ink | `#2A241C` | `#241C14` |
| inkSoft | `#7A7268` | `#6E6253` |
| muted | `#8A847C` | `#857A6A` |
| border | `#E6E0D8` | `#DCD0BE` |
| chrome | `#EDE8E1` | `#E5DACB` |
| chromeBorder | `#D4CDC3` | `#CDBFA9` |
| merlot | `#6E2E35` | `#7A2630` |
| merlotFg | `#FBF8F5` | `#FBF5EC` |
| select / danger / kinds | unchanged | unchanged (meaning stays) |
| wash | merlot ~5% | amber-tinted ~9% |
| grain | `0.035` | `0.05` |

**Marketing stays linen always** — public site should not flip at dusk.

Deferred / cut (not shipping): `cellar` (dark), `patio` (green CTA — conflicts with select).

---

## Typography

| Surface | Spec |
|---------|------|
| Marketing | System UI stack only: `-apple-system`, BlinkMacSystemFont, `Segoe UI`, Roboto, Helvetica Neue, Arial, sans-serif |
| Headlines | Bold / semibold, `tracking-tight` |
| Kickers | ~12px, bold, uppercase, letter-spacing ~0.08em, merlot |
| Body | ~15–16px, ink / inkSoft |
| App interview titles | ~28–30px sparse / ~22 dense (native `type.title`) |

No custom webfont on marketing today. Product UI also leans system/native defaults.

---

## Mark & motifs

**Wine mark:** filled merlot bottle, four jagged horizontal splits, rotated about **−15° to −18°**. Primary brand illustration.

**Motif kit** (stroke, `currentColor`, atmosphere — not lucide affordances): split-bottle, stem, pour, check-stub, coupe-pair, carafe, cork, label-band, grapes (use sparingly), perforation, split-wash, paper-grain.

**Rules:** motifs inherit color; don’t invent a second brand accent for decoration; payment tiles keep official Venmo / Cash App / PayPal colors in every theme.

---

## Shape, type scale on site, motion

| Element | Spec |
|---------|------|
| Primary CTA | `rounded-full`, `bg-merlot`, text paper/merlotFg, ~15px bold, generous px/py |
| Cards / panels | `rounded-2xl` common; phone frame ~`2rem` |
| Borders | `#E6E0D8` hairlines |
| Phone frame shadow | soft ink: `0 18px 40px -18px rgba(42, 36, 28, 0.35)` |
| Entrance | fade-up ~0.8s, ease `cubic-bezier(0.16, 1, 0.3, 1)` |
| Receipt float | slow 6s ease-in-out |
| Wine mark hover | segments translate/rotate apart |
| Privacy band | full merlot field, light text, glass cards `white/10` |
| Selection | `selection:bg-merlot selection:text-white` |

---

## What marketing uses vs full linen

| Token | Marketing www | App linen |
|-------|---------------|-----------|
| paper / ink / inkSoft / muted / merlot / border | Yes | Yes |
| sheet / chrome / select / kind* / wash / grain | Mostly no (white bands instead of sheet) | Yes |
| candlelight | No | Yes (clock) |

---

## Messaging that matches the look

| Say | Don’t say |
|-----|-----------|
| Card points / put the card down | Miles-hacking jargon |
| Path of least resistance / low friction | “Disruptive expense platform” |
| Fair, not equal | Equal split as the hero |
| Show the QR / drop the link | “Onboard your party” |
| No guest app · no host subscription | Naming competitors on camera |

---

## Second opinion (design read)

**Keep:** Merlot + warm paper + brown ink = dinner-check, not SaaS. Matching marketing to linen is correct. Bottle mark + jagged split is a real signature.

**Watch:**
1. System-only type puts almost all identity on color + mark — a display face on marketing headlines would help differentiation.
2. Cream + wine is a busy lifestyle lane; stay merlot (not orange terracotta) and let photography / mark carry uniqueness.
3. Marketing `bg-white` sections read colder than app `sheet` `#fffcf8` — aligning those would tighten continuity.
4. Don’t put candlelight on www.

**Practical sharpen:** keep palette; optional one display font for marketing H1s; warm white sections toward sheet; leave merlot pill CTAs.

---

## Quick copy-paste (generators / Figma)

```
paper     #F6F4F1
sheet     #FFFC8
ink       #2A241C
inkSoft   #7A7268
muted     #8A847C
border    #E6E0D8
merlot    #6E2E35
merlotFg  #FBF8F5
select    #2F5D50
```

Negative vibes to avoid: purple gradients, cold fintech blue UI, glossy crypto, inventing a green brand CTA, dark-mode marketing.
