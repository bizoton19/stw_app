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

**Signup save:** `POST https://api.splitthewine.app/api/waitlist` → Postgres `split_the_wine.launch_notify` (email, platforms, source).

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
