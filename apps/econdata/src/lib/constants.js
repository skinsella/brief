// API Base URLs
export const API_URLS = {
  CSO: 'https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset',
  ECB: 'https://data-api.ecb.europa.eu/service/data',
  EUROSTAT: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data',
  OECD: 'https://sdmx.oecd.org/public/rest/data',
  WORLD_BANK: 'https://api.worldbank.org/v2',
}

// CSO Dataset IDs
export const CSO_DATASETS = {
  CPI: 'CPM01',
  LABOUR_FORCE: 'QLF18',
  GDP: 'NQQ38',
  HOUSE_PRICES: 'HPM09',
  RETAIL_SALES: 'TSA09',
  PLANNING: 'BPA04',
}

// ECB Series Keys
export const ECB_SERIES = {
  HICP_IRELAND: 'ICP/M.IE.N.000000.4.ANR',
  EURIBOR_3M: 'FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA',
  EUR_USD: 'EXR/M.USD.EUR.SP00.A',
  MORTGAGE_RATE_IE: 'MIR/M.IE.B.A2A.A.R.A.2250.EUR.N',
}

// World Bank Indicators
export const WB_INDICATORS = {
  GDP_GROWTH: 'NY.GDP.MKTP.KD.ZG',
  INFLATION: 'FP.CPI.TOTL.ZG',
  UNEMPLOYMENT: 'SL.UEM.TOTL.ZS',
  TRADE_PCT_GDP: 'NE.TRD.GNFS.ZS',
}

// Source colors for badges and charts
export const SOURCE_COLORS = {
  cso: { bg: 'bg-sky-100', text: 'text-sky-800', chart: '#0ea5e9' },
  ecb: { bg: 'bg-amber-100', text: 'text-amber-800', chart: '#f59e0b' },
  eurostat: { bg: 'bg-indigo-100', text: 'text-indigo-800', chart: '#6366f1' },
  oecd: { bg: 'bg-emerald-100', text: 'text-emerald-800', chart: '#10b981' },
  worldbank: { bg: 'bg-rose-100', text: 'text-rose-800', chart: '#f43f5e' },
  cbi: { bg: 'bg-cyan-100', text: 'text-cyan-800', chart: '#06b6d4' },
  dof: { bg: 'bg-green-100', text: 'text-green-800', chart: '#22c55e' },
  wto: { bg: 'bg-blue-100', text: 'text-blue-800', chart: '#3b82f6' },
  imf: { bg: 'bg-amber-100', text: 'text-amber-800', chart: '#f59e0b' },
  eu_trade: { bg: 'bg-indigo-100', text: 'text-indigo-800', chart: '#6366f1' },
  esri: { bg: 'bg-teal-100', text: 'text-teal-800', chart: '#14b8a6' },
}

// Chart color palette
export const CHART_COLORS = [
  '#334155', '#0ea5e9', '#f59e0b', '#6366f1',
  '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4',
]

// Countdown events — seed list. Past events are filtered out at render
// time via `upcomingEvents()` below, so the dashboard never displays a
// stale entry. When an item fires, replace it with the next instance
// rather than editing in place so the history survives in git.
//
// ECB monetary-policy meeting dates below are taken from the ECB
// Governing Council calendar (decision day of each two-day meeting):
// https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
export const COUNTDOWN_EVENTS = [
  // Irish political / fiscal calendar
  { title: 'Budget 2027', targetDate: '2026-10-13' },
  { title: 'Summer Economic Statement 2026', targetDate: '2026-07-15' },
  { title: 'Ireland General Election (latest)', targetDate: '2029-11-17' },

  // ECB Governing Council monetary-policy decisions, remainder of 2026
  { title: 'ECB rate decision', targetDate: '2026-04-30' },
  { title: 'ECB rate decision', targetDate: '2026-06-11' },
  { title: 'ECB rate decision', targetDate: '2026-07-23' },
  { title: 'ECB rate decision', targetDate: '2026-09-10' },
  { title: 'ECB rate decision', targetDate: '2026-10-29' },
  { title: 'ECB rate decision', targetDate: '2026-12-17' },

  // EU-level
  { title: 'European Council (summer)', targetDate: '2026-06-25' },
  { title: 'European Council (autumn)', targetDate: '2026-10-22' },

  // International flagship releases
  { title: 'OECD Economic Outlook (summer)', targetDate: '2026-06-10' },
  { title: 'OECD Economic Outlook (autumn)', targetDate: '2026-11-25' },
  { title: 'IMF World Economic Outlook (Oct)', targetDate: '2026-10-14' },
]

/**
 * Returns events still in the future (inclusive of today), sorted
 * ascending by target date. Use this in components instead of reading
 * COUNTDOWN_EVENTS directly so the dashboard self-heals as events pass.
 */
export function upcomingEvents(events = COUNTDOWN_EVENTS, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return events
    .filter(e => {
      const t = new Date(e.targetDate)
      return !Number.isNaN(t.getTime()) && t >= today
    })
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
}

// ──────────────────────────────────────────────────────────────────────
// Reports — every URL is a real, verifiable publication landing page.
// No fabricated titles, dates, or summary bullet points.
// ──────────────────────────────────────────────────────────────────────

export const LATEST_REPORTS = [
  {
    title: 'CSO Quarterly National Accounts',
    source: 'cso',
    url: 'https://www.cso.ie/en/statistics/nationalaccounts/quarterlynationalaccounts/',
    description: 'Quarterly GDP, GNP, GNI* and Modified Domestic Demand for Ireland.',
  },
  {
    title: 'CSO Labour Force Survey',
    source: 'cso',
    url: 'https://www.cso.ie/en/statistics/labourmarket/labourforcesurvey/',
    description: 'Employment, unemployment and labour force participation statistics.',
  },
  {
    title: 'CSO Consumer Price Index',
    source: 'cso',
    url: 'https://www.cso.ie/en/statistics/prices/consumerpriceindex/',
    description: 'Monthly CPI measuring the change in prices of consumer goods and services.',
  },
  {
    title: 'CSO Monthly Unemployment',
    source: 'cso',
    url: 'https://www.cso.ie/en/statistics/labourmarket/monthlyunemployment/',
    description: 'Monthly seasonally adjusted unemployment estimates from the CSO.',
  },
  {
    title: 'CSO Retail Sales Index',
    source: 'cso',
    url: 'https://www.cso.ie/en/statistics/servicesandenterprises/retailsalesindex/',
    description: 'Monthly index of retail sales volume and value.',
  },
  {
    title: 'Central Bank Quarterly Bulletin',
    source: 'cbi',
    url: 'https://www.centralbank.ie/publication/quarterly-bulletins',
    description: 'Economic analysis, forecasts and financial stability commentary from the CBI.',
  },
  {
    title: 'Central Bank Economic Letters',
    source: 'cbi',
    url: 'https://www.centralbank.ie/publication/economic-letters',
    description: 'Short research papers on current economic and financial topics.',
  },
  {
    title: 'Department of Finance Publications',
    source: 'dof',
    url: 'https://www.gov.ie/en/collection/budget/',
    description: 'Budget documents, Stability Programme Updates and fiscal publications.',
  },
  {
    title: 'OECD Economic Surveys: Ireland',
    source: 'oecd',
    url: 'https://www.oecd.org/en/publications/oecd-economic-surveys-ireland_19990294.html',
    description: 'Periodic assessment of the Irish economy with policy recommendations.',
  },
  {
    title: 'OECD Economic Outlook',
    source: 'oecd',
    url: 'https://www.oecd.org/en/publications/oecd-economic-outlook_16097408.html',
    description: 'Biannual global and country-level economic projections and analysis.',
  },
  {
    title: 'ESRI Quarterly Economic Commentary',
    source: 'esri',
    url: 'https://www.esri.ie/publications?type=Quarterly%20Economic%20Commentary',
    description: 'Quarterly assessment of the Irish economy with short-term forecasts from the ESRI.',
  },
  {
    title: 'ESRI Research Bulletins',
    source: 'esri',
    url: 'https://www.esri.ie/publications?type=Research%20Bulletin',
    description: 'Short summaries of ESRI working papers on economic and social policy.',
  },
  {
    title: 'Eurostat News Releases',
    source: 'eurostat',
    url: 'https://ec.europa.eu/eurostat/web/main/news/news-releases',
    description: 'Latest statistical releases from Eurostat covering the EU and euro area.',
  },
]

export const TRADE_REPORTS = [
  {
    title: 'WTO World Trade Statistical Review',
    source: 'wto',
    url: 'https://www.wto.org/english/res_e/statis_e/wts_e.htm',
    description: 'Annual overview of global merchandise and services trade developments.',
  },
  {
    title: 'IMF World Economic Outlook',
    source: 'imf',
    url: 'https://www.imf.org/en/Publications/WEO',
    description: 'Biannual global growth projections, trade forecasts and risk assessment.',
  },
  {
    title: 'EU Trade Policy',
    source: 'eu_trade',
    url: 'https://policy.trade.ec.europa.eu/',
    description: 'European Commission trade agreements, statistics and policy updates.',
  },
]

export const HOUSING_REPORTS = [
  {
    title: 'CSO Residential Property Price Index',
    source: 'cso',
    url: 'https://www.cso.ie/en/statistics/prices/residentialpropertypriceindex/',
    description: 'Monthly national and regional house price indices for Ireland.',
  },
  {
    title: 'Central Bank Financial Stability Review',
    source: 'cbi',
    url: 'https://www.centralbank.ie/publication/financial-stability-review',
    description: 'Assessment of risks to financial stability including mortgage and property markets.',
  },
  {
    title: 'ESRI Housing Research',
    source: 'esri',
    url: 'https://www.esri.ie/research/housing',
    description: 'Research publications on housing supply, affordability and policy from the ESRI.',
  },
]

// Data sources for status page
export const DATA_SOURCES = [
  { name: 'Eurostat', provider: 'eurostat', endpoint: API_URLS.EUROSTAT, frequency: 'monthly/quarterly', testPath: '/prc_hicp_manr?format=JSON&geo=IE&coicop=CP00&sinceTimePeriod=2025-01' },
  { name: 'Central Statistics Office', provider: 'cso', endpoint: API_URLS.CSO, frequency: 'monthly', testPath: '/CPM01/JSON-stat/2.0/en' },
  { name: 'European Central Bank', provider: 'ecb', endpoint: API_URLS.ECB, frequency: 'daily', testPath: '/EXR/M.USD.EUR.SP00.A?format=jsondata' },
  { name: 'World Bank', provider: 'worldbank', endpoint: API_URLS.WORLD_BANK, frequency: 'yearly', testPath: '/country/IRL/indicator/NY.GDP.MKTP.CD?format=json&per_page=1&date=2023' },
  { name: 'IMF DataMapper', provider: 'imf', endpoint: 'https://www.imf.org/external/datamapper/api/v1', frequency: 'biannual (WEO)', testPath: '/NGDP_RPCH/IRL' },
  { name: 'OECD', provider: 'oecd', endpoint: API_URLS.OECD, frequency: 'quarterly', testPath: '' },
  { name: 'Central Bank of Ireland', provider: 'cbi', endpoint: 'https://www.centralbank.ie', frequency: 'quarterly', testPath: '' },
]
