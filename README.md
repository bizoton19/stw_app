# Split the Wine

A native-feeling phone app for splitting a restaurant check fairly. Photograph the tab, send a link, let people claim what they ordered. Tax and tip follow the drinks — not the headcount.

Receipt scanning is **stubbed** until a vision key exists.

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

No env vars. Data lives in memory and resets when the server restarts.

## Stack

Next.js · TypeScript · Tailwind · Motion · in-memory Route Handlers
