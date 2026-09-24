# DNS TODOs — **HIGH PRIORITY**

Custom hostname for the Railway Next.js app (API + claim board + settle).

**Chosen origin:** `https://api.splitthewine.app`  
**Landing (unchanged):** `https://www.splitthewine.app` (Netlify / marketing)  
**Temporary Railway URL (retire after cutover):** `https://api-production-72488.up.railway.app`

One Railway service serves `/api/*` and `/r/[id]` — no separate proxy. DNS + Railway custom domain is enough.

---

## P0 — Do before next friend / TestFlight push

- [ ] **DNS:** Add `CNAME` record for `api` → Railway custom-domain target (copy from Railway UI when adding the domain). TTL low (e.g. 300) until verified.
- [ ] **Railway:** Service → **Settings → Networking / Custom Domain** → add `api.splitthewine.app`. Wait for certificate **Active**.
- [ ] **Railway env** (replace old `*.up.railway.app` values):
  - [ ] `OPENROUTER_HTTP_REFERER=https://api.splitthewine.app`
  - [ ] `ALLOWED_ORIGINS=https://api.splitthewine.app,https://www.splitthewine.app` (add other browser origins only if needed)
- [ ] **Smoke-test custom domain:**
  - [ ] `GET https://api.splitthewine.app/api/receipts/demo` (or a real open receipt) → 200
  - [ ] Open `https://api.splitthewine.app/r/<receiptId>` in a phone browser → join + claim
  - [ ] HTTPS padlock / no mixed-content warnings
- [ ] **Mobile EAS** (`apps/mobile/eas.json` + rebuild):
  - [ ] `EXPO_PUBLIC_API_URL=https://api.splitthewine.app`
  - [ ] `EXPO_PUBLIC_SHARE_URL=https://api.splitthewine.app`
  - [ ] New iOS build so TestFlight friends get share links on the custom host
- [ ] **Share-link convention:** claim URLs are `https://api.splitthewine.app/r/<id>` (same origin as API).

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
