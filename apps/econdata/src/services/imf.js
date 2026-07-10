/**
 * IMF World Economic Outlook data service.
 *
 * The IMF DataMapper API does NOT support CORS from the browser, so
 * we load pre-fetched data from /data/imf-weo.json (generated at
 * build time by `node scripts/fetch-imf-data.mjs`).
 *
 * WEO data only changes twice a year (April & October), so pre-fetching
 * is the correct approach for a static-hosted SPA.
 */

let _cache = null

async function loadWEOData() {
  if (_cache) return _cache

  const url = `${import.meta.env.BASE_URL}data/imf-weo.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load IMF data: ${res.status}`)
  const json = await res.json()
  _cache = json.indicators
  return _cache
}

/**
 * Get IMF WEO data for a single indicator.
 * Returns { period, value, forecast }[] sorted by period.
 */
export async function fetchIMFData(indicator, _country = 'IRL') {
  const data = await loadWEOData()
  return data[indicator] || []
}

/**
 * Fetch multiple IMF indicators in parallel.
 * Returns an object keyed by indicator code.
 */
export async function fetchIMFMultiple(indicators, country = 'IRL') {
  const data = await loadWEOData()
  const out = {}
  for (const ind of indicators) {
    if (data[ind] && data[ind].length > 0) {
      out[ind] = data[ind]
    }
  }
  return out
}

/**
 * Get global GDP growth comparison data.
 * Returns an object keyed by country code (CHN, EURO, GBR, USA, WORLD).
 */
export async function fetchGlobalGrowth() {
  const url = `${import.meta.env.BASE_URL}data/imf-weo.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load IMF data: ${res.status}`)
  const json = await res.json()
  return json.globalGrowth || {}
}

export const GLOBAL_GROWTH_LABELS = {
  CHN: 'China',
  EURO: 'Euro Area',
  GBR: 'United Kingdom',
  USA: 'United States',
  ADVEC: 'Advanced Economies',
}

export const GLOBAL_GROWTH_COLORS = {
  CHN: '#f59e0b',
  EURO: '#3b82f6',
  GBR: '#10b981',
  USA: '#6366f1',
  ADVEC: '#94a3b8',
}

// WEO indicator codes
export const IMF_INDICATORS = {
  GDP_GROWTH: 'NGDP_RPCH',
  INFLATION: 'PCPIPCH',
  UNEMPLOYMENT: 'LUR',
  FISCAL_BALANCE: 'GGXCNL_NGDP',
  GOVT_DEBT: 'GGXWDG_NGDP',
  CURRENT_ACCOUNT: 'BCA_NGDPD',
}

export const IMF_LABELS = {
  NGDP_RPCH: 'GDP Growth',
  PCPIPCH: 'Inflation',
  LUR: 'Unemployment',
  GGXCNL_NGDP: 'Fiscal Balance',
  GGXWDG_NGDP: 'Government Debt',
  BCA_NGDPD: 'Current Account',
}

export const IMF_UNITS = {
  NGDP_RPCH: '%',
  PCPIPCH: '%',
  LUR: '%',
  GGXCNL_NGDP: '% GDP',
  GGXWDG_NGDP: '% GDP',
  BCA_NGDPD: '% GDP',
}
