# Live Test / TestFlight checklist

Closed friend test: Expo iOS → Apple TestFlight · optional Android / Play internal · Railway HTTPS API (`https://api.splitthewine.app`).

## HIGH PRIORITY — Custom domain

See **[plans/dns-todos.md](./plans/dns-todos.md)** — cut over to **`https://api.splitthewine.app`** (DNS + Railway + EAS env). Do before the next TestFlight push that friends will share.

**Already done**
- [x] Deploy API to Railway — `https://api-production-72488.up.railway.app` (+ custom `api.splitthewine.app`)
- [x] Set `OPENROUTER_API_KEY`, `OPENROUTER_HTTP_REFERER`, `ALLOWED_ORIGINS` on Railway
- [x] Phase 0 API harden (host-token parse, demo gated, CORS allowlist)
- [x] Persist receipts to shared Railway Postgres in schema **`split_the_wine`** (redeploys no longer wipe tabs)

Spell-outs used below:
- **EAS** = Expo Application Services (Expo’s cloud build / submit service)
- **ATS** = App Transport Security (iOS rules for HTTP/HTTPS; blocks cleartext unless you allow it)
- **IPA** = iOS App Store Package (the installable build file)
- **AAB** = Android App Bundle (Play Store upload format)
- **APK** = Android Package (sideload / direct install)
- **API** = Application Programming Interface (our Next.js server)
- **CLI** = Command Line Interface
- **QR** = Quick Response code (the scan code Expo Go shows)
- **PWA** = Progressive Web App (installable website; Add to Home Screen)
- **FCM** = Firebase Cloud Messaging (Android push)

---

## 0. Accounts (you do these in a browser)

- [x] **Apple Developer Program** — enrollment submitted / **pending** approval — https://developer.apple.com
- [ ] **App Store Connect** access once membership is Active — https://appstoreconnect.apple.com
- [ ] Create the iOS app record: name **Split the Wine**, bundle id **`com.splitthewine.app`**
- [ ] **Google Play Console** developer account (one-time fee) — https://play.google.com/console
- [ ] Create the Android app record: name **Split the Wine**, package **`com.splitthewine.app`**
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
- [ ] Optional later for public App Store / Play: screenshots, subtitle, description, Privacy Policy URL

---

## 2. Point the mobile app at Railway (build-time env)

Native builds bake env in at compile time. Expo Go LAN defaults will **not** work for TestFlight / Play friends.

- [x] Railway URLs baked into `apps/mobile/eas.json` for `development` / `preview` / `production`:
  - Prefer `EXPO_PUBLIC_API_URL=https://api.splitthewine.app`
  - Prefer `EXPO_PUBLIC_SHARE_URL=https://api.splitthewine.app`
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

## 5b. Android — register + first friend-test build

Package is already **`com.splitthewine.app`** in `app.json`. Adaptive icons are drafted.

### Play Console (browser)

- [ ] Pay for / open **Google Play Console** — https://play.google.com/console
- [ ] **Create app** → Split the Wine → package `com.splitthewine.app`
- [ ] Complete required declarations (privacy policy URL can be `https://www.splitthewine.app/privacy` when ready)
- [ ] Create an **Internal testing** track (closed friends) before production

### EAS Android build (from `apps/mobile`)

- [ ] `eas build -p android --profile preview` (or `production`)
  - Let EAS generate / manage the upload keystore on first Android build
- [ ] Wait for build; download **AAB** (Play) or use Expo’s install page for a direct APK if offered
- [ ] Fix signing / icon / permission issues and rebuild if needed

### Distribute to friends

- [ ] **Play Internal testing**: upload AAB → add tester emails / Google Group → they opt in via the Play link
- [ ] **Or** share EAS install link / sideload APK for a tiny closed group (no store listing polish yet)
- [ ] Smoke on a real Android phone: camera → parse → place (Mapbox + location prompt) → publish → guest claim on another device → settle

### Android push (later — host claim pings)

- [ ] Expo push / **FCM** credentials in Expo dashboard (needed for background host notifications on Android)
- [ ] Friend-test: host backgrounds app → guest claims → host gets ping

**Quick Android without Play:** Expo Go against `api.splitthewine.app` (limited: no production push, share-intent quirks) or a local `eas build` APK.

---

## 6. Friend-test runbook

- [ ] Two phones: one **hosts** (photo → parse → share link), one **claims**
- [ ] Pay deep links open Venmo / Cash App / PayPal when installed
- [ ] Tell friends: API redeploys keep tabs (Postgres schema `split_the_wine`); still don’t post the Railway URL publicly
- [ ] Don’t post the Railway URL publicly
- [ ] Cap / alert OpenRouter spend in the OpenRouter dashboard
- [ ] **Host claim push** (Phase 1 — `plans/requirements.md` §4 / §17) — ship with TestFlight/dev-client; not Expo Go
  - [x] Server: register token + Expo push on claim/unclaim
  - [x] Mobile: permission + register on share/live board; tap opens settle
  - [ ] Redeploy Railway API so `host_push_tokens` exists
  - [ ] EAS iOS build with push entitlement / APNs key in Expo
  - [ ] Friend-test: host locks phone → guest claims → host gets ping

---

## 7. Later (public App Store / Play — not required for closed friend-test)

- [ ] Privacy Policy URL
- [ ] App Store / Play screenshots + description
- [ ] Persistent storage (Postgres) so restarts don’t wipe dinners — **done for friend-test** (`split_the_wine` schema on shared instance)
- [ ] Rate limits / stronger invite or claim gating
- [ ] Drop local-network ATS exceptions from production profile entirely
- [ ] Object storage for receipt images (optional; parse-once is fine for now)

---

## 8. Optional — Host as PWA (skip store friction?)

**Short answer:** camera + location **do work** in a mobile browser / PWA on **HTTPS**. We already exercise both in the **web host interview** on Railway (`<input capture="environment">` + `navigator.geolocation` for Mapbox proximity).

| Capability | PWA / mobile Safari & Chrome | Notes |
| --- | --- | --- |
| Snap / upload receipt | Yes | File input + `capture="environment"`; getUserMedia also possible |
| Location for place rank | Yes | Geolocation API; user can deny → name-only search |
| Install to home screen | Yes | Android Chrome easy; iOS “Add to Home Screen” |
| Host claim push | Weak / messy | iOS PWA push is limited; Android better but not like Expo+FCM |
| Share sheet / share-in | Partial | Web Share API; no iOS share extension |
| Offline / polish | Weaker | Native still wins for friend-test feel |

**Already true today:** guests + hosts can use **`https://api.splitthewine.app/host`** (web claim board + host interview) without installing anything. A formal PWA would add a web manifest + service worker + “Add to Home Screen” icon — not a new product surface.

**Recommendation for now:** keep shipping **TestFlight + optional Play internal**; use the **web host URL** as the zero-install escape hatch for Android friends. Revisit a polished host PWA if store review / dual-store tax becomes the bottleneck.

- [ ] Decide: friend-test Android via Play internal **or** web host URL first
- [ ] If PWA: add `manifest.webmanifest` + icons + install prompt on `/host` (track in a later plan)

---

## Quick reference

| Thing | Value |
|---|---|
| Bundle / package id | `com.splitthewine.app` |
| Mobile app | `apps/mobile` |
| API | `https://api.splitthewine.app` |
| Web host (no install) | `https://api.splitthewine.app/host` |
| Security notes | `plans/railway-security.md` |
| UI flows | `plans/ui-flows.md` |

**Suggested order:** §0 accounts → §1 icons → §2 Railway env → §3–5 iOS TestFlight → §5b Android when ready → §6 friends · §8 PWA only if stores are the pain.
