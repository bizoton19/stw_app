# Bug report — host desk / publish (friend-test)

Logged: 2026-09-27  
Status: fixed in code (needs API redeploy for server delete of open tabs)

---

## BUG-1 — Delete tab on Home does not free venue/day (publish still blocked)

### Severity
High — blocks republish after a failed or abandoned tab for the same place/day.

### Steps
1. Publish (or partially complete) a tab for a Places venue on a given receipt day.
2. On Home, remove/delete that tab.
3. Continue an unfinished draft for the **same venue + day** and publish.

### Expected
Delete removes the server receipt so the venue/day slot is free. Publish succeeds.

### Actual
Home “Remove from this phone” only cleared the **local** hosted list. The open receipt stayed in Postgres. Publish returned **409 `venue_day_taken`**: “You already have a tab at … for that day.”

### Root cause
- Mobile Home treated **open** tabs as local-only hide; only **finalized** tabs called `DELETE /api/receipts/:id`.
- Server already allows host delete of open tabs (to free the slot); the client never called it for open tabs.
- Local pre-check in publish only sees the phone’s hosted list, so after a local-only remove it passed — then the API still conflicted.

### Fix
- Home trash/delete always calls host `DELETE` for open and closed tabs, then clears local list + host token.
- On `venue_day_taken`, if this phone still has the conflicting tab’s host token, re-surface that tab on Home and tell the host to delete it, then publish again.
- API comments updated: open or closed delete is intentional.

### Verify
1. Publish tab A at venue V for day D.
2. Home → Delete tab (not “hide”).
3. New draft same V + D → publish succeeds.
4. (Regression) Closed tab delete still works; claim links die.

---

## BUG-2 — Unfinished draft only behind New, not on Host desk list

### Severity
Medium — draft is easy to lose / hard to find; feels like the tab disappeared.

### Steps
1. Start a tab (capture / parse / edit) and leave mid-flow (or fail publish). Draft is saved on device (`stw-host-draft-v1`).
2. Return to Home (Host desk).
3. Look for the unfinished tab in the tab list.

### Expected
Unfinished work appears on the desk as a **Draft** row/card; tap continues at the saved step.

### Actual
Draft resume (“Continue unfinished tab”) only appeared after tapping **New** → host ready screen. Home list showed only published/hosted receipts.

### Root cause
Draft persistence lived in host flow only; Home never loaded `loadHostDraft()` / `draftHasProgress`.

### Fix
- Home loads the persisted draft on focus.
- When present, shows a **Draft** card (place, day, “Tap to continue”) plus discard.
- New → Continue unfinished remains as a second entry point.

### Verify
1. Start a tab, leave after items/fees.
2. Home shows Draft card without tapping New.
3. Tap Draft → lands on resume path; Discard clears local draft only.

---

## BUG-3 — Draft still on Home after successful publish (Draft + Open)

### Severity
Medium — desk shows a ghost unfinished draft next to the real open tab.

### Root cause
`publish()` called `clearHostDraft()`, but the autosave effect still held interview state in memory and rewrote AsyncStorage shortly after (pathname change to `/host/share`).

### Fix
After publish: `skipPersist`, mark `published`, clear storage; autosave no-ops while published. Share screen still uses in-memory fields.

---

## BUG-4 — No easy exit to Home at end of host workflow

### Severity
Medium — host hammers Back through the interview stack.

### Fix
Share step: primary **Done — go Home**, back chevron → Home, live board is secondary. Shared `goHostDesk()` dismisses nested stacks when available, then replaces to Home. Live board / claims host back also use it.

---

## BUG-5 — Step 4 auto-locks place (no dropdown / no map) after draft hydrate race

### Severity
High — host cannot confirm Places; Continue may look stuck or wrong pin.

### Root cause
AsyncStorage draft hydrate could finish **after** Start fresh / parse and restore a stale Places pin. Locked card showed with no working map and no suggestion list.

### Fix
- Draft epoch: clear/parse invalidates in-flight hydrate.
- Parse always clears `venue` (OCR name only seeds typeahead).
- Map load failure unlocks so suggestions return.
- Home icon on every host interview step (`onHome` → desk).

---

## BUG-6 — Step 4 autocomplete broken after Mapbox thumb work

### Severity
High — host cannot pick a Places suggestion.

### Likely cause
Venue typeahead was wired through `place-pin` / colored static-map helpers, plus a map-fail unlock effect that could fight the suggestion list.

### Fix
- Revert `apps/mobile/src/components/venue-typeahead.tsx` (and web typeahead map URL) to the pre-thumb implementation.
- Keep Home desk `VenueMapThumb` + optional `color` on `/api/places/static-map` (defaults to merlot).
- Keep draft-hydrate race fixes so parse still clears venue.

---

## Notes
- Redeploy **API** so production matches open-tab delete (if an older deploy still rejected non-finalized delete).
- Expo Go picks up mobile changes on reload; no store rebuild required for friend-test.
