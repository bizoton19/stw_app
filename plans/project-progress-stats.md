# Split the Wine — project progress stats

Living log of how fast this product came together. Update after major milestones (see `.cursor/rules/project-progress.mdc`).

## Snapshot

| | |
| --- | --- |
| **Project start** | **2026-09-20 13:41:10 −04:00** (`Initialize project`) |
| **This snapshot** | 2026-10-03 ~11:20 −04:00 · consolidating bot branches into `plan-an-outing` |
| **Elapsed** | **~12.9 days** |
| **Commits on this branch** | refresh with `git rev-list --count HEAD` |
| **Surfaces** | Next.js API + web claim UI · Expo iOS/Android · marketing (Netlify) · Railway + Postgres |

Refresh commit count anytime:

```bash
git rev-list --count HEAD
git log --reverse -1 --format='%aI %s'
```

## Major features (as we went)

### Day 1 — Sat 2026-09-20 (~11 commits)
- Project bootstrap + v0 web prototype
- Quiet native-feeling host interview chrome
- Guest claim: queue items → quantities
- OpenRouter vision receipt parse (token/VAT hardening)

### Day 2 — Sun 2026-09-21 (~46 commits)
- Expo native client against the same API
- Host can claim; multi pay methods (Venmo / PayPal / Cash App / Haiti rails)
- Official pay logos; pay apps open with amount
- Railway friend-test harden + Postgres (`split_the_wine`)
- Marketing site, privacy, App Store badges, i18n
- Share extension / Android share intent for receipt photos
- EAS wiring toward TestFlight

### Day 3 — Mon 2026-09-22 (~4 commits)
- Parse review Looks good / No + retake receipt photo
- Persist review choices for vision eval

### Day 4 — Wed 2026-09-24 (~28 commits)
- Venue typeahead (MapKit / Mapbox) + kind icons + static map
- Places-confirmed venue; one tab per place per day
- Guest settle via host pay icons
- Claim-board density + native-feel polish
- DNS / `api.splitthewine.app` cutover docs
- Phase 2/3 plans (venue + voice) documented

### Day 5 — Thu 2026-09-25 (~38 commits)
- Host desk dashboard (open / closed / drafts)
- Host claim push notifications
- Bottle ↔ glass pour claiming (host-confirmed)
- Receipt images in S3-compatible blob storage
- `vision.parse` logs + hard parse timeout
- Food/drink icons, multi-select pay handles, live-board polish

### Day 6 — Fri 2026-09-26 (~21 commits)
- Delete tabs from desk / closed-tab cleanup
- ERD + usage-funnel / B2B / Cloudflare edge plans
- Optional host note for claimers
- Support Split the Wine tip page (quiet link + deep-links)
- Guest-first / party-size feasibility plans

### Day 7 — Sat 2026-09-27 (~38 commits)
- Ambiguous pour resolve prompts
- Share QR at the table
- Compact host live-board tab bar (Close tab, My Claims)
- Host draft persistence + Home drafts
- Mapbox Search Box + venue kind thumbs on Home
- Vision **classify-before-parse** gate
- Tab photo bottom sheet (mobile) + web dialog + zoom
- Official pay logos on web + host handle rows
- Host interview: drop loading from step count; footer chrome contrast
- Web guest: settle after ≥1 claim; **pay later** with Copy link + Share/Save
- Progress stats doc + Cursor rule to keep milestones current
- Host desk: camera + upload shortcuts (skip beginner guide); edit pay handles after publish
- Web brand mark matches official tilted merlot bottle icon

### Day 12 — Fri 2026-10-02
- **The app now knows what time it is.** Cards paint `linen` by day and a dimmer, warmer `candlelight` after 19:00 local — automatically, with no picker and no setting to explain. A blocking script in `<head>` sets the theme before first paint, so there is no flash and no hydration mismatch.
- **Hand-drawn motif kit replaces generic icons** on both web and native: a stem marks a drink line, a torn check stub marks food and "the tab", a carafe marks a shared bottle, a label band marks the venue. All stroke-only and colour-inheriting, so one drawing serves every theme.
- **Settle got card treatment** — a masked split watermark behind "You owe", and a tear line instead of a plain divider.
- The day palette is unchanged on purpose: every theme token holds the exact value it shipped with, so dusk is one-line reversible and "too ugly" never costs a migration.
- Same display name no longer merges on the claim board or settle: each join keeps a stable guest id, and “you owe” follows that id.
- Launch waitlist is production-safe: validated emails, in-process rate limits, and `launch_notify` documented in the ERD. Coming-soon prefers the Railway list; Netlify Forms stays an unsynced fallback when the API cannot be reached.
- Coming-soon waitlist host is chosen at Netlify build time (`STW_API_BASE` → `api-config.js`), so staging and local can override the production API.
- CORS + waitlist smoke checklist for `www` → Railway `POST /api/waitlist`.

### Day 13 — Sat 2026-10-03 · **candidate release**
- Labeled **`candidate-release-2026-10-03`** on `plan-an-outing` (friend-test / store-prep freeze point before Places hybrid work).
- Receipt read is snappier: skip host classify by default, sharp-downscale before Gemini, **15s** extract timeout, default model **gemini-3.5-flash-lite**.
- Home paints hosted tabs from local storage first; close/reopen apply the POST receipt and GET no longer takes a Postgres row lock.
- Nearby food and drink (top 7) comes from Google Places through the server. Picking a Mapbox or MapKit suggestion asks Google for that place’s id by name and location; the receipt keeps Google when that works, and the Mapbox or Apple pin when it does not. There is no Places key in the app — without one, the proxy says so and does not call Google.
- Nearby photos on a phone use the same API address as the rest of the app, so a `0.0.0.0` photo link from the dev server still loads. Each list card is one full photo. Opening a place scrolls up to three nearby photos, labels the Google rating, and shows a Mapbox map of the pin.
- On “Where are you going?” and the web restaurant step, nearby places swipe sideways as photo cards (the first nearby photo, plus name, address, and category) until you type two letters. A tap opens that one place, scrolls up to three nearby photos, and loads its rating and website from Place Details; Plan here saves them with the first nearby photo, and back returns to the place step. Typing still uses Mapbox or MapKit and the place-id bridge. If nearby or that details call cannot load, the row stays empty or the place still saves without a rating, and search still works.
- On the phone, the place screen leads the address, Google rating, category, website, and maps lines with small line icons. Tapping a gallery photo opens that same image in the full-page tab-photo sheet, centered, with the close control on screen. Swipe down or tap the scrim to close. The tab photo uses that same sheet.
- Guest claim-link copy matches the ad message (“Claim what you ordered” / pay-the-host settle).

## How to extend this file

When a meaningful slice ships (new surface, friend-test gate, store milestone):

1. Bump **Snapshot** (datetime + `git rev-list --count HEAD`).
2. Append a bullet under today’s day section (or start a new day heading).
3. Prefer product outcomes over commit subjects (“classify-before-parse”, not “fix typo”).

Do **not** paste every commit — keep this scannable.
