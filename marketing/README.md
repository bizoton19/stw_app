# Marketing site (Netlify)

Static HTML in this folder. Netlify base directory is `marketing/`. The claim API stays on Railway. This site only calls it from the coming-soon waitlist form.

## API base (`STW_API_BASE`)

Netlify does not expose environment variables to static HTML at request time. The build command in `netlify.toml` runs `node inject-api-base.mjs`, which writes `api-config.js`:

```js
window.STW_API_BASE = "https://api.example";
```

`coming-soon.html` loads that file and posts to `{origin}/api/waitlist`. The page script has no API host of its own. There is no query-string override (that would let a link send signup emails to some other server).

The committed `api-config.js` is the production default, so a publish that skips the build still talks to Railway. A real Netlify build rewrites the file before publish.

### Production (default)

`netlify.toml` sets:

```toml
STW_API_BASE = "https://api.splitthewine.app"
```

Leave this unless you are pointing the site at another API. Values set in the Netlify UI override `netlify.toml`.

### Staging, deploy previews, or another host

1. Netlify → Site configuration → Environment variables → add `STW_API_BASE`.
2. Scope it to the context you mean (Production, Deploy Previews, or a branch). Example: `https://your-staging-api.up.railway.app` — origin only, no path or trailing route.
3. Leave the UI build command empty so `netlify.toml` runs `node inject-api-base.mjs`. If the UI already has a command, set it to that same script (the UI overrides the file).
4. Deploy, then open `https://<that-site>/api-config.js` and confirm `window.STW_API_BASE`.

A deploy preview’s browser origin is a `*.netlify.app` host. Railway will not allow that origin until you add it to `ALLOWED_ORIGINS`. Until then the browser signup falls through to Netlify Forms. Curl smoke below does not depend on the preview origin.

### Local

```bash
STW_API_BASE=http://127.0.0.1:43147 node marketing/inject-api-base.mjs
```

Serve this folder (`npx serve marketing`, or `netlify dev` from here) and open `/coming-soon.html`. With `ALLOWED_ORIGINS` unset, the local API reflects the page’s origin. Restore the production file before you commit it: `node marketing/inject-api-base.mjs` with `STW_API_BASE` unset.

## CORS + waitlist smoke

Railway is the source of truth: `POST /api/waitlist` upserts Postgres `split_the_wine.launch_notify`. Netlify Forms (`app-notify`) is only the no-JavaScript submit, or the fallback when the browser cannot reach the API. Those Netlify rows are not copied into Postgres.

`ALLOWED_ORIGINS` on Railway must include the marketing origin exactly (`https://www.splitthewine.app`, no path, no trailing slash). Native apps ignore CORS. The browser page does not.

- [ ] Railway → Variables → `ALLOWED_ORIGINS` includes `https://www.splitthewine.app`. Production example: `https://api.splitthewine.app,https://www.splitthewine.app`. Add a staging marketing origin only if that site should call the API from a browser.
- [ ] `https://www.splitthewine.app/api-config.js` sets `window.STW_API_BASE` to the Railway origin you intend.
- [ ] Preflight from the marketing origin returns 204 and echoes that origin:

```bash
curl -sI -X OPTIONS "https://api.splitthewine.app/api/waitlist" \
  -H "Origin: https://www.splitthewine.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Expect `204` (or `200`) and `access-control-allow-origin: https://www.splitthewine.app`.

- [ ] The same preflight with `Origin: https://evil.example` does not echo `https://evil.example` when `ALLOWED_ORIGINS` is set.
- [ ] Happy-path signup. This writes a real row when `DATABASE_URL` is set — use an address you control:

```bash
curl -sS -D - -o /tmp/stw-waitlist-body.json \
  -X POST "https://api.splitthewine.app/api/waitlist" \
  -H "Origin: https://www.splitthewine.app" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","platforms":["ios"],"source":"coming-soon"}'
```

Expect HTTP 200, body `{"ok":true,"stored":"db"}` (`"stored":"memory"` only if that API has no Postgres), and `access-control-allow-origin: https://www.splitthewine.app`.

- [ ] On `https://www.splitthewine.app/coming-soon`, submit that kind of address and see “You’re on the list.”
