# Railway deploy & API security plan

Status: friend-test deploy target. Harden before any public/wider beta.

## What “unsecure” means today

The API is a **capability-URL** system: knowing a receipt id is enough to join and claim. That is intentional for dinner-table sharing. Risks appear when the **base URL is public** and strangers (or scrapers) can hit it.

### If we ship to Railway with no extra controls

| Severity | Risk | What happens |
|---|---|---|
| **High** | Unauthenticated vision parse | Anyone who creates a draft can `POST /parse` with images and burn **OpenRouter** credits. Host token was sent by clients but not required by the server. |
| **High** | No rate limits | Unlimited create / parse / claim / SSE → cost + DoS. |
| **High** | CORS reflects any Origin | Any website can call the API from a browser. |
| **High** | In-memory store | Redeploy/restart wipes all tabs. **>1 Railway replica** splits state (claims/SSE break). Memory grows with no TTL. |
| **Med** | Shared claim link leaks PII | Public receipt JSON includes guest **names/contacts** and host **payment handles**. Fine among friends; bad if a link leaks. |
| **Med** | Hardcoded `demo` / `demo-host` | Stranger can edit/finalize the seeded demo receipt. |
| **Med** | Large upload buffering | Image is fully buffered before the 8 MB check → memory spike. |
| **Low** | OpenRouter key in client | **Not** an issue today — key is server-only (`src/lib/vision.ts` + `server-only`). |
| **Low** | Cleartext mobile ATS | OK for LAN; friend builds must use **HTTPS** Railway URL. |

### What a stranger can do if they find the Railway URL

- Create drafts and get a host token  
- Burn OpenRouter on parse (until we require host auth)  
- Open `/r/demo` and host it with `demo-host` (until demo is gated)  
- Claim on any **open** receipt whose id they know  
- **Cannot** steal the OpenRouter key from the app bundle  
- **Cannot** unclaim someone else’s claims without that claim’s owner token  

**Friend-test judgment:** Acceptable **if** the URL stays private, OpenRouter has a spend cap, we run **one** Railway instance, and we land the quick hardening below. Not acceptable for an open App Store audience.

---

## Phase 0 — Before first Railway deploy (do now)

1. **Require host token on `/api/receipts/:id/parse`**  
2. **Gate demo seed** behind `ALLOW_DEMO=1` (off in production by default)  
3. **CORS allowlist** via `ALLOWED_ORIGINS` (comma-separated); native apps don’t need browser CORS  
4. **Reject oversized bodies early** (`Content-Length` / hard max before buffering)  
5. **Bind `PORT`** from Railway; set secrets: `OPENROUTER_API_KEY`, `OPENROUTER_HTTP_REFERER`, `ALLOWED_ORIGINS`  
6. **Replicas = 1** on Railway while store is in-memory  
7. Document: redeploys wipe data  

## Phase 1 — Closed friend TestFlight (same week)

1. Deploy HTTPS API; set mobile `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SHARE_URL` to that origin for EAS builds  
2. Cap OpenRouter spend + enable usage alerts  
3. Simple rate limit: create ≤ N/min/IP, parse ≤ M/min/IP+host, claims ≤ K/min/IP  
4. Share claim links only in private chats; tell friends data resets on redeploy  
5. Optional: `PARSE_STUB_ONLY=1` kill-switch if credits spike  

## Phase 2 — Wider beta / App Store

1. **Persistent store** (Postgres) + object storage for receipt images  
2. Longer unguessable receipt ids; optional claim PIN / invite code  
3. Redact contacts / pay handles from world-readable GET where possible; show pay info only after join  
4. Tighten mobile ATS (drop global cleartext; keep local-network for dev)  
5. Proper CORS allowlist for production web origin only  
6. Remove or randomize demo entirely  
7. Observability: structured logs (no tokens), error tracking, OpenRouter budget alarms  
8. Privacy policy URL (camera/photos) for Apple  

## Phase 3 — Real product

1. Accounts / device binding for host tokens  
2. Abuse detection, WAF / Railway edge limits  
3. Backups, multi-region strategy, SSE fan-out that works with >1 instance  
4. Formal threat model for payment-handle handling  

---

## Railway checklist

```bash
# one-time (if CLI session expired)
railway login

# from repo root
railway init          # or link existing project
railway variables set OPENROUTER_API_KEY=sk-or-...
railway variables set OPENROUTER_HTTP_REFERER=https://YOUR-APP.up.railway.app
railway variables set ALLOWED_ORIGINS=https://YOUR-APP.up.railway.app
# Shared Postgres (reuse instance; this app uses schema `split_the_wine` only)
railway variables set DATABASE_URL=postgresql://...
# leave ALLOW_DEMO unset in production
railway up
```

Mobile (EAS / `.env` for builds):

```bash
EXPO_PUBLIC_API_URL=https://YOUR-APP.up.railway.app
EXPO_PUBLIC_SHARE_URL=https://YOUR-APP.up.railway.app
```

---

## Success criteria for friend test

- [ ] HTTPS API responds; OpenRouter parse works with host token  
- [ ] Unauthenticated parse returns 403  
- [ ] Demo routes absent unless `ALLOW_DEMO=1`  
- [ ] Two phones can host + claim against the same Railway URL  
- [ ] Friends understand: redeploy = empty tables; don’t post the API URL publicly  
