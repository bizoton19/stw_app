# Live Test / TestFlight checklist

Closed friend test: Expo iOS build → Apple TestFlight → Railway HTTPS API.

## HIGH PRIORITY — Custom domain

See **[plans/dns-todos.md](./plans/dns-todos.md)** — cut over to **`https://api.splitthewine.app`** (DNS + Railway + EAS env). Do before the next TestFlight push that friends will share.

**Already done**
- [x] Deploy API to Railway — `https://api-production-72488.up.railway.app`
- [x] Set `OPENROUTER_API_KEY`, `OPENROUTER_HTTP_REFERER`, `ALLOWED_ORIGINS` on Railway
- [x] Phase 0 API harden (host-token parse, demo gated, CORS allowlist)
- [x] Persist receipts to shared Railway Postgres in schema **`split_the_wine`** (redeploys no longer wipe tabs)

Spell-outs used below:
- **EAS** = Expo Application Services (Expo’s cloud build / submit service)
- **ATS** = App Transport Security (iOS rules for HTTP/HTTPS; blocks cleartext unless you allow it)
- **IPA** = iOS App Store Package (the installable build file)
- **API** = Application Programming Interface (our Next.js server)
- **CLI** = Command Line Interface
- **QR** = Quick Response code (the scan code Expo Go shows)

---

## 0. Accounts (you do these in a browser)

- [x] **Apple Developer Program** — enrollment submitted / **pending** approval — https://developer.apple.com
- [ ] **App Store Connect** access once membership is Active — https://appstoreconnect.apple.com
- [ ] Create the iOS app record: name **Split the Wine**, bundle id **`com.splitthewine.app`**
- [x] **Expo** account — logged in as **bizoton19**
- [x] EAS CLI available in `apps/mobile` (`eas-cli` devDependency); project linked

---

## 1. Icons & store assets (you / design)

Apple and EAS will reject or look broken without these.

- [x] **Draft app icon** installed — merlot split-bottle on cream (`apps/mobile/assets/images/icon.png`); iOS now uses that PNG (not the old Expo blueprint `.icon`)
- [x] **Draft splash** — `apps/mobile/assets/images/splash-icon.png`
- [x] **Draft Android adaptive** — `android-icon-foreground/background/monochrome.png`
- [x] **Approve draft icons** — four-break merlot bottle on cream (kept; originals in `apps/mobile/assets/drafts/`)
- [ ] **Final marketing polish** only if App Store review wants a sharper vector remake (optional)
- [ ] Optional later for public App Store: screenshots (6.7" and 6.1" iPhone), subtitle, description, Privacy Policy URL

---

## 2. Point the mobile app at Railway (build-time env)

Native builds bake env in at compile time. Expo Go LAN defaults will **not** work for TestFlight friends.

- [x] Railway URLs baked into `apps/mobile/eas.json` for `development` / `preview` / `production`:
  - `EXPO_PUBLIC_API_URL=https://api-production-72488.up.railway.app`
  - `EXPO_PUBLIC_SHARE_URL=https://api-production-72488.up.railway.app`
- [ ] Smoke-test once: phone or Simulator hitting Railway creates a receipt and parses a photo

---

## 3. iOS config polish before TestFlight

- [x] Add `eas.json` under `apps/mobile` (preview + production iOS profiles)
- [x] **ATS**: dropped `NSAllowsArbitraryLoads`; keep `NSAllowsLocalNetworking` for LAN/dev only
- [x] Add `ITSAppUsesNonExemptEncryption: false` in `ios.infoPlist`
- [x] Camera / photo usage strings already set in `app.json`
- [x] Bump `expo.version` / iOS build number when you ship a new TestFlight build (`autoIncrement` is on in eas.json)
- [x] `eas init` — project **@bizoton19/split-the-wine** (`c9dffe8e-7f60-4ad0-a74d-87bdeae1dd4c`)

---

## 4. First EAS iOS build

From `apps/mobile`:

- [ ] `eas build:configure` (creates project + `eas.json` if missing)
- [ ] `eas build -p ios --profile preview` (or `production`)
- [ ] Wait for the cloud build to finish; download or note the build URL
- [ ] Fix any build errors (signing, icons, missing assets) and rebuild if needed

---

## 5. Submit to TestFlight

- [ ] `eas submit -p ios` (or upload the **IPA** in App Store Connect → TestFlight)
- [ ] Wait for Apple processing (often 5–30+ minutes; first build can be longer)
- [ ] **Internal testing**: add yourself / Apple IDs on your team → install via TestFlight app
- [ ] **External testing** (friends): create a group, add emails, fill “What to Test”; first external build may need a short Beta App Review

---

## 6. Friend-test runbook

- [ ] Two phones: one **hosts** (photo → parse → share link), one **claims**
- [ ] Pay deep links open Venmo / Cash App / PayPal when installed
- [ ] Tell friends: API redeploys keep tabs (Postgres schema `split_the_wine`); still don’t post the Railway URL publicly
- [ ] Don’t post the Railway URL publicly
- [ ] Cap / alert OpenRouter spend in the OpenRouter dashboard
- [ ] **Host claim push** (Phase 1 — `plans/requirements.md` §4 / §17) — ship with TestFlight/dev-client; not Expo Go

---

## 7. Later (public App Store — not required for closed TestFlight)

- [ ] Privacy Policy URL
- [ ] App Store screenshots + description
- [ ] Persistent storage (Postgres) so restarts don’t wipe dinners — **done for friend-test** (`split_the_wine` schema on shared instance)
- [ ] Rate limits / stronger invite or claim gating
- [ ] Drop local-network ATS exceptions from production profile entirely
- [ ] Object storage for receipt images (optional; parse-once is fine for now)

---

## Quick reference

| Thing | Value |
|---|---|
| Bundle id | `com.splitthewine.app` |
| Mobile app | `apps/mobile` |
| API (Railway) | `https://api-production-72488.up.railway.app` |
| Security notes | `plans/railway-security.md` |

**Suggested order:** §0 accounts → §1 icons → §2 Railway env → §3 config → §4 build → §5 TestFlight → §6 friends.
