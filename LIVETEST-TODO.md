# Live Test / TestFlight checklist

Closed friend test: Expo iOS build → Apple TestFlight → Railway HTTPS API.

**Already done**
- [x] Deploy API to Railway — `https://api-production-72488.up.railway.app`
- [x] Set `OPENROUTER_API_KEY`, `OPENROUTER_HTTP_REFERER`, `ALLOWED_ORIGINS` on Railway
- [x] Phase 0 API harden (host-token parse, demo gated, CORS allowlist)

Spell-outs used below:
- **EAS** = Expo Application Services (Expo’s cloud build / submit service)
- **ATS** = App Transport Security (iOS rules for HTTP/HTTPS; blocks cleartext unless you allow it)
- **IPA** = iOS App Store Package (the installable build file)
- **API** = Application Programming Interface (our Next.js server)
- **CLI** = Command Line Interface
- **QR** = Quick Response code (the scan code Expo Go shows)

---

## 0. Accounts (you do these in a browser)

- [ ] **Apple Developer Program** enrolled ($99/yr) — https://developer.apple.com
- [ ] **App Store Connect** access with that same Apple ID — https://appstoreconnect.apple.com
- [ ] Create the iOS app record: name **Split the Wine**, bundle id **`com.splitthewine.app`**
- [ ] **Expo** account — https://expo.dev → sign up / sign in
- [ ] Install EAS CLI on your Mac: `npm i -g eas-cli` then `eas login`

---

## 1. Icons & store assets (you / design)

Apple and EAS will reject or look broken without these.

- [ ] **App icon** — final marketing-quality icon (1024×1024 PNG, no transparency for App Store)
  - Update `apps/mobile/assets/images/icon.png`
  - Update `apps/mobile/assets/expo.icon` (iOS layered icon) if you keep using it
  - Android adaptive pieces under `apps/mobile/assets/images/android-icon-*.png` if you care about Android later
- [ ] **Splash** — `apps/mobile/assets/images/splash-icon.png` matches the brand
- [ ] Optional later for public App Store: screenshots (6.7" and 6.1" iPhone), subtitle, description, Privacy Policy URL

---

## 2. Point the mobile app at Railway (build-time env)

Native builds bake env in at compile time. Expo Go LAN defaults will **not** work for TestFlight friends.

- [ ] In `apps/mobile`, set for EAS / production builds:
  ```bash
  EXPO_PUBLIC_API_URL=https://api-production-72488.up.railway.app
  EXPO_PUBLIC_SHARE_URL=https://api-production-72488.up.railway.app
  ```
- [ ] Prefer EAS project secrets / `eas.json` `env` over committing real URLs if you want flexibility
- [ ] Smoke-test once: phone or Simulator hitting Railway creates a receipt and parses a photo

---

## 3. iOS config polish before TestFlight

- [ ] Add `eas.json` under `apps/mobile` (preview + production iOS profiles) via `eas build:configure`
- [ ] **ATS**: remove or narrow `NSAllowsArbitraryLoads` in `apps/mobile/app.json` for store builds (Railway is HTTPS; cleartext was for local LAN only)
- [ ] Add `ITSAppUsesNonExemptEncryption: false` in `ios.infoPlist` if you’re not using custom crypto (export-compliance checkbox)
- [ ] Confirm camera / photo usage strings still read well in `app.json`
- [ ] Bump `expo.version` / iOS build number when you ship a new TestFlight build

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
- [ ] Tell friends: **redeploying Railway wipes all open tabs** (in-memory store)
- [ ] Don’t post the Railway URL publicly
- [ ] Cap / alert OpenRouter spend in the OpenRouter dashboard

---

## 7. Later (public App Store — not required for closed TestFlight)

- [ ] Privacy Policy URL
- [ ] App Store screenshots + description
- [ ] Persistent storage (Postgres) so restarts don’t wipe dinners
- [ ] Rate limits / stronger invite or claim gating
- [ ] Drop local-network ATS exceptions from production profile entirely

---

## Quick reference

| Thing | Value |
|---|---|
| Bundle id | `com.splitthewine.app` |
| Mobile app | `apps/mobile` |
| API (Railway) | `https://api-production-72488.up.railway.app` |
| Security notes | `plans/railway-security.md` |

**Suggested order:** §0 accounts → §1 icons → §2 Railway env → §3 config → §4 build → §5 TestFlight → §6 friends.
