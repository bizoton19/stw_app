# Split the Wine

A mobile-and-web prototype for splitting a restaurant check fairly. Photograph the tab, send a link, and let people claim what they actually ordered. Tax and tip follow the drinks — not the headcount.

This is the first product slice: a slick interview-style app (red, light blue, white), not a native/platform scaffold. Receipt scanning is **stubbed** until a vision API key is wired in.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147).

- **New receipt** — TurboTax-style host interview (photo or sample tab → review lines → pay-you → share link)
- **Try the sample tab** — guest claim board on the reference bar tab (`/r/demo`)
- **Host tools** — `/r/demo?host=1` to close claiming and settle

No env vars are required. Data lives in process memory and resets when the server restarts.

## What this slice includes

- Host interview: capture, stubbed parse, restaurant, items, fees, payment handle, shareable link
- Guest claim board with integer quantities and live remaining counts (SSE + poll fallback)
- Concurrent claim protection (last-units race cannot overclaim)
- Proportional fee split in integer cents
- Payment-request **messages** (SMS / WhatsApp / copy) — never auto-sent, never moves money
- Dispute board: who claimed how many, plus contact

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · in-memory Route Handlers

Vision, Postgres, and a React Native client are later work. See the product plan for the migration target.
