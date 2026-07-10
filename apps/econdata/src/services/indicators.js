import { fetchEurostatData, fetchEurostatMultiGeo, fetchEurostatMultiDim } from './eurostat'
import { fetchWorldBankData } from './worldbank'
import { fetchCSOSeries, fetchCSOData } from './cso'

/**
 * Centralised indicator fetchers.
 * Each function returns an array of { period, value } from a real, verifiable source.
 * No fabricated data — if the API fails, the caller gets an error.
 */

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMonth(p) {
  const m = p.match(/(\d{4})[M-](\d{2})/)
  if (m) return `${MONTH_NAMES[parseInt(m[2],10)-1]} ${m[1]}`
  return p
}

function fmtQuarter(p) {
  const m = p.match(/(\d{4})[- ]?Q(\d)/)
  if (m) return `Q${m[2]} ${m[1]}`
  return p
}

function round1(v) {
  return Math.round(v * 10) / 10
}

function round2(v) {
  return Math.round(v * 100) / 100
}

// ── GDP Growth (YoY %, quarterly) ── Eurostat namq_10_gdp ──────────────
export async function fetchGDPGrowth() {
  const data = await fetchEurostatData('namq_10_gdp', {
    geo: 'IE',
    unit: 'CLV_PCH_SM',
    s_adj: 'SCA',
    na_item: 'B1GQ',
    sinceTimePeriod: '2020-Q1',
  })
  return data.map(d => ({ period: fmtQuarter(d.period), value: round1(d.value) }))
}

// ── Unemployment Rate (monthly %, SA) ── Eurostat une_rt_m ─────────────
export async function fetchUnemploymentRate() {
  const data = await fetchEurostatData('une_rt_m', {
    geo: 'IE',
    age: 'TOTAL',
    sex: 'T',
    unit: 'PC_ACT',
    s_adj: 'SA',
    sinceTimePeriod: '2022-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// ── Youth Unemployment (under 25, monthly %, SA) ── Eurostat une_rt_m ──
export async function fetchYouthUnemployment() {
  const data = await fetchEurostatData('une_rt_m', {
    geo: 'IE',
    age: 'Y_LT25',
    sex: 'T',
    unit: 'PC_ACT',
    s_adj: 'SA',
    sinceTimePeriod: '2022-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// ── HICP Inflation (annual rate of change, monthly) ── Eurostat ei_cphi_m ──
// Note: we use `ei_cphi_m` (Economic Indicators: HICP monthly) rather than
// the legacy `prc_hicp_manr`. The legacy dataset was frozen at the 2025
// vintage (label "(1997-2025)", last updated Feb 2026, data ends Dec 2025).
// `ei_cphi_m` is kept current (updated ~mid-month) with:
//   - unit=RT12   annual rate of change (YoY)
//   - unit=RT1    monthly rate of change
//   - unit=HICP2025  index, 2025=100
//   - indic=TOTAL, CP-HI01..CP-HI13, CP-HIE, CP-HIF, CP-HIS, CP-HIIGXE,
//     CP-HI00XEFU (core), CP-HI00XEF (super-core), etc.
export async function fetchHICPInflation() {
  const data = await fetchEurostatData('ei_cphi_m', {
    geo: 'IE', indic: 'TOTAL', unit: 'RT12',
    sinceTimePeriod: '2022-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// ── House Price Index (quarterly, 2015=100) ── Eurostat prc_hpi_q ──────
export async function fetchHousePriceIndex() {
  const data = await fetchEurostatData('prc_hpi_q', {
    geo: 'IE',
    purchase: 'TOTAL',
    unit: 'I15_Q',
    sinceTimePeriod: '2018-Q1',
  })
  return data.map(d => ({ period: fmtQuarter(d.period), value: round1(d.value) }))
}

// ── Fiscal ratios as % of GNI (not GDP) ── Eurostat ────────────────────
export async function fetchFiscalAsPercentGNI() {
  const [gniRaw, debtData, balData] = await Promise.all([
    fetchWorldBankData('IRL', 'NY.GNP.MKTP.CN', 2015, 2025),
    fetchEurostatData('gov_10dd_edpt1', {
      geo: 'IE', na_item: 'GD', sector: 'S13', unit: 'MIO_EUR', sinceTimePeriod: '2015',
    }),
    fetchEurostatData('gov_10dd_edpt1', {
      geo: 'IE', na_item: 'B9', sector: 'S13', unit: 'MIO_EUR', sinceTimePeriod: '2015',
    }),
  ])

  const gniMap = new Map(gniRaw.map(d => [d.period, d.value / 1e6]))

  const debtPctGNI = debtData
    .filter(d => gniMap.has(d.period) && gniMap.get(d.period) > 0)
    .map(d => ({ period: d.period, value: round1((d.value / gniMap.get(d.period)) * 100) }))

  const balPctGNI = balData
    .filter(d => gniMap.has(d.period) && gniMap.get(d.period) > 0)
    .map(d => ({ period: d.period, value: round1((d.value / gniMap.get(d.period)) * 100) }))

  return { debtPctGNI, balPctGNI }
}

// Keep the old GDP-based versions as fallbacks
export async function fetchGovBalance() {
  const data = await fetchEurostatData('gov_10dd_edpt1', {
    geo: 'IE', na_item: 'B9', sector: 'S13', unit: 'PC_GDP', sinceTimePeriod: '2015',
  })
  return data.map(d => ({ period: d.period, value: round1(d.value) }))
}

export async function fetchGovDebt() {
  const data = await fetchEurostatData('gov_10dd_edpt1', {
    geo: 'IE', na_item: 'GD', sector: 'S13', unit: 'PC_GDP', sinceTimePeriod: '2015',
  })
  return data.map(d => ({ period: d.period, value: round1(d.value) }))
}

// ── Trade as % of GDP (annual) ── World Bank ───────────────────────────
export async function fetchTradeToGDP() {
  const data = await fetchWorldBankData('IRL', 'NE.TRD.GNFS.ZS', 2010, 2025)
  return data.map(d => ({ period: d.period, value: round1(d.value) }))
}

// ── GDP per capita (current US$, annual) ── World Bank ─────────────────
export async function fetchGDPPerCapita() {
  const data = await fetchWorldBankData('IRL', 'NY.GDP.PCAP.CD', 2010, 2025)
  return data.map(d => ({ period: d.period, value: Math.round(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// NEW INDICATORS
// ═══════════════════════════════════════════════════════════════════════

// ── Bond Yields (10-year Irish govt, monthly %) ── Eurostat irt_lt_mcby_m
export async function fetchBondYields() {
  const data = await fetchEurostatData('irt_lt_mcby_m', {
    geo: 'IE',
    int_rt: 'MCBY',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round2(d.value) }))
}

// ── Euro Area Short-Term Rates (3-month, monthly %) ── Eurostat irt_st_m
export async function fetchEuroAreaRates() {
  const data = await fetchEurostatData('irt_st_m', {
    geo: 'EA',
    int_rt: 'IRT_M3',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round2(d.value) }))
}

// ── Government Interest Expenditure (% GDP, annual) ── Eurostat gov_10dd_edpt1
export async function fetchDebtServiceCosts() {
  const data = await fetchEurostatData('gov_10dd_edpt1', {
    geo: 'IE',
    na_item: 'D41PAY',
    sector: 'S13',
    unit: 'PC_GDP',
    sinceTimePeriod: '2015',
  })
  return data.map(d => ({ period: d.period, value: round1(d.value) }))
}

// ── Government Interest Expenditure (MIO_EUR, annual) ── Eurostat
export async function fetchDebtServiceAbsolute() {
  const data = await fetchEurostatData('gov_10dd_edpt1', {
    geo: 'IE',
    na_item: 'D41PAY',
    sector: 'S13',
    unit: 'MIO_EUR',
    sinceTimePeriod: '2015',
  })
  return data.map(d => ({ period: d.period, value: Math.round(d.value) }))
}

// ── Current Account Balance (quarterly, MIO_EUR) ── Eurostat bop_c6_q
export async function fetchCurrentAccount() {
  const data = await fetchEurostatData('bop_c6_q', {
    geo: 'IE',
    bop_item: 'CA',
    stk_flow: 'BAL',
    partner: 'WRL_REST',
    sector10: 'S1',
    sectpart: 'S1',
    currency: 'MIO_EUR',
    sinceTimePeriod: '2018-Q1',
  })
  return data.map(d => ({ period: fmtQuarter(d.period), value: Math.round(d.value) }))
}

// ── Dwelling Completions (quarterly, SA) ── CSO NDQ01
export async function fetchDwellingCompletions() {
  // NDQ01C02 = Seasonally Adjusted, C02342V02816='-' = All house types
  const data = await fetchCSOSeries('NDQ01', {
    STATISTIC: 'NDQ01C02',
    C02342V02816: '-',
  })
  // CSO quarterly periods are like "2025Q4" — need to format.
  // parseInt('2025Q4', 10) === 2025, so a plain int compare is safe
  // and avoids the string/int mix that used to live here.
  return data
    .filter(d => parseInt(d.period, 10) >= 2018)
    .map(d => ({ period: fmtQuarter(d.period), value: Math.round(d.value) }))
}

// ── Average Weekly Earnings (quarterly, SA, all sectors) ── CSO EHQ04
export async function fetchEarnings() {
  // EHQ04S1 = Seasonally Adjusted Average Weekly Earnings
  // Enterprise size '-' is not available; try without size filter first
  // NACE sector '-' = All NACE economic sectors
  const data = await fetchCSOSeries('EHQ04', {
    STATISTIC: 'EHQ04S1',
  })

  // Filter to "All NACE" and aggregate across enterprise sizes if needed
  // The label will help us filter — we want the broadest category
  // Since fetchCSOSeries doesn't return labels, we just get all and take the first value per period
  const periodMap = new Map()
  for (const d of data) {
    // Keep only the first value per period (which should be the aggregate)
    if (!periodMap.has(d.period)) {
      periodMap.set(d.period, d.value)
    }
  }

  return Array.from(periodMap.entries())
    .filter(([p]) => parseInt(p, 10) >= 2015)
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([period, value]) => ({ period: fmtQuarter(period), value: round1(value) }))
}

// ── Net Migration (annual, thousands) ── CSO PEA18
export async function fetchMigration() {
  // PEA18 = Estimated Migration, sex='-' (both), origin/dest='01' (net migration), country='-' (all)
  const data = await fetchCSOSeries('PEA18', {
    STATISTIC: 'PEA18',
    C02199V02655: '-',
    C02542V03077: '01',
    C02719V03286: '-',
  })

  return data
    .filter(d => {
      const year = parseInt(d.period, 10)
      return year >= 2010
    })
    .map(d => ({ period: d.period, value: round1(d.value) }))
}

// ── Immigration (annual, thousands) ── CSO PEA18
export async function fetchImmigration() {
  const data = await fetchCSOSeries('PEA18', {
    STATISTIC: 'PEA18',
    C02199V02655: '-',
    C02542V03077: '05',
    C02719V03286: '-',
  })
  return data
    .filter(d => parseInt(d.period, 10) >= 2010)
    .map(d => ({ period: d.period, value: round1(d.value) }))
}

// ── Emigration (annual, thousands) ── CSO PEA18
export async function fetchEmigration() {
  const data = await fetchCSOSeries('PEA18', {
    STATISTIC: 'PEA18',
    C02199V02655: '-',
    C02542V03077: '04',
    C02719V03286: '-',
  })
  return data
    .filter(d => parseInt(d.period, 10) >= 2010)
    .map(d => ({ period: d.period, value: round1(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// PEER COMPARISONS
// ═══════════════════════════════════════════════════════════════════════

const PEER_GEOS = ['IE', 'EA20', 'EU27_2020', 'DE', 'NL', 'FR']
const GEO_LABELS = { IE: 'Ireland', EA20: 'Euro Area', EU27_2020: 'EU 27', DE: 'Germany', NL: 'Netherlands', FR: 'France' }

function tagGeo(data) {
  return data.map(d => ({ ...d, geoLabel: GEO_LABELS[d.geo] || d.geo }))
}

export async function fetchUnemploymentComparison() {
  const data = await fetchEurostatMultiGeo('une_rt_m', {
    geo: PEER_GEOS, age: 'TOTAL', sex: 'T', unit: 'PC_ACT', s_adj: 'SA',
    sinceTimePeriod: '2022-01',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtMonth(d.period), value: round1(d.value) }))
}

export async function fetchInflationComparison() {
  const data = await fetchEurostatMultiGeo('ei_cphi_m', {
    geo: PEER_GEOS, indic: 'TOTAL', unit: 'RT12',
    sinceTimePeriod: '2022-01',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtMonth(d.period), value: round1(d.value) }))
}

export async function fetchGDPGrowthComparison() {
  const data = await fetchEurostatMultiGeo('namq_10_gdp', {
    geo: PEER_GEOS, unit: 'CLV_PCH_SM', s_adj: 'SCA', na_item: 'B1GQ',
    sinceTimePeriod: '2020-Q1',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtQuarter(d.period), value: round1(d.value) }))
}

export async function fetchDebtComparison() {
  const data = await fetchEurostatMultiGeo('gov_10dd_edpt1', {
    geo: PEER_GEOS, na_item: 'GD', sector: 'S13', unit: 'PC_GDP',
    sinceTimePeriod: '2015',
  })
  return tagGeo(data).map(d => ({ ...d, value: round1(d.value) }))
}

export async function fetchBondYieldComparison() {
  const data = await fetchEurostatMultiGeo('irt_lt_mcby_m', {
    geo: ['IE', 'EA20', 'DE', 'FR', 'NL'], int_rt: 'MCBY',
    sinceTimePeriod: '2022-01',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtMonth(d.period), value: round2(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC FINANCES (% of GNI, not GDP)
// Ireland's GDP is distorted by multinational activity. We fetch absolute
// values in MIO_EUR and divide by GNI from World Bank (same approach as
// fetchFiscalAsPercentGNI). GNI* would be ideal but is CSO-specific.
// ═══════════════════════════════════════════════════════════════════════

// Helper: get GNI map (period → MIO_EUR)
async function getGNIMap() {
  const gniRaw = await fetchWorldBankData('IRL', 'NY.GNP.MKTP.CN', 2015, 2025)
  return new Map(gniRaw.map(d => [d.period, d.value / 1e6]))
}

// Tax revenue by type (% GNI, annual)
export async function fetchTaxRevenue() {
  const items = ['D2_D5_D91', 'D2', 'D5', 'D61']
  const [gniMap, ...taxResults] = await Promise.all([
    getGNIMap(),
    ...items.map(na_item =>
      fetchEurostatData('gov_10a_taxag', {
        geo: 'IE', na_item, sector: 'S13', unit: 'MIO_NAC', sinceTimePeriod: '2015',
      })
    ),
  ])

  return items.flatMap((na_item, i) =>
    taxResults[i]
      .filter(d => gniMap.has(d.period) && gniMap.get(d.period) > 0)
      .map(d => ({
        period: d.period,
        value: round1((d.value / gniMap.get(d.period)) * 100),
        category: na_item,
      }))
  )
}

const TAX_LABELS = {
  D2_D5_D91: 'Total Tax',
  D2: 'Production & Import Taxes',
  D5: 'Income & Wealth Taxes',
  D61: 'Social Contributions',
}
export { TAX_LABELS }

// Government spending by COFOG function (% GNI, annual)
export async function fetchGovSpending() {
  const cofogs = ['TOTAL', 'GF01', 'GF04', 'GF07', 'GF09', 'GF10']
  const [gniMap, ...spendResults] = await Promise.all([
    getGNIMap(),
    ...cofogs.map(cofog99 =>
      fetchEurostatData('gov_10a_exp', {
        geo: 'IE', cofog99, na_item: 'TE', sector: 'S13', unit: 'MIO_NAC',
        sinceTimePeriod: '2015',
      })
    ),
  ])

  return cofogs.flatMap((cofog99, i) =>
    spendResults[i]
      .filter(d => gniMap.has(d.period) && gniMap.get(d.period) > 0)
      .map(d => ({
        period: d.period,
        value: round1((d.value / gniMap.get(d.period)) * 100),
        cofog: cofog99,
      }))
  )
}

const COFOG_LABELS = {
  TOTAL: 'Total Expenditure',
  GF01: 'General Public Services',
  GF04: 'Economic Affairs',
  GF07: 'Health',
  GF09: 'Education',
  GF10: 'Social Protection',
}
export { COFOG_LABELS }

// ═══════════════════════════════════════════════════════════════════════
// STRUCTURAL INDICATORS
// ═══════════════════════════════════════════════════════════════════════

// Old-age dependency ratio (annual)
export async function fetchDependencyRatio() {
  const data = await fetchEurostatData('demo_pjanind', {
    geo: 'IE', indic_de: 'DEPRATIO1', sinceTimePeriod: '2010',
  })
  return data.map(d => ({ period: d.period, value: round1(d.value) }))
}

// Proportion aged 65+ (annual)
export async function fetchAged65Plus() {
  const data = await fetchEurostatData('demo_pjanind', {
    geo: 'IE', indic_de: 'PC_Y65_MAX', sinceTimePeriod: '2010',
  })
  return data.map(d => ({ period: d.period, value: round1(d.value) }))
}

// Dependency ratio comparison across countries
export async function fetchDependencyComparison() {
  const data = await fetchEurostatMultiGeo('demo_pjanind', {
    geo: PEER_GEOS, indic_de: 'PC_Y65_MAX', sinceTimePeriod: '2015',
  })
  return tagGeo(data).map(d => ({ ...d, value: round1(d.value) }))
}

// At-risk-of-poverty rate (annual, %)
export async function fetchPovertyRate() {
  const data = await fetchEurostatData('ilc_li02', {
    geo: 'IE', indic_il: 'LI_R_MD60', sex: 'T', age: 'TOTAL', unit: 'PC',
    sinceTimePeriod: '2015',
  })
  return data.map(d => ({ period: d.period, value: round1(d.value) }))
}

// Poverty comparison
export async function fetchPovertyComparison() {
  const data = await fetchEurostatMultiGeo('ilc_li02', {
    geo: PEER_GEOS, indic_il: 'LI_R_MD60', sex: 'T', age: 'TOTAL', unit: 'PC',
    sinceTimePeriod: '2020',
  })
  return tagGeo(data).map(d => ({ ...d, value: round1(d.value) }))
}

// Labour cost index (quarterly, YoY % change)
export async function fetchLabourCostIndex() {
  const data = await fetchEurostatData('lc_lci_r2_q', {
    geo: 'IE', lcstruct: 'D1_D4_MD5', nace_r2: 'B-S',
    s_adj: 'SCA', unit: 'PCH_SM', sinceTimePeriod: '2020-Q1',
  })
  return data.map(d => ({ period: fmtQuarter(d.period), value: round1(d.value) }))
}

// Labour cost comparison
export async function fetchLabourCostComparison() {
  const data = await fetchEurostatMultiGeo('lc_lci_r2_q', {
    geo: ['IE', 'EA20', 'DE', 'NL', 'FR'], lcstruct: 'D1_D4_MD5', nace_r2: 'B-S',
    s_adj: 'SCA', unit: 'I20', sinceTimePeriod: '2020-Q1',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtQuarter(d.period), value: round1(d.value) }))
}

// Electricity prices for households (half-yearly, EUR/kWh)
export async function fetchElectricityPrices() {
  const data = await fetchEurostatData('nrg_pc_204', {
    geo: 'IE', nrg_cons: 'TOT_KWH', tax: 'I_TAX', currency: 'EUR',
    sinceTimePeriod: '2020',
  })
  return data.map(d => ({ period: d.period, value: round2(d.value) }))
}

// Electricity price comparison
export async function fetchElectricityComparison() {
  const data = await fetchEurostatMultiGeo('nrg_pc_204', {
    geo: ['IE', 'EA20', 'EU27_2020', 'DE', 'NL', 'FR'],
    nrg_cons: 'TOT_KWH', tax: 'I_TAX', currency: 'EUR',
    sinceTimePeriod: '2022',
  })
  return tagGeo(data).map(d => ({ ...d, value: round2(d.value) }))
}

// FDI inward positions (annual, MIO_EUR)
export async function fetchFDIInward() {
  const data = await fetchEurostatData('bop_fdi6_pos', {
    geo: 'IE', partner: 'WRL_REST', currency: 'MIO_EUR', nace_r2: 'TOTAL',
    counterp: 'IMM', entity: 'TOTAL', stk_flow: 'NI', fdi_item: 'DI__D__F',
    sinceTimePeriod: '2015',
  })
  return data.map(d => ({ period: d.period, value: Math.round(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIDENCE & SENTIMENT (Leading Indicators)
// ═══════════════════════════════════════════════════════════════════════

// Consumer Confidence Indicator (monthly, balance, SA)
export async function fetchConsumerConfidence() {
  const data = await fetchEurostatData('ei_bsco_m', {
    geo: 'IE', indic: 'BS-CSMCI', s_adj: 'SA', unit: 'BAL',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// Economic Sentiment Indicator (monthly, SA)
export async function fetchEconomicSentiment() {
  const data = await fetchEurostatData('ei_bssi_m_r2', {
    geo: 'IE', indic: 'BS-ESI-I', s_adj: 'SA',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// Industrial Confidence (monthly, balance, SA)
export async function fetchIndustrialConfidence() {
  const data = await fetchEurostatData('ei_bssi_m_r2', {
    geo: 'IE', indic: 'BS-ICI-BAL', s_adj: 'SA',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// Services Confidence (monthly, balance, SA)
export async function fetchServicesConfidence() {
  const data = await fetchEurostatData('ei_bssi_m_r2', {
    geo: 'IE', indic: 'BS-SCI-BAL', s_adj: 'SA',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// Construction Confidence (monthly, balance, SA)
export async function fetchConstructionConfidence() {
  const data = await fetchEurostatData('ei_bssi_m_r2', {
    geo: 'IE', indic: 'BS-CCI-BAL', s_adj: 'SA',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// Retail Trade Volume (monthly, SCA, index 2015=100)
export async function fetchRetailTrade() {
  const data = await fetchEurostatData('sts_trtu_m', {
    geo: 'IE', nace_r2: 'G47', s_adj: 'SCA', unit: 'I15',
    indic_bt: 'VOL_SLS',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// Industrial Production Index (monthly, SCA, index 2015=100)
export async function fetchIndustrialProduction() {
  const data = await fetchEurostatData('sts_inpr_m', {
    geo: 'IE', nace_r2: 'B-D', s_adj: 'SCA', unit: 'I15',
    indic_bt: 'PRD',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// Consumer confidence comparison
export async function fetchConsumerConfidenceComparison() {
  const data = await fetchEurostatMultiGeo('ei_bsco_m', {
    geo: ['IE', 'EA20', 'EU27_2020', 'DE', 'NL', 'FR'],
    indic: 'BS-CSMCI', s_adj: 'SA', unit: 'BAL',
    sinceTimePeriod: '2022-01',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtMonth(d.period), value: round1(d.value) }))
}

// ESI comparison
export async function fetchSentimentComparison() {
  const data = await fetchEurostatMultiGeo('ei_bssi_m_r2', {
    geo: ['IE', 'EA20', 'EU27_2020', 'DE', 'NL', 'FR'],
    indic: 'BS-ESI-I', s_adj: 'SA',
    sinceTimePeriod: '2022-01',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtMonth(d.period), value: round1(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// EXCHANGE RATES (from ECB via Eurostat)
// ═══════════════════════════════════════════════════════════════════════

// EUR/GBP exchange rate (monthly). Note: the `ert_bil_eur_m` dataset
// dropped its `geo` dimension in a 2024 restructure; the older call
// pattern (geo=UK) silently returned empty. The series is already keyed
// by currency so we just pass currency + statinfo.
// Eurostat stores GBP-per-EUR; the fetcher keeps that direction so
// downstream charts read as "pounds per euro".
export async function fetchEURGBP() {
  const data = await fetchEurostatData('ert_bil_eur_m', {
    currency: 'GBP', statinfo: 'AVG', unit: 'NAC',
    sinceTimePeriod: '2022-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round2(d.value) }))
}

// EUR/USD exchange rate (monthly). USD per EUR.
export async function fetchEURUSD() {
  const data = await fetchEurostatData('ert_bil_eur_m', {
    currency: 'USD', statinfo: 'AVG', unit: 'NAC',
    sinceTimePeriod: '2022-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round2(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// BOND SPREAD TO BUND
// ═══════════════════════════════════════════════════════════════════════

// Irish-German 10-year bond spread (monthly, percentage points)
export async function fetchBundSpread() {
  const [ieData, deData] = await Promise.all([
    fetchEurostatData('irt_lt_mcby_m', {
      geo: 'IE', int_rt: 'MCBY', sinceTimePeriod: '2022-01',
    }),
    fetchEurostatData('irt_lt_mcby_m', {
      geo: 'DE', int_rt: 'MCBY', sinceTimePeriod: '2022-01',
    }),
  ])
  const deMap = new Map(deData.map(d => [d.period, d.value]))
  return ieData
    .filter(d => deMap.has(d.period))
    .map(d => ({
      period: fmtMonth(d.period),
      value: round2(d.value - deMap.get(d.period)),
      ieYield: round2(d.value),
      deYield: round2(deMap.get(d.period)),
    }))
}

// ═══════════════════════════════════════════════════════════════════════
// CORE INFLATION & HICP LEVELS
// ═══════════════════════════════════════════════════════════════════════

// Core inflation: all items excluding energy and unprocessed food.
export async function fetchCoreInflation() {
  const data = await fetchEurostatData('ei_cphi_m', {
    geo: 'IE', indic: 'CP-HI00XEFU', unit: 'RT12',
    sinceTimePeriod: '2022-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// ── HICP by economic classification (services, goods, energy, food) ──
// All queries hit ei_cphi_m (YoY rate, monthly, current vintage).
// indic codes:
//   CP-HIS        Services
//   CP-HIIGXE     Non-energy industrial goods
//   CP-HIE        Energy
//   CP-HIF        Food (incl. alcohol, tobacco)
//   CP-HIFU       Unprocessed food
//   CP-HI00XEF    All items excluding energy, food, alcohol, tobacco (ECB "super-core")
//   CP-HI00XEFU   Core (ex energy and unprocessed food)

async function hicpSeries(indic) {
  const data = await fetchEurostatData('ei_cphi_m', {
    geo: 'IE', indic, unit: 'RT12',
    sinceTimePeriod: '2019-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), rawPeriod: d.period, value: round1(d.value) }))
}

export const fetchServicesInflation    = () => hicpSeries('CP-HIS')
export const fetchGoodsInflation       = () => hicpSeries('CP-HIIGXE')
export const fetchEnergyInflation      = () => hicpSeries('CP-HIE')
export const fetchFoodInflation        = () => hicpSeries('CP-HIF')
export const fetchUnprocessedFoodInflation = () => hicpSeries('CP-HIFU')
export const fetchSuperCoreInflation   = () => hicpSeries('CP-HI00XEF')

// Combined multi-component HICP (one shot, headline + core + components).
export async function fetchHICPComponents() {
  const codes = [
    { code: 'TOTAL',        label: 'Headline (all items)' },
    { code: 'CP-HI00XEFU',  label: 'Core (ex energy & unproc. food)' },
    { code: 'CP-HI00XEF',   label: 'Super-core (ex energy, food, alc, tob)' },
    { code: 'CP-HIS',       label: 'Services' },
    { code: 'CP-HIIGXE',    label: 'Goods (ex energy)' },
    { code: 'CP-HIE',       label: 'Energy' },
    { code: 'CP-HIF',       label: 'Food' },
    { code: 'CP-HIFU',      label: 'Unprocessed food' },
  ]
  const results = await Promise.all(codes.map(async c => {
    const rows = await hicpSeries(c.code)
    return rows.map(r => ({ ...r, component: c.code, componentLabel: c.label }))
  }))
  return results.flat()
}

// HICP by ECOICOP division (13 divisions), latest vintage.
// Returns an array of { period, rawPeriod, value, coicop, coicopLabel }.
export const HICP_COICOP_LABELS = {
  'CP-HI01': 'Food & non-alcoholic beverages',
  'CP-HI02': 'Alcohol, tobacco & narcotics',
  'CP-HI03': 'Clothing & footwear',
  'CP-HI04': 'Housing, water, electricity, gas',
  'CP-HI05': 'Furnishings & household equipment',
  'CP-HI06': 'Health',
  'CP-HI07': 'Transport',
  'CP-HI08': 'Information & communication',
  'CP-HI09': 'Recreation, sport & culture',
  'CP-HI10': 'Education services',
  'CP-HI11': 'Restaurants & accommodation',
  'CP-HI12': 'Insurance & financial services',
  'CP-HI13': 'Personal care & misc. goods',
}

export async function fetchHICPByCOICOP() {
  const indics = Object.keys(HICP_COICOP_LABELS)
  const data = await fetchEurostatMultiDim('ei_cphi_m', {
    geo: 'IE', indic: indics, unit: 'RT12',
    sinceTimePeriod: '2022-01',
  }, 'indic')
  return data.map(d => ({
    period: fmtMonth(d.period),
    rawPeriod: d.period,
    value: round1(d.value),
    coicop: d.code,
    coicopLabel: HICP_COICOP_LABELS[d.code] || d.label,
  }))
}

// ── Inflation expectations from Eurostat consumer survey ei_bsco_m ──
// BS-PT-LY: price trends over the last 12 months (realised perception)
// BS-PT-NY: price trends over the next 12 months (expectation)
// Both are "balance" responses (SA).
export async function fetchPriceTrendsPerceived() {
  const data = await fetchEurostatData('ei_bsco_m', {
    geo: 'IE', indic: 'BS-PT-LY', s_adj: 'SA', unit: 'BAL',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

export async function fetchPriceTrendsExpected() {
  const data = await fetchEurostatData('ei_bsco_m', {
    geo: 'IE', indic: 'BS-PT-NY', s_adj: 'SA', unit: 'BAL',
    sinceTimePeriod: '2020-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// ── Producer prices (Eurostat sts_inppd_m, domestic market, monthly) ──
// indic_bt = PRC_PRR_DOM (Domestic producer prices).
// unit: PCH_SM (YoY) or I21 (index, 2021=100).
export async function fetchProducerPrices() {
  const data = await fetchEurostatData('sts_inppd_m', {
    geo: 'IE', nace_r2: 'B-E36', indic_bt: 'PRC_PRR_DOM',
    s_adj: 'NSA', unit: 'PCH_SM',
    sinceTimePeriod: '2019-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

export async function fetchEnergyProducerPrices() {
  const data = await fetchEurostatData('sts_inppd_m', {
    geo: 'IE', nace_r2: 'D35', indic_bt: 'PRC_PRR_DOM',
    s_adj: 'NSA', unit: 'PCH_SM',
    sinceTimePeriod: '2019-01',
  })
  return data.map(d => ({ period: fmtMonth(d.period), value: round1(d.value) }))
}

// ── CSO Consumer Price Index by COICOP division (CPM01) ────────────────
// CPM01 uses `CPM01C07` = % change over 12 months (YoY) and has 13
// commodity group codes: "-" (All items) plus 01..12 (COICOP divisions).
export const CSO_CPI_COICOP_LABELS = {
  '-' : 'All items',
  '01': 'Food & non-alcoholic beverages',
  '02': 'Alcohol & tobacco',
  '03': 'Clothing & footwear',
  '04': 'Housing, water, electricity, gas & fuels',
  '05': 'Furnishings & household equipment',
  '06': 'Health',
  '07': 'Transport',
  '08': 'Communications',
  '09': 'Recreation & culture',
  '10': 'Education',
  '11': 'Restaurants & hotels',
  '12': 'Miscellaneous goods & services',
}

// Pretty "2025M11" / "2025 November" → "Nov 2025"
function fmtCSOMonth(p) {
  const m = p.match(/(\d{4})\s*([A-Za-z]+|M(\d{2}))/)
  if (!m) return p
  const year = m[1]
  if (m[3]) return `${MONTH_NAMES[parseInt(m[3], 10) - 1]} ${year}`
  const name = m[2].slice(0, 3)
  return `${name} ${year}`
}

// Fetch CSO CPI YoY % for all 13 commodity groups in one call.
// Returns an array of { period, rawPeriod, value, coicop, coicopLabel }.
export async function fetchCSOCpiByCOICOP() {
  const all = await fetchCSOData('CPM01')
  const out = []
  for (const row of all) {
    // label format: "Percentage Change over 12 months for Consumer Price Index - <group>"
    if (!row.label.startsWith('Percentage Change over 12 months')) continue
    // period like "2025 November" — convert to "Nov 2025"
    out.push({
      period: fmtCSOMonth(row.period),
      rawPeriod: row.period,
      value: round1(row.value),
      label: row.label,
    })
  }
  // We don't get COICOP codes back from fetchCSOData (it collapses labels);
  // parse them from the label suffix. The data was also emitted for each of
  // the 13 commodity groups, so `out` contains 13×N rows.
  const labelToCode = Object.fromEntries(
    Object.entries(CSO_CPI_COICOP_LABELS).map(([code, label]) => [label, code]),
  )
  const shortLabelMap = {
    'All items': '-',
    'Food and non-alcoholic beverages': '01',
    'Alcoholic beverages and tobacco': '02',
    'Clothing and footwear': '03',
    'Housing, water, electricity, gas and other fuels': '04',
    'Furnishings, household equipment and routine household maintenance': '05',
    'Health': '06',
    'Transport': '07',
    'Communications': '08',
    'Recreation and culture': '09',
    'Education': '10',
    'Restaurants and hotels': '11',
    'Miscellaneous goods and services': '12',
  }
  return out.map(r => {
    // extract trailing group label after last ' - '
    const parts = r.label.split(' - ')
    const group = parts[parts.length - 1].trim()
    const code = shortLabelMap[group] || labelToCode[group] || '?'
    return {
      ...r,
      coicop: code,
      coicopLabel: CSO_CPI_COICOP_LABELS[code] || group,
    }
  })
}

// HICP level index comparison across countries (2025=100, current vintage).
// Uses ei_cphi_m with unit=HICP2025 (rebased 2025=100). UK is out of
// scope for this dataset since UK left the HICP framework on Brexit; we
// use the EU-27 + peer set instead.
export async function fetchHICPLevelComparison() {
  const data = await fetchEurostatMultiGeo('ei_cphi_m', {
    geo: ['IE', 'EA20', 'EU27_2020', 'DE', 'FR', 'NL'],
    indic: 'TOTAL', unit: 'HICP2025',
    sinceTimePeriod: '2022-01',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtMonth(d.period), value: round1(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// GAS PRICES (Eurostat)
// ═══════════════════════════════════════════════════════════════════════

// Residential gas prices, IE vs EU (half-yearly, EUR/kWh)
export async function fetchGasPricesResidential() {
  const data = await fetchEurostatMultiGeo('nrg_pc_202', {
    geo: ['IE', 'EU27_2020'], nrg_cons: 'TOT_GJ', tax: 'I_TAX', currency: 'EUR',
    sinceTimePeriod: '2020',
  })
  return tagGeo(data).map(d => ({ ...d, value: round2(d.value) }))
}

// Business gas prices, IE vs EU (half-yearly, EUR/kWh)
export async function fetchGasPricesBusiness() {
  const data = await fetchEurostatMultiGeo('nrg_pc_203', {
    geo: ['IE', 'EU27_2020'], nrg_cons: 'TOT_GJ', tax: 'X_TAX', currency: 'EUR',
    sinceTimePeriod: '2020',
  })
  return tagGeo(data).map(d => ({ ...d, value: round2(d.value) }))
}

// ═══════════════════════════════════════════════════════════════════════
// PEER BENCHMARKS (Eurostat productivity, R&D, education + World Bank)
// NOTE: The OECD SDMX endpoint (sdmx.oecd.org) now serves SDMX 2.0.0
// responses which nest dataSets under `data.dataSets`. src/services/oecd.js
// parses the legacy 1.x shape, so a parser rewrite is needed before we
// can call OECD directly. Until then, peer benchmarks are sourced from
// Eurostat (for EU peers) and the World Bank (for a US comparator).
// ═══════════════════════════════════════════════════════════════════════

const BENCH_GEOS = ['IE', 'EA20', 'EU27_2020', 'DE', 'NL', 'FR']

// Real labour productivity per hour worked (index 2015=100, annual).
// Eurostat nama_10_lp_ulc, na_item=RLPR_HW.
export async function fetchProductivityPerHourComparison() {
  const data = await fetchEurostatMultiGeo('nama_10_lp_ulc', {
    geo: BENCH_GEOS, na_item: 'RLPR_HW', unit: 'I15',
    sinceTimePeriod: '2015',
  })
  return tagGeo(data).map(d => ({ ...d, value: round1(d.value) }))
}

// Gross domestic expenditure on R&D (% GDP, annual, all sectors).
export async function fetchRDIntensityComparison() {
  const data = await fetchEurostatMultiGeo('rd_e_gerdtot', {
    geo: BENCH_GEOS, sectperf: 'TOTAL', unit: 'PC_GDP',
    sinceTimePeriod: '2010',
  })
  return tagGeo(data).map(d => ({ ...d, value: round2(d.value) }))
}

// Tertiary education attainment, age 25-34 (%, annual).
export async function fetchTertiaryEducationComparison() {
  const data = await fetchEurostatMultiGeo('edat_lfse_03', {
    geo: BENCH_GEOS, age: 'Y25-34', sex: 'T',
    isced11: 'ED5-8', unit: 'PC',
    sinceTimePeriod: '2010',
  })
  return tagGeo(data).map(d => ({ ...d, value: round1(d.value) }))
}

// Government expenditure on education (% GDP, annual).
// Eurostat gov_10a_exp with cofog99=GF09 total expenditure.
export async function fetchEducationSpendComparison() {
  const data = await fetchEurostatMultiGeo('gov_10a_exp', {
    geo: BENCH_GEOS, cofog99: 'GF09', na_item: 'TE',
    sector: 'S13', unit: 'PC_GDP',
    sinceTimePeriod: '2010',
  })
  return tagGeo(data).map(d => ({ ...d, value: round2(d.value) }))
}

// GDP per capita in current US$ for a comparator group (World Bank).
const WB_ISO = [
  { iso: 'IRL', label: 'Ireland' },
  { iso: 'DEU', label: 'Germany' },
  { iso: 'NLD', label: 'Netherlands' },
  { iso: 'FRA', label: 'France' },
  { iso: 'USA', label: 'United States' },
  { iso: 'GBR', label: 'United Kingdom' },
]

export async function fetchGDPPerCapitaComparison() {
  const results = await Promise.all(
    WB_ISO.map(async ({ iso, label }) => {
      const rows = await fetchWorldBankData(iso, 'NY.GDP.PCAP.CD', 2010, 2025)
      return rows.map(d => ({
        period: d.period,
        value: Math.round(d.value),
        geo: iso,
        geoLabel: label,
      }))
    }),
  )
  return results.flat()
}

// ═══════════════════════════════════════════════════════════════════════
// EMPLOYMENT STRUCTURE (Eurostat lfsi_* + namq_10_a10_e)
// ═══════════════════════════════════════════════════════════════════════

// Employment rate (20-64, both sexes, % of population, SA, quarterly)
// Eurostat lfsi_emp_q — note: SCA is not available for this dataset,
// use SA instead.
export async function fetchEmploymentRate() {
  const data = await fetchEurostatData('lfsi_emp_q', {
    geo: 'IE', age: 'Y20-64', sex: 'T',
    indic_em: 'EMP_LFS', unit: 'PC_POP', s_adj: 'SA',
    sinceTimePeriod: '2015-Q1',
  })
  return data.map(d => ({ period: fmtQuarter(d.period), value: round1(d.value) }))
}

// Activity rate (20-64, both sexes, % of population, SA, quarterly)
export async function fetchActivityRate() {
  const data = await fetchEurostatData('lfsi_emp_q', {
    geo: 'IE', age: 'Y20-64', sex: 'T',
    indic_em: 'ACT', unit: 'PC_POP', s_adj: 'SA',
    sinceTimePeriod: '2015-Q1',
  })
  return data.map(d => ({ period: fmtQuarter(d.period), value: round1(d.value) }))
}

// Youth employment rate (15-24, %, quarterly, SA)
export async function fetchYouthEmploymentRate() {
  const data = await fetchEurostatData('lfsi_emp_q', {
    geo: 'IE', age: 'Y15-24', sex: 'T',
    indic_em: 'EMP_LFS', unit: 'PC_POP', s_adj: 'SA',
    sinceTimePeriod: '2015-Q1',
  })
  return data.map(d => ({ period: fmtQuarter(d.period), value: round1(d.value) }))
}

// Employment rate peer comparison
export async function fetchEmploymentRateComparison() {
  const data = await fetchEurostatMultiGeo('lfsi_emp_q', {
    geo: PEER_GEOS, age: 'Y20-64', sex: 'T',
    indic_em: 'EMP_LFS', unit: 'PC_POP', s_adj: 'SA',
    sinceTimePeriod: '2022-Q1',
  })
  return tagGeo(data).map(d => ({ ...d, period: fmtQuarter(d.period), value: round1(d.value) }))
}

// Employment by NACE A10 sector, domestic concept (thousands of persons,
// quarterly, SCA). Eurostat namq_10_a10_e.
export const NACE_A10_LABELS = {
  'A':    'Agriculture & fishing',
  'B-E':  'Industry (ex. construction)',
  'F':    'Construction',
  'G-I':  'Trade, transport, hospitality',
  'J':    'Information & communication',
  'K':    'Finance & insurance',
  'L':    'Real estate',
  'M_N':  'Professional & admin services',
  'O-Q':  'Public admin, education, health',
  'R-U':  'Arts, recreation & other',
}

export async function fetchEmploymentByNACE() {
  const nace_r2 = Object.keys(NACE_A10_LABELS)
  const data = await fetchEurostatMultiDim('namq_10_a10_e', {
    geo: 'IE', nace_r2, na_item: 'EMP_DC', unit: 'THS_PER', s_adj: 'SCA',
    sinceTimePeriod: '2015-Q1',
  }, 'nace_r2')
  return data.map(d => ({
    period: fmtQuarter(d.period),
    sector: d.code,
    sectorLabel: NACE_A10_LABELS[d.code] || d.label,
    value: round1(d.value),
  }))
}

// ═══════════════════════════════════════════════════════════════════════
// LIVE REGISTER (CSO)
// ═══════════════════════════════════════════════════════════════════════

// Live Register monthly (seasonally adjusted)
export async function fetchLiveRegister() {
  const data = await fetchCSOSeries('LRM02', {
    STATISTIC: 'LRM02C02',
  })
  const periodMap = new Map()
  for (const d of data) {
    if (!periodMap.has(d.period)) periodMap.set(d.period, d.value)
  }
  return Array.from(periodMap.entries())
    .filter(([p]) => p >= '2020')
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([period, value]) => ({ period: fmtMonth(period), value: Math.round(value) }))
}
