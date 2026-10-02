# Split the Wine — project progress stats

Living log of how fast this product came together. Update after major milestones (see `.cursor/rules/project-progress.mdc`).

## Snapshot

| | |
| --- | --- |
| **Project start** | **2026-09-20 13:41:10 −04:00** (`Initialize project`) |
| **This snapshot** | 2026-10-02 ~06:55 −04:00 |
| **Elapsed** | **~12 days** |
| **Commits** | **222** on this branch after the waitlist commit, rebased onto `plan-an-outing` (refresh with `git rev-list --count HEAD`) |
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

### Day 8 — Fri 2026-10-02
- Launch waitlist is production-safe: validated emails, in-process rate limits, and `launch_notify` documented in the ERD
- Coming-soon prefers the Railway list; Netlify Forms stays an unsynced fallback when the API cannot be reached

## How to extend this file

When a meaningful slice ships (new surface, friend-test gate, store milestone):

1. Bump **Snapshot** (datetime + `git rev-list --count HEAD`).
2. Append a bullet under today’s day section (or start a new day heading).
3. Prefer product outcomes over commit subjects (“classify-before-parse”, not “fix typo”).

Do **not** paste every commit — keep this scannable.
