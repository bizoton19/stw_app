# Split the Wine — theme spec (one file)

Brand system for **marketing (`www`)**, **Expo mobile**, and **web claim UI**.

**Status:** v2 refinements adopted for Phase 1 (contrast + sheet accuracy). Brand mark and route names unchanged.

Sources:
- Marketing: [`index.html`](index.html)
- Mobile: [`apps/mobile/src/lib/card-theme/themes.ts`](../apps/mobile/src/lib/card-theme/themes.ts) · [`theme.ts`](../apps/mobile/src/lib/theme.ts) · [`dusk.ts`](../apps/mobile/src/lib/card-theme/dusk.ts)
- Web (parity-tested against mobile): [`src/lib/card-theme/themes.ts`](../src/lib/card-theme/themes.ts) · [`src/app/globals.css`](../src/app/globals.css)
- Plan: [`plans/card-design-themes.md`](../plans/card-design-themes.md)

---

## Design intent

Built for the table, not the ledger. Warm paper, brown-black ink, merlot CTAs, quiet bottle-green selection, small hand-drawn motifs. Not fintech purple, SaaS blue, glossy crypto, or dark-mode-first.

**Fixed:**
- Merlot is the only decorative brand accent; green = claimed/selected, never the primary CTA
- Filled merlot bottle + jagged split = signature mark
- Payment tiles keep official Venmo / Cash App / PayPal colors
- Marketing is always `linen`; product may resolve to `candlelight`
- No theme picker; no Three.js on native v1

---

## Color tokens (canonical)

Sizes below for spacing/type are **logical points / dp** on native and CSS px equivalents on web — not physical device pixels.

| Role | Token | Value | Rules |
|------|--------|------:|-------|
| Page canvas | `paper` | `#F6F4F1` | Default linen background |
| Raised surface | `sheet` | `#FFFCF8` | Cards, claim sheets; prefer over pure `#FFFFFF` for product-feeling surfaces |
| Primary text | `ink` | `#2A241C` | Headlines, amounts |
| Secondary text | `inkSoft` | `#6E6253` | Supporting body; **shared across linen + candlelight** (AA) |
| Tertiary text | `muted` | `#71675D` | Captions, placeholders; **shared across variants** |
| Hairline | `border` | `#E6E0D8` | Dividers; not alone for focus/selection |
| Sticky chrome | `chrome` | `#EDE8E1` | Interview footer, host tab bar |
| Chrome edge | `chromeBorder` | `#D4CDC3` | Footer top edge |
| Brand / CTA | `merlot` | `#6E2E35` | Primary button, logo, kickers |
| On merlot | `merlotFg` | `#FBF8F5` | Foreground on merlot only |
| Selection | `select` | `#2F5D50` | Claimed rows — never CTA |
| Selection wash | `selectWash` | `rgba(47, 93, 80, 0.14)` | Background wash |
| Danger | `danger` | `#A33B32` | Errors + label/icon, not color alone |
| Drink kind | `kindDrink` | `#9C1F3D` | On pale `kindDrinkWash` |
| Food kind | `kindFood` | `#C9892A` | Accent/fill; not small text on paper |
| Brand wash | `wash` | `rgba(110, 46, 53, 0.05)` | Decorative only |
| Grain | `grain` | `0.035` | ≤ 0.05 |

### Candlelight (product only, local 19:00–05:59)

| Token | linen | candlelight |
|-------|-------|-------------|
| paper | `#F6F4F1` | `#EFE7DC` |
| sheet | `#FFFCF8` | `#F8F2E8` |
| ink | `#2A241C` | `#241C14` |
| inkSoft | `#6E6253` | `#6E6253` |
| muted | `#71675D` | `#71675D` |
| border | `#E6E0D8` | `#DCD0BE` |
| chrome | `#EDE8E1` | `#E5DACB` |
| chromeBorder | `#D4CDC3` | `#CDBFA9` |
| merlot | `#6E2E35` | `#7A2630` |
| merlotFg | `#FBF8F5` | `#FBF5EC` |
| select / danger / kinds | unchanged | unchanged |
| wash | merlot ~5% | amber wash ~9% |
| grain | `0.035` | `0.05` |

Marketing/www never switches to candlelight.

### Contrast (WCAG AA baseline)

| Pairing | Target |
|---------|--------|
| Ordinary text | ≥ 4.5:1 |
| Large text | ≥ 3:1 |
| `ink` on `paper` | Pass (~14:1) |
| `inkSoft` / `muted` on `paper` | Pass after v2 darken |
| `merlotFg` on `merlot` | Pass |
| `kindFood` on `paper` | Do **not** use as small text |

### Kind chips

- Drink: `kindDrink` on pale `kindDrinkWash`
- Food: `ink` on pale `kindFoodWash`; `kindFood` for icon/border
- Never communicate kind by color alone — keep word/icon label

---

## Mobile (Expo)

| Mechanism | Behavior |
|-----------|----------|
| `colors` from `@/lib/theme` | Legacy alias = **`cardThemes.linen` only**. Module-scope `StyleSheet.create` cannot follow the clock. |
| `useCardTheme()` | Runtime palette: linen by day, candlelight after 19:00 local. Re-check on `AppState` → `active` only — **no mid-session switch while foregrounded** (intentional). |
| New components | `createStyles(theme)` from `useCardTheme()` at render time |

### Spacing (`space`) — logical units

| Token | Value |
|-------|------:|
| hairline | 1 (`StyleSheet.hairlineWidth` when appropriate) |
| xs | 4 |
| sm | 8 |
| md | 12 |
| lg | 16 |
| xl | 20 |
| xxl | 24 |
| section *(new use)* | 32 |
| screenGutter *(new use)* | 20 |

### Type (`type`) — logical units

| Token | Size | Use |
|-------|-----:|-----|
| step / small | 12 | Progress, non-essential captions |
| kicker | 13 | Uppercase section label |
| body | 15 today; **16** default for new body copy |
| button | 15–16 | CTA |
| titleDense | 22 | Dense interview title |
| title | 28 | Default interview H1 |
| titleSparse | 30 | Sparse chrome title |

Preserve Dynamic Type / font scaling. Do not globally disable `allowFontScaling`.

### Radius

| Token | Value | Use |
|-------|------:|-----|
| radiusChip | 999 | Pills / primary CTA |
| radiusCard | 16 | Cards / panels |
| radiusPhone | 32 | Marketing phone frame only |

---

## Mark & motifs

Filled merlot bottle, four jagged splits, rotated **−15° to −18°**.

Kit: `split-bottle`, `stem`, `pour`, `check-stub`, `coupe-pair`, `carafe`, `cork`, `label-band`, `grapes` (spare), `perforation`, `split-wash`, `paper-grain`.

Motifs inherit `currentColor`. Decorative = hide from screen readers. Grain never behind essential amounts.

---

## Motion

- Entrance ~0.8s, ease `(0.16, 1, 0.3, 1)` on web
- Receipt float 6s — marketing/decorative only
- Wine-mark split on hover (web); native = press feedback only if it doesn’t fight the control
- Respect reduced motion: kill perpetual float; shorten entrances

---

## Marketing vs product

| Behavior | www | Mobile + web claim |
|----------|-----|---------------------|
| Linen | Always | Day default |
| Candlelight | Never | After 19:00 local |
| Sheet vs white | Prefer `#FFFCF8` for product-feeling bands | `sheet` |
| Font | System; optional licensed H1 display | System/native |
| CTA | Merlot pill | Merlot pill |

---

## Messaging

| Say | Don’t |
|-----|-------|
| Card points / put the card down | Miles-hacking jargon |
| Path of least resistance | “Disruptive expense platform” |
| Fair, not equal | Equal split as the hero |
| Show the QR / drop the link | “Onboard your party” |
| No guest app · no host subscription | Naming competitors on camera |

---

## v2 backlog (not Phase 1)

| Phase | Work |
|------:|------|
| 2 | Single JSON/source → generate mobile + web themes; CI parity |
| 3 | Migrate high-visibility screens to `useCardTheme` + `createStyles` |
| 4 | Explicit pressed/disabled/focus tokens; a11y + reduced-motion audit |
| 5 | Marketing sheet continuity; visual regression for both variants |

Deferred: semantic aliases (`surfacePage`…), mid-session clock freeze, mass StyleSheet rewrite.

---

## Quick copy-paste

```
paper        #F6F4F1
sheet        #FFFCF8
ink          #2A241C
inkSoft      #6E6253
muted        #71675D
border       #E6E0D8
chrome       #EDE8E1
chromeBorder #D4CDC3
merlot       #6E2E35
merlotFg     #FBF8F5
select       #2F5D50
selectWash   rgba(47, 93, 80, 0.14)
danger       #A33B32
kindDrink    #9C1F3D
kindFood     #C9892A
grain        0.035
```

**Avoid:** purple gradients, cold fintech blue, glossy crypto, green brand CTA, dark-mode marketing, high-opacity grain, color-only state.
