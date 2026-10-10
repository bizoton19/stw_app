# Split the Wine — ~22s end-of-dinner demo

Vertical **9:16** Reels / TikTok / iMessage. Audience: the person who puts the card down (hosts + friend-testers).

**One line:** You put the card down for the points. Snap the check, show the QR (or drop the link) — friends claim what they ordered. Lowest friction at the table. Guests don’t download. Host doesn’t subscribe.

**Tension to sell:** Card points are why you paid. Don’t lose the night to Venmo math. Path of least resistance: one photo → QR/link → done.

Do **not** say “vs Splitwise” on camera. Imply it with: “No guest download. No host subscription.”

---

## Timed shot list

| Time | Picture | VO / on-screen text |
|------|---------|---------------------|
| 0–3s | Messy table + long paper receipt; card or phone wallet in frame if natural | “You put the card down for the points.” |
| 3–7s | Screen record: open app → camera → scan → lines appear | “Snap the check.” |
| 7–11s | **Share QR screen** — big generated QR fills the frame (hold steady) | “Show the QR.” |
| 11–15s | Friend’s phone camera on that QR → claim board; taps 2–3 items | “They claim what they drank. No app for them.” |
| 15–18s | Optional flash: paste link in group chat (same idea, digital table) | “Or drop the link.” |
| 18–22s | Wine mark + wordmark on linen paper | “Fair, not equal. Path of least resistance.” |

If you need a strict **20s** cut, drop the 15–18s “Or drop the link” beat and go straight to the end card after claim.

### Text overlays (exact)

1. `You put the card down for the points.`
2. `Snap the check.`
3. `Show the QR.`
4. `They claim what they drank.` / second line: `No app for them.`
5. (optional) `Or drop the link.`
6. `Fair, not equal.` / second line: `Path of least resistance.`

### Optional VO add (one cut only)

Under claim beat or end card, soft: “No host subscription.” — keep it under 1s; do not name competitors.

Alt hook (A/B): `Want the card points? Still split fair.` — use instead of overlay 1 if the points line feels too long on screen.

---

## End card / CTA

Pick **one** audience per export:

| Cut | End card URL / action |
|-----|------------------------|
| Friends / TestFlight | TestFlight invite link (or “Ask me for the invite”) |
| Public / social | `splitthewine.app` (waitlist / landing) |

Brand colors (match landing): merlot `#6E2E35`, paper `#F6F4F1`, ink `#2A241C`.

---

## Shoot checklist

- [ ] iPhone, vertical 9:16, 1080×1920 or higher
- [ ] TestFlight **build 10+** against production API (`api.splitthewine.app`)
- [ ] Real restaurant receipt (paper or e-receipt screenshot) — hard-to-read is fine; accuracy is the product
- [ ] Table B-roll: real dishes/glasses; receipt + paying-with-card vibe (points story)
- [ ] Screen Recording on for host path: capture → parse → items → **Share QR**
- [ ] **Dedicated QR still:** open Share QR on a real tab, take a clean screenshot (QR large, venue title visible). Replace [`screenshots/app-store/07-qr-share.jpg`](screenshots/app-store/07-qr-share.jpg) (seeded from how-it-works demo; refresh with a live tab)
- [ ] Second device: friend scans that QR (or opens claim link) — **no guest app install**
- [ ] Optional: same night, drop link in iMessage for the “Or drop the link” beat
- [ ] Edit in CapCut or iMovie: hard cuts only
- [ ] Audio: room tone or one soft bed; avoid stock “upbeat fintech” music
- [ ] Burn in overlays in merlot/ink on paper-friendly contrast
- [ ] Export one friends cut + one public cut if both CTAs are needed

---

## B-roll fallbacks (if live scan is shaky)

Prefer live TestFlight footage. If a beat fails, cut to these stills (hold 1–1.5s, slight Ken Burns):

### QR (required beat — use this if you don’t have a fresh still yet)

| Beat | File | Notes |
|------|------|--------|
| **Show the QR** | [`screenshots/how-it-works/03-qr-link.jpg`](screenshots/how-it-works/03-qr-link.jpg) | Existing “Share QR” sheet — large code + “Pass your phone — friends scan…” + claim link. Prefer a **new** TestFlight capture saved as `screenshots/app-store/07-qr-share.png` when you shoot. |

### Best match — landing “how it works”

| Beat | File |
|------|------|
| Snap the check | [`screenshots/how-it-works/01-snap.jpg`](screenshots/how-it-works/01-snap.jpg) |
| Lines / items | [`screenshots/how-it-works/02-items.jpg`](screenshots/how-it-works/02-items.jpg) or [`02-scan-items.webp`](screenshots/how-it-works/02-scan-items.webp) |
| Drop the link | [`screenshots/how-it-works/03-share-copy.jpg`](screenshots/how-it-works/03-share-copy.jpg) |
| Pass / settle | [`screenshots/how-it-works/04-pass.jpg`](screenshots/how-it-works/04-pass.jpg) or [`04-settle-pay.jpg`](screenshots/how-it-works/04-settle-pay.jpg) |

### App Store portraits (secondary)

| Beat | File | What’s on screen |
|------|------|------------------|
| End card / brand | [`screenshots/app-store/01-portrait.png`](screenshots/app-store/01-portrait.png) | Wine mark + “Split the Wine” |
| Host desk open | [`screenshots/app-store/02-portrait.png`](screenshots/app-store/02-portrait.png) | “Start a tab” empty desk |
| Hook / ready | [`screenshots/app-store/03-portrait.png`](screenshots/app-store/03-portrait.png) or [`06-portrait.png`](screenshots/app-store/06-portrait.png) | “Ready to split this check?” |
| Capture step | [`screenshots/app-store/04-portrait.png`](screenshots/app-store/04-portrait.png) | “How should we add the tab?” photo / library |
| **QR share** | [`screenshots/app-store/07-qr-share.jpg`](screenshots/app-store/07-qr-share.jpg) | Share QR sheet — replace with a live-tab capture on shoot day |

Skip [`05-landscape.png`](screenshots/app-store/05-landscape.png) for this vertical cut unless you crop to 9:16.

### Brand still for final frame

[`brand/og.png`](brand/og.png) or [`brand/icon-1024.png`](brand/icon-1024.png) on paper `#F6F4F1` with wordmark.

---

## Messaging cheatsheet (keep in voice)

| Say | Don’t say |
|-----|-----------|
| Card points / put the card down | Miles hacking, churning, “max your rewards strategy” |
| Path of least resistance / lowest friction | “Disruptive expense management” |
| Fair, not equal | Equal split / “split evenly” as the hero |
| Show the QR / drop the link | “Onboard your party to the platform” |
| No guest app · no host subscription | Naming Splitwise (or any competitor) on camera |

---

## Related

- Labeled pack for AI generators (stills + recordings + prompts): [`video-artifacts/README.md`](video-artifacts/README.md) · [`video-artifacts/prompts-ai.md`](video-artifacts/prompts-ai.md)
- Positioning and the original 15s sketch: [`strategy.md`](strategy.md).
