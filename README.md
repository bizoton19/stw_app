# Split the Wine

A native-feeling phone app for splitting a restaurant check fairly. Photograph the tab, send a link, let people claim what they ordered. Tax and tip follow the drinks — not the headcount.

Receipt scanning uses OpenRouter when `OPENROUTER_API_KEY` is set (server-side only). Without a key, or if the call fails, the sample bar tab is used so the rest of the flow still works.

## Prerequisites

What you need to build, run, and ship this project — accounts we use, CLIs, and the tech stack.

### Accounts & services

| Service | What it’s for | Notes |
| --- | --- | --- |
| **[OpenRouter](https://openrouter.ai/)** | Vision model for receipt OCR + line classification (food/drink) | Server-only `OPENROUTER_API_KEY`. Default model: `google/gemini-2.5-flash`. |
| **[Railway](https://railway.app/)** | API / Next.js hosting + **Postgres** | Deploy with Railway CLI or GitHub. Set `DATABASE_URL`, `OPENROUTER_*`, `ALLOWED_ORIGINS`, Mapbox token. |
| **[Cloudflare](https://www.cloudflare.com/)** (DNS) | Domain DNS for `splitthewine.app` | `api.` → Railway; `www` / apex → marketing. See [`plans/dns-todos.md`](plans/dns-todos.md). |
| **[Netlify](https://www.netlify.com/)** | Static **marketing / landing** site | Base directory `marketing/` (`marketing/netlify.toml`). Not the claim API. |
| **[Mapbox](https://www.mapbox.com/)** | Places autocomplete + static maps (Android / web) | `MAPBOX_ACCESS_TOKEN`. iOS venue search uses on-device **MapKit**. |
| **[Expo](https://expo.dev/)** / EAS | Native builds, updates, store submit | `eas-cli` in `apps/mobile`. Project under Expo account. |
| **[Apple Developer Program](https://developer.apple.com/programs/)** | iOS signing, TestFlight, App Store | Bundle id `com.splitthewine.app`. Paid membership required to ship. |
| **Google Play Console** | Android store listing / release | Package `com.splitthewine.app`. |
| **[Firebase](https://firebase.google.com/)** (App Check) | App attestation for store / API abuse resistance | Planned for App Store / Play integrity requirements — wire App Check before relying on it in production. |

Optional later: object storage for receipt images, Twilio/etc. for messaging (not in current scope).

### Local tools & CLIs

| Tool | Why |
| --- | --- |
| **Node.js** (LTS, e.g. 20+) + **npm** | Root Next.js API and `apps/mobile` Expo app |
| **Git** | Source control |
| **Railway CLI** (`railway`) | Link project, set env, `railway up` / logs / redeploy |
| **EAS CLI** (`eas` / `npx eas-cli`) | `eas build`, `eas submit` for iOS/Android |
| **Expo CLI** (`npx expo`) | Metro, Expo Go, `expo run:ios` / `run:android` |
| **Xcode** (Mac) | iOS Simulator, device builds, signing |
| **Android Studio** + SDK / emulator | Android builds and device testing |
| **CocoaPods** (via Xcode / Expo prebuild) | iOS native deps when generating `ios/` |
| **Netlify CLI** (optional) | Deploy or preview `marketing/` locally |

### Tech stack (what we ship)

**Server / web claim UI (repo root)**  
Next.js (App Router) · TypeScript · React · Tailwind · Route Handlers · Postgres (`pg`, schema `split_the_wine`) · in-memory store fallback · OpenRouter vision · Mapbox Places · SSE + poll for live claims

**Native app (`apps/mobile`)**  
Expo · Expo Router · React Native · TypeScript · AsyncStorage · expo-image-picker / camera / location · MapKit (iOS) · EAS Build

**Marketing**  
Static HTML/CSS in `marketing/` on Netlify

**Environments (typical)**

- Local API: `http://0.0.0.0:43147` (`npm run dev` / `npm run start`)
- Production API + claim board: Railway (`api.splitthewine.app` or `*.up.railway.app`)
- Landing: `www.splitthewine.app` (Netlify)
- Mobile: `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SHARE_URL` → that API origin

Copy root `.env.example` → `.env.local` and `apps/mobile/.env.example` → `apps/mobile/.env.local` as needed.

## Run locally

```bash
npm install
npm test
npm run build
npm run start
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147) on a phone-width viewport. Use `npm run start` (production) so the UI hydrates; `next dev` HMR can fail in some preview environments.

- **Start with the receipt** — interview (photo or sample tab → review → pay-you → share)
- **Open the sample tab** — `/r/demo` (tap lines to queue, then set quantities)
- **Host tools** — `/r/demo?host=1`

Copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY` for live receipt scanning. The key stays on the server. Without it, the sample tab is used.

Without `DATABASE_URL`, data lives in memory and resets when the server restarts. With Postgres on Railway, receipts persist.

## Native app (Expo)

A real React Native client lives in [`apps/mobile`](apps/mobile). It uses the same parse/claims API. The OpenRouter key stays on the server.

Copy-paste steps for **Expo Go** (scan a QR on a phone) and **Xcode** (`npx expo run:ios`) are in [`apps/mobile/README.md`](apps/mobile/README.md). A physical phone cannot use `localhost` for the API — set `EXPO_PUBLIC_API_URL` to your Mac's LAN IP (or the Railway URL).

## Stack (short)

Next.js · TypeScript · Tailwind · Motion · Postgres / memory store · Expo / React Native · OpenRouter · Mapbox / MapKit · Railway · Netlify · Cloudflare DNS
