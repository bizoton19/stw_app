# Video artifacts pack (for AI video generators)

Gather **labeled** stills + screen recordings here, then attach them beat-by-beat in Runway / Kling / Luma / CapCut AI / etc.

Creative brief: [`../video-20s.md`](../video-20s.md)  
Copy-paste prompts: [`prompts-ai.md`](prompts-ai.md)

## Folder layout

```
video-artifacts/
  stills/        ← screenshots & brand frames (png/jpg)
  recordings/    ← Screen Recording clips (mp4/mov), 9:16 when possible
  README.md
  prompts-ai.md
```

Do **not** invent fake UI in the generator. Always attach the real product frame/clip for beats 2–5.

## Label scheme

Use these exact filenames so prompts can say “use `S03`” / “use `R02`”.

### Stills (`stills/`)

| Label | Filename | What to capture |
|-------|----------|-----------------|
| **S01** | `S01-table-receipt.jpg` | Real table + long receipt (phone photo). Optional card/wallet in frame. |
| **S02** | `S02-capture.png` | App: “How should we add the tab?” (photo / library). |
| **S03** | `S03-items.png` | App: items list after a good parse (several real lines visible). |
| **S04** | `S04-qr-share.png` | App: **Share QR** — QR large, venue title, claim link. |
| **S05** | `S05-claim-board.png` | Guest claim board in Safari (no guest app) — a few lines claimed. |
| **S06** | `S06-imessage-link.png` | Group chat with claim link pasted (blur other names if needed). |
| **S07** | `S07-endcard.png` | Wine mark + “Split the Wine” on paper `#F6F4F1`. |

### Recordings (`recordings/`)

| Label | Filename | What to record (Screen Recording, vertical) |
|-------|----------|-----------------------------------------------|
| **R01** | `R01-snap-parse.mp4` | Open app → take/choose photo → lines populate (trim to ~4–6s of the best part). |
| **R02** | `R02-qr-hold.mp4` | Open Share QR and hold still ~3s (QR readable). |
| **R03** | `R03-guest-claim.mp4` | Second phone: open link or after scan → tap 2–3 items (Safari). |
| **R04** | `R04-drop-link.mp4` | Optional: share → paste into Messages. |

## Seed from assets you already have

Until you shoot fresh TestFlight clips, **copy** these into `stills/` with the labels above:

| Label | Copy from |
|-------|-----------|
| S02 | [`../screenshots/app-store/04-portrait.png`](../screenshots/app-store/04-portrait.png) |
| S03 | [`../screenshots/how-it-works/02-items.jpg`](../screenshots/how-it-works/02-items.jpg) |
| S04 | [`../screenshots/app-store/07-qr-share.jpg`](../screenshots/app-store/07-qr-share.jpg) or [`../screenshots/how-it-works/03-qr-link.jpg`](../screenshots/how-it-works/03-qr-link.jpg) |
| S07 | [`../screenshots/app-store/01-portrait.png`](../screenshots/app-store/01-portrait.png) or [`../brand/og.png`](../brand/og.png) |

Still missing until you capture: **S01** (table), **S05** (claim board), **S06** (iMessage), all **R0x** recordings.

```bash
cd marketing/video-artifacts/stills
cp ../../screenshots/app-store/04-portrait.png S02-capture.png
cp ../../screenshots/how-it-works/02-items.jpg S03-items.jpg
cp ../../screenshots/app-store/07-qr-share.jpg S04-qr-share.jpg
cp ../../screenshots/app-store/01-portrait.png S07-endcard.png
```

## How to feed an AI generator

1. Export / gather files using the labels above (one beat = one primary reference).
2. Open [`prompts-ai.md`](prompts-ai.md). For each beat, attach the listed still and/or recording, then paste that beat’s prompt.
3. Settings that usually work: **9:16**, 1080p, 2–4s per generated clip, motion low–medium on UI beats (don’t warp the QR).
4. Assemble clips in CapCut/iMovie in order; burn in the overlay text from [`../video-20s.md`](../video-20s.md) yourself if the generator mangles text.
5. Prefer **image/video-to-video** with your artifact as the locked reference. Text-only generation will invent a wrong app UI.

### Tool tips

| Tool pattern | Use |
|--------------|-----|
| Image → video | S01 table, S07 end card |
| Video → video / extend | R01–R03 (keep UI identity) |
| First frame + prompt | S04 QR → gentle phone hand-pass motion (keep QR sharp) |
| Don’t | Ask the model to “redesign” or “improve” the UI |

## Capture checklist (TestFlight)

- [ ] S01 table photo
- [ ] R01 snap → parse (real receipt)
- [ ] S03 / still from that parse if R01 is long
- [ ] R02 + S04 Share QR (replace demo QR with a live tab)
- [ ] R03 + S05 guest claims in Safari
- [ ] R04 / S06 link in chat (optional)
- [ ] S07 end card (or reuse brand still)
