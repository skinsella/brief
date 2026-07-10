# The Brief

**Live site: https://stephenkinsella.net/brief/**

A single, live-updating economic and media briefing, consolidating seven
previously separate dashboards into one site with one design system.

## Sections

| Path | What | Updates |
|---|---|---|
| `/` | Landing dashboard: morning note + headline KPIs | on every pipeline run |
| `/media/` | Simon Harris / Fine Gael media monitor | every 30 minutes |
| `/economy/` | Weekly Irish economic indicators (IGEES-style) | Saturdays |
| `/econ/` | Interactive data explorer (React, live CSO/Eurostat/ECB/IMF) | Mondays + on push |
| `/energy/` | Oil & gas prices, Irish heating oil, sovereign bonds | twice daily, weekdays |
| `/tax/` | Income tax / USC costing model (Ready Reckoner 2026) | static |
| `/spend/` | Fiscal incidence — who pays, who benefits | static |
| `/jobs/` | Irish job market treemap with AI exposure | monthly |

## How it works

- `docs/` is the published site (GitHub Pages, deploy-from-branch `main:/docs`).
- `pipelines/` hold the Python data pipelines; each GitHub Actions workflow
  runs one, rebuilds `docs/data/briefing.json` (the landing payload + morning
  note), and commits via `.github/actions/commit-publish` (rebase + retry so
  concurrent crons never lose a commit).
- `apps/econdata/` is the React source for `/econ/`; CI builds and commits the
  output so data-only commits never need Node.
- One design system: `docs/assets/brief.css` (tokens) + `docs/assets/header.js`
  (`<brief-header>`). Light/dark via `html[data-theme]`.

## Secrets required (Settings → Secrets → Actions)

- `EIA_API_KEY` — energy prices (register free at eia.gov/opendata)
- `FRED_API_KEY` — bond yields (rotate: the old key was exposed in the
  oil-gas-dashboard repo history and must be deactivated)
- `OPENROUTER_API_KEY` — jobs pipeline AI-exposure scoring
- `ANTHROPIC_API_KEY` — optional, polishes the weekly morning note

## Consolidated from

[HMonitor](https://github.com/skinsella/HMonitor) ·
[weekly-economic-report](https://github.com/skinsella/weekly-economic-report) ·
[EconDataApp](https://github.com/skinsella/EconDataApp) ·
[oil-gas-dashboard](https://github.com/skinsella/oil-gas-dashboard) ·
[TaxModel](https://github.com/skinsella/TaxModel) ·
[TaxSpend](https://github.com/skinsella/TaxSpend) ·
[irishjobs](https://github.com/skinsella/irishjobs)
