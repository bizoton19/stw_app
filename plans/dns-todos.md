# DNS TODOs — **HIGH PRIORITY**

Custom hostname for the Railway Next.js app (API + claim board + settle).

**Chosen origin:** `https://api.splitthewine.app`  
**Dev / RSVP staging:** `https://apidev.splitthewine.app` → Railway service `api-dev` (`DB_SCHEMA=split_the_wine_dev`)  
**Landing (unchanged):** `https://www.splitthewine.app` (Netlify / marketing)  
**Temporary Railway URL (retire after cutover):** `https://api-production-72488.up.railway.app`  
**Dev Railway URL:** `https://api-dev-production-c2d1.up.railway.app`

One Railway service serves `/api/*` and `/r/[id]` — no separate proxy. DNS + Railway custom domain is enough.

---

## Dev API (`apidev`)

- [x] Railway service **`api-dev`** (same Postgres, `DB_SCHEMA=split_the_wine_dev`)
- [x] Custom domain `apidev.splitthewine.app` + Cloudflare `CNAME` → Railway edge target
- [ ] Cert **Active** / DNS verified (keep DNS grey-cloud until Railway shows verified, then orange-cloud like `api`)
- [x] Env: `DB_SCHEMA=split_the_wine_dev`, `OPENROUTER_HTTP_REFERER=https://apidev.splitthewine.app`, `ALLOWED_ORIGINS` includes apidev + www
- [ ] Mobile Expo Go / preview builds: `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_SHARE_URL` → `https://apidev.splitthewine.app` (use railway.app hostname until cert is ready)
- [x] **GitHub auto-deploy (no Actions needed):**
  - `main` → Railway service **`api`** (prod / `api.splitthewine.app`)
  - `plan-an-outing` → Railway service **`api-dev`** (dev / `apidev.splitthewine.app`)
  - Push to the branch deploys that service only. Merge to `main` when ready for prod.

---

## P0 — Do before next friend / TestFlight push

- [x] **DNS:** Add `CNAME` record for `api` → Railway custom-domain target (copy from Railway UI when adding the domain). TTL low (e.g. 300) until verified.
- [x] **Railway:** Service → **Settings → Networking / Custom Domain** → add `api.splitthewine.app`. Wait for certificate **Active**.
- [x] **Railway env** (replace old `*.up.railway.app` values):
  - [x] `OPENROUTER_HTTP_REFERER=https://api.splitthewine.app`
  - [x] `ALLOWED_ORIGINS=https://api.splitthewine.app,https://www.splitthewine.app` (add other browser origins only if needed)
- [x] **Smoke-test custom domain:**
  - [x] `GET https://api.splitthewine.app/api/receipts/demo` (or a real open receipt) → 200
  - [ ] Open `https://api.splitthewine.app/r/<receiptId>` in a phone browser → join + claim
  - [x] HTTPS padlock / no mixed-content warnings
- [x] **Mobile EAS** (`apps/mobile/eas.json` + rebuild):
  - [x] `EXPO_PUBLIC_API_URL=https://api.splitthewine.app`
  - [x] `EXPO_PUBLIC_SHARE_URL=https://api.splitthewine.app`
  - [ ] New iOS build so TestFlight friends get share links on the custom host
- [x] **Share-link convention:** claim URLs are `https://api.splitthewine.app/r/<id>` (same origin as API).

## P1 — Cleanup after cutover

- [ ] Confirm old Railway hostname still works or redirect (optional; can leave as alias).
- [ ] Update `plans/railway-security.md` / `LIVETEST-TODO.md` checkboxes once live.
- [ ] Marketing / privacy copy: if they mention the API host, use `api.splitthewine.app` only.
- [ ] Do **not** put Netlify in front of Railway for `/r/*` — keep marketing on `www`, app on `api`.

## Out of scope (unless we rename later)

- `claim.splitthewine.app` — rejected for now; `api.` is the product hostname.
- Apex `splitthewine.app` stays marketing redirect → `www` (existing Netlify rules).

---

## Quick Railway + DNS checklist

```text
1. Registrar / DNS for splitthewine.app
   api  CNAME  <railway-provided-target>

2. Railway → Custom Domain → api.splitthewine.app → wait for cert

3. railway variables set \
     OPENROUTER_HTTP_REFERER=https://api.splitthewine.app \
     ALLOWED_ORIGINS=https://api.splitthewine.app,https://www.splitthewine.app

4. eas.json → EXPO_PUBLIC_API_URL + EXPO_PUBLIC_SHARE_URL = https://api.splitthewine.app
5. eas build -p ios …
```
