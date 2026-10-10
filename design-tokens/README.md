# Design tokens

Canonical card theme colors live in [`card-theme.json`](card-theme.json).

```bash
npm run theme:generate   # write web + mobile themes.ts and patch globals.css
npm run theme:check      # regenerate and fail if outputs drift from git
```

Do not hand-edit `src/lib/card-theme/themes.ts` or `apps/mobile/src/lib/card-theme/themes.ts`.
