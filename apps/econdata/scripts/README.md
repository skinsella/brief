# Build-time prefetchers

APIs that block CORS (or require auth) can't be called from the browser on
GitHub Pages. The fix is to fetch them at build time in Node and write the
result into `public/data/*.json`, then read that JSON from the SPA.

## How it runs

`package.json` wires the prefetcher into `npm run build`:

```
"build": "node scripts/fetch-imf-data.mjs && vite build"
```

The Pages workflow (`.github/workflows/deploy.yml`) also runs on a Monday
cron, so the data refreshes weekly even without a code push.

## Current prefetchers

| Script | Source | Output file | Cadence |
|---|---|---|---|
| `fetch-imf-data.mjs` | IMF DataMapper (WEO) | `public/data/imf-weo.json` | biannual (Apr / Oct) |

The IMF script now also pulls a **peer fiscal panel** (IRL + DEU + NLD + FRA + GBR + USA × GGXCNL_NGDP, GGXWDG_NGDP) which Peer Benchmarks and Public Finances pages can read cheaply without a second fetch.

## Adding a new prefetcher

1. Create `scripts/fetch-<source>-data.mjs` following the IMF template.
2. Write the output to `public/data/<source>.json`.
3. Prepend the script to the `build` command in `package.json`, e.g.
   `"build": "node scripts/fetch-imf-data.mjs && node scripts/fetch-<source>-data.mjs && vite build"`.
4. Consume the JSON from a page via `fetch('./data/<source>.json')` (Vite
   serves `public/` at the site root, so the relative path works both
   locally and on Pages).

### Candidate sources (flagged by the app audit)

These would be high-value additions but each has a gotcha — none is wired yet:

- **OECD Data Explorer** (`sdmx.oecd.org`) — supports CORS, but serves
  SDMX **2.0** JSON which the existing `src/services/oecd.js` parser does
  not yet understand (it was written for the 1.x shape). Prefetching at
  build time would sidestep the parser issue entirely.
- **Ember Electricity** (`api.ember-energy.org`) — free tier exists but
  requires an API key. Store it in a GitHub Actions secret
  (`EMBER_API_KEY`) and reference it as `process.env.EMBER_API_KEY` in
  the prefetcher.
- **ENTSO-E Transparency Platform** — free but token-gated. Same pattern:
  register, store token as `ENTSOE_API_KEY`, prefetch.
- **IMF BOP / DOT / FAS** — share the IMF DataMapper host, so they work
  from the existing `fetch-imf-data.mjs` pattern with different dataflow IDs.
- **Scraped national sources** (NTMA issuance, Revenue receipts, Fiscal
  Council forecast tables) — write Node scripts that parse the published
  HTML/PDF/XLSX into JSON. Prefer official open-data CSV where available.

## Design notes

- Keep the output JSON **small and stable**. Downstream pages should
  tolerate missing indicators gracefully (see the `result[code] = []`
  fallback in the IMF script).
- Always include `fetchedAt` at the top level so the UI can show a "last
  refreshed" label.
- Prefer idempotent scripts that overwrite the output file completely —
  avoids partial-update bugs when an API returns fewer series than before.
