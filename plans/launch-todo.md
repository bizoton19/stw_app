# Launch todo

Checklist for public App Store / Play launch. Friend-test / TestFlight can stay incomplete here.

---

## Store badges → notify until launch

**Status:** done for pre-launch (marketing links to signup)

Until the apps are live in the stores, **do not** send marketing visitors to App Store / Google Play product pages.

| Surface | Current behavior | At launch |
|---|---|---|
| Hero “Coming soon — notify me” | → [`/coming-soon`](https://www.splitthewine.app/coming-soon) | Keep or retarget to download |
| App Store badge | → `/coming-soon` | → real App Store URL |
| Google Play badge | → `/coming-soon` | → real Play Store URL |
| Footer “Coming soon” | → `/coming-soon` | Remove or change to “Download” |

**Signup save (source of truth):** `POST https://api.splitthewine.app/api/waitlist` upserts Postgres `split_the_wine.launch_notify` (`email`, `platforms`, `source`). The coming-soon page uses this path whenever the API answers.

**Netlify Forms is a fallback, not a second source of truth.** `marketing/coming-soon.html` keeps `data-netlify` so a no-JavaScript submit, a network/CORS failure, or an HTTP 5xx still lands in the Netlify form `app-notify`. Those submissions are **not** copied into `launch_notify`. There is no sync job. A 4xx from the API (bad email, rate limit, bad JSON) stays on the page and does not fall through — otherwise the limit could be skipped and the two lists would diverge on purpose. Before the launch email, export Netlify’s `app-notify` submissions and merge by email by hand.

### When you launch

- [ ] Replace badge `href="/coming-soon"` in `marketing/index.html` with production store URLs
- [ ] Confirm App Store Connect / Play Console public listing URLs
- [ ] Optional: keep `/coming-soon` for late joiners, or redirect it to the store
- [ ] Export or email everyone in `launch_notify` once
- [ ] Update privacy §6 if you stop collecting launch emails

---

## Other launch notes (optional)

- [ ] App Store / Play screenshots + description
- [ ] Privacy / support URLs still point at `www.splitthewine.app`
- [ ] Marketing hero CTA copy: “Coming soon” → “Download”

---

## Waitlist API host and CORS smoke

The coming-soon page does not hardcode an API origin. Netlify’s build writes `marketing/api-config.js` from `STW_API_BASE` (production default `https://api.splitthewine.app`). Signups still go to Railway `POST /api/waitlist` → Postgres `launch_notify`. Netlify Forms stays a no-JS / unreachable-API fallback. There is no sync from Netlify into the database.

How to set the host for production, staging, or local, and the OPTIONS/POST smoke checklist: [`marketing/README.md`](../marketing/README.md).
