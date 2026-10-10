# AI generator prompts (attach labeled artifacts)

Attach the file named in **Reference**, then paste the prompt. Vertical **9:16**. Palette: merlot `#6E2E35`, paper `#F6F4F1`, ink `#2A241C`. No competitor names. Do not redraw the app UI — keep pixels from the reference.

Overlays to add in the editor (not in the model if text comes out wrong): see [`../video-20s.md`](../video-20s.md).

---

## Beat 1 — Card points hook (0–3s)

**Reference:** `stills/S01-table-receipt.jpg` (required). If missing, text-only is OK for this beat only.

**Prompt:**
```
Vertical 9:16 cinematic phone video, 3 seconds. Warm restaurant table at the end of dinner, linen-ish paper tones, long paper receipt in focus, wine glasses soft in background. Subtle handheld feel. Mood: relief after paying, not luxury flex. Color grade warm cream and deep merlot accents. No logos, no readable brand names on cards, no on-screen text. Soft ambient restaurant noise only.
```

**Editor overlay:** `You put the card down for the points.`

---

## Beat 2 — Snap the check (3–7s)

**Reference:** `recordings/R01-snap-parse.mp4` (preferred) or first frame + `stills/S02-capture.png` → `stills/S03-items.jpg`.

**Prompt (with R01):**
```
Use this screen recording as the exact UI. Vertical 9:16. Keep the Split the Wine interface unchanged — same colors, type, and layout. Light natural motion only: stable screen recording feel. No new buttons, no fake OCR overlay, no stock UI kits. Duration ~4 seconds. No burned-in captions.
```

**Prompt (stills only, image→video):**
```
Animate from the capture screen still to the items list still as a clean phone screen recording. Keep UI pixels faithful to the references. Soft crossfade or quick cut, not a morph that warps text. Vertical 9:16, ~4 seconds.
```

**Editor overlay:** `Snap the check.`

---

## Beat 3 — Show the QR (7–11s)

**Reference:** `stills/S04-qr-share.png` (or `.jpg`) and/or `recordings/R02-qr-hold.mp4`.

**Prompt:**
```
Use this Share QR screenshot / recording as the exact frame. Vertical 9:16. Hold the QR code sharp and readable — do not distort, blur, or regenerate the QR pattern. Subtle slow push-in or gentle handheld. Cream paper background, merlot accents only as in the UI. ~3–4 seconds. No extra stickers or arrows.
```

**Editor overlay:** `Show the QR.`

---

## Beat 4 — Friends claim (11–15s)

**Reference:** `recordings/R03-guest-claim.mp4` preferred; else `stills/S05-claim-board.png`.

**Prompt:**
```
Use this guest claim screen recording / still as the exact UI (mobile Safari claim board). Vertical 9:16. Show someone tapping a couple of drink lines; keep typography and layout identical to the reference. Low friction, calm, no celebration confetti. ~4 seconds. No app-store download UI. No burned-in captions.
```

**Editor overlay:** `They claim what they drank.` + `No app for them.`

---

## Beat 5 — Or drop the link (15–18s, optional)

**Reference:** `stills/S06-imessage-link.png` or `recordings/R04-drop-link.mp4`.

**Prompt:**
```
Use this Messages / chat screenshot or recording. Vertical 9:16. Quick beat of a claim link in a group chat. Blur other people’s names if needed; keep the link area clear. Calm, everyday phone feel. ~2–3 seconds.
```

**Editor overlay:** `Or drop the link.`

---

## Beat 6 — End card (18–22s)

**Reference:** `stills/S07-endcard.png` or brand `../brand/og.png`.

**Prompt:**
```
Vertical 9:16 end card. Linen paper background #F6F4F1. Center the Split the Wine bottle mark in merlot #6E2E35. Minimal, quiet, no fintech purple gradients, no glossy 3D. Soft settle animation only. ~3–4 seconds. Leave lower third clear for editor text.
```

**Editor overlay:** `Fair, not equal.` + `Path of least resistance.`  
**CTA (pick one):** TestFlight invite · or `splitthewine.app`

---

## Master negative prompt (append anywhere)

```
no purple gradients, no stock fintech UI, no invented app screens, no distorted QR codes, no competitor names, no “split evenly” hero message, no heavy emoji stickers, no glossy crypto aesthetic
```

---

## Assembly order

1. Gen or drop clips for beats 1→6  
2. Hard cuts in CapCut / iMovie  
3. Burn overlays + VO  
4. Export 9:16 H.264  
