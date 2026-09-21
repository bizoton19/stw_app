# Split the Wine

A native-feeling phone app for splitting a restaurant check fairly. Photograph the tab, send a link, let people claim what they ordered. Tax and tip follow the drinks — not the headcount.

Receipt scanning uses OpenRouter when `OPENROUTER_API_KEY` is set (server-side only). Without a key, or if the call fails, the sample bar tab is used so the rest of the flow still works.

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

Data lives in memory and resets when the server restarts.

## Native app (Expo)

A real React Native client lives in [`apps/mobile`](apps/mobile). It uses the same parse/claims API. The OpenRouter key stays on the server.

Copy-paste steps for **Expo Go** (scan a QR on a phone) and **Xcode** (`npx expo run:ios`) are in [`apps/mobile/README.md`](apps/mobile/README.md). A physical phone cannot use `localhost` for the API — set `EXPO_PUBLIC_API_URL` to your Mac's LAN IP.

## Stack

Next.js · TypeScript · Tailwind · Motion · in-memory Route Handlers · Expo / React Native
