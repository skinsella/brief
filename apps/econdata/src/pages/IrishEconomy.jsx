import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'
import { TrendingUp, Users, UserX, DollarSign, Home, Landmark, Info, Banknote, ArrowUpDown, Building2, Wallet, Plane } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  fetchGDPGrowth,
  fetchUnemploymentRate,
  fetchYouthUnemployment,
  fetchHICPInflation,
  fetchCoreInflation,
  fetchHousePriceIndex,
  fetchFiscalAsPercentGNI,
  fetchBondYields,
  fetchEuroAreaRates,
  fetchBundSpread,
  fetchEURGBP,
  fetchEURUSD,
  fetchDebtServiceCosts,
  fetchDebtServiceAbsolute,
  fetchCurrentAccount,
  fetchDwellingCompletions,
  fetchEarnings,
  fetchMigration,
  fetchImmigration,
  fetchEmigration,
} from '@/services/indicators'

const tabs = ['Macro', 'Employment', 'Prices', 'Housing', 'Fiscal', 'Rates']

export default function IrishEconomy() {
  const [activeTab, setActiveTab] = useState('Macro')
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const fetchers = {
        gdp: fetchGDPGrowth,
        unemployment: fetchUnemploymentRate,
        youthUnemployment: fetchYouthUnemployment,
        hicp: fetchHICPInflation,
        coreInflation: fetchCoreInflation,
        housePrices: fetchHousePriceIndex,
        bondYields: fetchBondYields,
        euroAreaRates: fetchEuroAreaRates,
        bundSpread: fetchBundSpread,
        eurGbp: fetchEURGBP,
        eurUsd: fetchEURUSD,
        debtService: fetchDebtServiceCosts,
        debtServiceAbs: fetchDebtServiceAbsolute,
        currentAccount: fetchCurrentAccount,
        dwellingCompletions: fetchDwellingCompletions,
        earnings: fetchEarnings,
        migration: fetchMigration,
        immigration: fetchImmigration,
        emigration: fetchEmigration,
      }

      const keys = Object.keys(fetchers)
      const [stdResults, fiscalResult] = await Promise.all([
        Promise.allSettled(keys.map((k) => fetchers[k]())),
        fetchFiscalAsPercentGNI().catch((e) => ({ error: e.message })),
      ])

      if (cancelled) return

      const newData = {}
      const newErrors = {}

      stdResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          newData[keys[i]] = result.value
        } else {
          newErrors[keys[i]] =
            result.status === 'rejected'
              ? result.reason?.message || 'Unknown error'
              : 'No data available'
        }
      })

      // Fiscal (% GNI)
      if (fiscalResult.error) {
        newErrors.govBalance = fiscalResult.error
        newErrors.govDebt = fiscalResult.error
      } else {
        if (fiscalResult.balPctGNI?.length > 0) newData.govBalance = fiscalResult.balPctGNI
        else newErrors.govBalance = 'No data available'
        if (fiscalResult.debtPctGNI?.length > 0) newData.govDebt = fiscalResult.debtPctGNI
        else newErrors.govDebt = 'No data available'
      }

      setData(newData)
      setErrors(newErrors)
      setLoading(false)
    }

    loadAll()
    return () => { cancelled = true }
  }, [])

  function latest(key) {
    const s = data[key]
    return s && s.length > 0 ? s[s.length - 1] : null
  }

  function slice(key, n) {
    const s = data[key]
    if (!s) return []
    return n ? s.slice(-n) : s
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'Macro':
        return <MacroTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      case 'Employment':
        return <EmploymentTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      case 'Prices':
        return <PricesTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      case 'Housing':
        return <HousingTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      case 'Fiscal':
        return <FiscalTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      case 'Rates':
        return <RatesTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      default:
        return null
    }
  }

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Irish Economic Overview</h1>
        <p className="text-slate-500 mt-1">Live data from Eurostat, CSO, and World Bank</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {renderTabContent()}
    </motion.div>
  )
}

/* ── Tab components ─────────────────────────────────────────────────── */

function MacroTab({ errors, loading, latest, slice }) {
  const gdpLatest = latest('gdp')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="GDP Growth (YoY)"
          value={gdpLatest ? `${gdpLatest.value}%` : '\u2014'}
          subtitle={gdpLatest ? `${gdpLatest.period} \u00b7 Eurostat` : 'Loading\u2026'}
          icon={TrendingUp}
          color="sky"
          loading={loading}
        />
      </div>

      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">
            GNI* (Modified Gross National Income) and Modified Domestic Demand are Ireland-specific
            metrics published by the{' '}
            <a
              href="https://www.cso.ie/en/statistics/nationalaccounts/quarterlynationalaccounts/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              CSO Quarterly National Accounts
            </a>
            . They strip out the distorting effects of multinational activity on headline GDP.
          </p>
        </CardContent>
      </Card>

      <ChartCard
        title="GDP Growth (% YoY, quarterly)"
        subtitle="Source: Eurostat namq_10_gdp"
        loading={loading}
        error={errors.gdp}
      >
        <LineChart data={slice('gdp')}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="value" name="GDP Growth" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartCard>
    </div>
  )
}

function EmploymentTab({ errors, loading, latest, slice, data }) {
  const unemp = latest('unemployment')
  const youth = latest('youthUnemployment')
  const earn = latest('earnings')
  const mig = latest('migration')

  // Merge unemployment and youth data by period for dual-line chart
  const merged = (() => {
    const uData = data.unemployment || []
    const yData = data.youthUnemployment || []
    const map = new Map()
    uData.forEach((d) => map.set(d.period, { period: d.period, unemployment: d.value }))
    yData.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.youth = d.value
      map.set(d.period, existing)
    })
    return Array.from(map.values())
      .sort((a, b) => (a.period < b.period ? -1 : 1))
      .slice(-24)
  })()

  // Merge migration flows
  const migrationMerged = (() => {
    const net = data.migration || []
    const imm = data.immigration || []
    const emi = data.emigration || []
    const map = new Map()
    net.forEach((d) => map.set(d.period, { period: d.period, net: d.value }))
    imm.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.immigration = d.value
      map.set(d.period, existing)
    })
    emi.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.emigration = d.value
      map.set(d.period, existing)
    })
    return Array.from(map.values()).sort((a, b) => (a.period < b.period ? -1 : 1))
  })()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Unemployment Rate"
          value={unemp ? `${unemp.value}%` : '\u2014'}
          subtitle={unemp ? `${unemp.period} \u00b7 Eurostat` : 'Loading\u2026'}
          icon={Users}
          color="amber"
          loading={loading}
        />
        <KpiCard
          title="Youth Unemployment"
          value={youth ? `${youth.value}%` : '\u2014'}
          subtitle={youth ? `${youth.period} \u00b7 Eurostat` : 'Loading\u2026'}
          icon={UserX}
          color="rose"
          loading={loading}
        />
        <KpiCard
          title="Avg Weekly Earnings"
          value={earn ? `\u20ac${earn.value}` : '\u2014'}
          subtitle={earn ? `${earn.period} \u00b7 CSO` : errors.earnings ? 'Unavailable' : 'Loading\u2026'}
          icon={Wallet}
          color="emerald"
          loading={loading}
        />
        <KpiCard
          title="Net Migration"
          value={mig ? `${mig.value > 0 ? '+' : ''}${mig.value}k` : '\u2014'}
          subtitle={mig ? `${mig.period} \u00b7 CSO (thousands)` : errors.migration ? 'Unavailable' : 'Loading\u2026'}
          icon={Plane}
          color="sky"
          loading={loading}
        />
      </div>

      <ChartCard
        title="Unemployment Rates (%, monthly, SA)"
        subtitle="Source: Eurostat une_rt_m"
        loading={loading}
        error={errors.unemployment && errors.youthUnemployment ? errors.unemployment : undefined}
      >
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="unemployment" name="Overall" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="youth" name="Youth (< 25)" stroke={CHART_COLORS[4]} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Average Weekly Earnings (\u20ac, quarterly, SA)"
          subtitle="Source: CSO EHQ04"
          loading={loading}
          error={errors.earnings}
        >
          <LineChart data={slice('earnings')}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip formatter={(v) => `\u20ac${v}`} />
            <Line type="monotone" dataKey="value" name="Avg Weekly Earnings" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Migration (thousands, annual)"
          subtitle="Source: CSO PEA18"
          loading={loading}
          error={errors.migration && errors.immigration ? errors.migration : undefined}
        >
          <LineChart data={migrationMerged}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="immigration" name="Immigration" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="emigration" name="Emigration" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="net" name="Net Migration" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>
      </div>
    </div>
  )
}

function PricesTab({ data, errors, loading, latest, slice }) {
  const hicp = latest('hicp')
  const core = latest('coreInflation')

  // Merge headline + core for overlay chart
  const hicpData = data.hicp || []
  const coreData = data.coreInflation || []
  const coreMap = new Map(coreData.map(d => [d.period, d.value]))
  const inflationMerged = hicpData.slice(-36).map(d => ({
    period: d.period,
    headline: d.value,
    core: coreMap.get(d.period) ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="HICP Inflation"
          value={hicp ? `${hicp.value}%` : '\u2014'}
          subtitle={hicp ? `${hicp.period} \u00b7 Eurostat` : 'Loading\u2026'}
          icon={DollarSign}
          color="rose"
          loading={loading}
        />
        <KpiCard
          title="Core Inflation"
          value={core ? `${core.value}%` : '\u2014'}
          subtitle={core ? `${core.period} \u00b7 excl. energy & food` : errors.coreInflation ? 'Unavailable' : 'Loading\u2026'}
          icon={DollarSign}
          color="amber"
          loading={loading}
        />
      </div>

      <ChartCard
        title="Inflation: Headline vs Core (%, monthly)"
        subtitle="Source: Eurostat prc_hicp_manr — All items vs excl. energy & unprocessed food"
        loading={loading}
        error={errors.hicp}
        data={inflationMerged}
      >
        <LineChart data={inflationMerged}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'ECB 2% target', position: 'right', fontSize: 10, fill: '#ef4444' }} />
          <Line type="monotone" dataKey="headline" name="All Items (HICP)" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="core" name="Core (excl. energy & food)" stroke={CHART_COLORS[4]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
        </LineChart>
      </ChartCard>
    </div>
  )
}

function HousingTab({ errors, loading, latest, slice }) {
  const hpi = latest('housePrices')
  const completions = latest('dwellingCompletions')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="House Price Index"
          value={hpi ? `${hpi.value}` : '\u2014'}
          subtitle={hpi ? `${hpi.period} \u00b7 Eurostat (2015=100)` : 'Loading\u2026'}
          icon={Home}
          color="violet"
          loading={loading}
        />
        <KpiCard
          title="Dwelling Completions"
          value={completions ? completions.value.toLocaleString() : '\u2014'}
          subtitle={completions ? `${completions.period} \u00b7 CSO (SA, quarterly)` : errors.dwellingCompletions ? 'Unavailable' : 'Loading\u2026'}
          icon={Building2}
          color="orange"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="House Price Index (2015=100, quarterly)"
          subtitle="Source: Eurostat prc_hpi_q"
          loading={loading}
          error={errors.housePrices}
        >
          <LineChart data={slice('housePrices')}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="HPI" stroke={CHART_COLORS[4]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="New Dwelling Completions (quarterly, SA)"
          subtitle="Source: CSO NDQ01"
          loading={loading}
          error={errors.dwellingCompletions}
        >
          <BarChart data={slice('dwellingCompletions')}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="value" name="Completions" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}

function FiscalTab({ errors, loading, latest, slice, data }) {
  const bal = latest('govBalance')
  const debt = latest('govDebt')
  const interest = latest('debtService')
  const interestAbs = latest('debtServiceAbs')
  const ca = latest('currentAccount')

  // Merge balance and debt by period
  const fiscalMerged = (() => {
    const bData = data.govBalance || []
    const dData = data.govDebt || []
    const map = new Map()
    bData.forEach((d) => map.set(d.period, { period: d.period, balance: d.value }))
    dData.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.debt = d.value
      map.set(d.period, existing)
    })
    return Array.from(map.values()).sort((a, b) => (a.period < b.period ? -1 : 1))
  })()

  // Merge debt service (% GDP and absolute)
  const debtServiceMerged = (() => {
    const pctData = data.debtService || []
    const absData = data.debtServiceAbs || []
    const map = new Map()
    pctData.forEach((d) => map.set(d.period, { period: d.period, pctGDP: d.value }))
    absData.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.mioEUR = d.value
      map.set(d.period, existing)
    })
    return Array.from(map.values()).sort((a, b) => (a.period < b.period ? -1 : 1))
  })()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Government Balance"
          value={bal ? `${bal.value > 0 ? '+' : ''}${bal.value}%` : '\u2014'}
          subtitle={bal ? `${bal.period} \u00b7 % GNI \u00b7 Eurostat` : 'Loading\u2026'}
          icon={Landmark}
          color="green"
          loading={loading}
        />
        <KpiCard
          title="Government Debt"
          value={debt ? `${debt.value}%` : '\u2014'}
          subtitle={debt ? `${debt.period} \u00b7 % GNI \u00b7 Eurostat` : 'Loading\u2026'}
          icon={Landmark}
          color="slate"
          loading={loading}
        />
        <KpiCard
          title="Interest Payments"
          value={interestAbs ? `\u20ac${(interestAbs.value / 1000).toFixed(1)}bn` : interest ? `${interest.value}% GDP` : '\u2014'}
          subtitle={interest ? `${interest.period} \u00b7 Eurostat` : errors.debtService ? 'Unavailable' : 'Loading\u2026'}
          icon={Banknote}
          color="amber"
          loading={loading}
        />
        <KpiCard
          title="Current Account"
          value={ca ? `\u20ac${(ca.value / 1000).toFixed(1)}bn` : '\u2014'}
          subtitle={ca ? `${ca.period} \u00b7 Eurostat (quarterly)` : errors.currentAccount ? 'Unavailable' : 'Loading\u2026'}
          icon={ArrowUpDown}
          color="sky"
          loading={loading}
        />
      </div>

      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">
            Fiscal ratios use GNI as the denominator rather than GDP,
            which is distorted by multinational activity in Ireland. Interest payments
            use GDP as denominator (Eurostat convention). For GNI*
            (the CSO&apos;s further-adjusted measure), see the{' '}
            <a
              href="https://www.cso.ie/en/statistics/nationalaccounts/quarterlynationalaccounts/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              CSO National Accounts
            </a>.
            Current account figures for Ireland are heavily affected by IP-related flows.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Government Balance & Debt (% of GNI, annual)"
          subtitle="Source: Eurostat gov_10dd_edpt1 + World Bank GNI"
          loading={loading}
          error={errors.govBalance && errors.govDebt ? errors.govBalance : undefined}
        >
          <LineChart data={fiscalMerged}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="balance" name="Balance (% GNI)" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="debt" name="Debt (% GNI)" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Government Interest Expenditure (annual)"
          subtitle="Source: Eurostat gov_10dd_edpt1 (D41PAY)"
          loading={loading}
          error={errors.debtService}
        >
          <BarChart data={debtServiceMerged}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="mioEUR" name="\u20ac millions" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="pctGDP" name="% of GDP" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard
        title="Current Account Balance (quarterly, \u20ac millions)"
        subtitle="Source: Eurostat bop_c6_q"
        loading={loading}
        error={errors.currentAccount}
      >
        <BarChart data={slice('currentAccount')}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip formatter={(v) => `\u20ac${v.toLocaleString()}m`} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
          <Bar dataKey="value" name="Current Account" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  )
}

function RatesTab({ errors, loading, latest, slice, data }) {
  const bondYield = latest('bondYields')
  const euroRate = latest('euroAreaRates')
  const spread = latest('bundSpread')
  const eurGbp = latest('eurGbp')
  const eurUsd = latest('eurUsd')

  // Merge bond yields, euro area rates, and bund spread
  const ratesMerged = (() => {
    const bData = data.bondYields || []
    const eData = data.euroAreaRates || []
    const sData = data.bundSpread || []
    const map = new Map()
    bData.forEach((d) => map.set(d.period, { period: d.period, bondYield: d.value }))
    eData.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.euroRate = d.value
      map.set(d.period, existing)
    })
    sData.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.spread = d.value
      map.set(d.period, existing)
    })
    return Array.from(map.values())
      .sort((a, b) => (a.period < b.period ? -1 : 1))
      .slice(-60)
  })()

  // Merge exchange rates
  const fxMerged = (() => {
    const gbpData = data.eurGbp || []
    const usdData = data.eurUsd || []
    const map = new Map()
    gbpData.forEach((d) => map.set(d.period, { period: d.period, eurGbp: d.value }))
    usdData.forEach((d) => {
      const existing = map.get(d.period) || { period: d.period }
      existing.eurUsd = d.value
      map.set(d.period, existing)
    })
    return Array.from(map.values())
      .sort((a, b) => (a.period < b.period ? -1 : 1))
      .slice(-36)
  })()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="10Y Bond Yield"
          value={bondYield ? `${bondYield.value}%` : '\u2014'}
          subtitle={bondYield ? `${bondYield.period} \u00b7 Eurostat` : errors.bondYields ? 'Unavailable' : 'Loading\u2026'}
          icon={TrendingUp}
          color="indigo"
          loading={loading}
        />
        <KpiCard
          title="Spread to Bund"
          value={spread ? `${spread.value} pp` : '\u2014'}
          subtitle={spread ? `${spread.period} \u00b7 IE minus DE` : errors.bundSpread ? 'Unavailable' : 'Loading\u2026'}
          icon={ArrowUpDown}
          color="slate"
          loading={loading}
        />
        <KpiCard
          title="EUR/GBP"
          value={eurGbp ? `\u00a3${eurGbp.value}` : '\u2014'}
          subtitle={eurGbp ? `${eurGbp.period} \u00b7 Eurostat` : errors.eurGbp ? 'Unavailable' : 'Loading\u2026'}
          icon={Banknote}
          color="green"
          loading={loading}
        />
        <KpiCard
          title="EUR/USD"
          value={eurUsd ? `$${eurUsd.value}` : '\u2014'}
          subtitle={eurUsd ? `${eurUsd.period} \u00b7 Eurostat` : errors.eurUsd ? 'Unavailable' : 'Loading\u2026'}
          icon={Banknote}
          color="sky"
          loading={loading}
        />
      </div>

      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">
            The 10-year bond yield is the EMU convergence criterion rate for Ireland.
            The spread to Bund (German 10yr) reflects Irish sovereign risk premium.
            EUR/GBP above \u00a30.90 is seen as a critical point for Ireland-UK trade.
          </p>
        </CardContent>
      </Card>

      <ChartCard
        title="Bond Yield, Bund Spread & Euro 3M Rate (%, monthly)"
        subtitle="Source: Eurostat irt_lt_mcby_m, irt_st_m"
        loading={loading}
        error={errors.bondYields && errors.euroAreaRates ? errors.bondYields : undefined}
        data={ratesMerged}
      >
        <LineChart data={ratesMerged}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="bondYield" name="IE 10Y Bond" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="euroRate" name="Euro 3M Rate" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="spread" name="Spread to Bund" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
        </LineChart>
      </ChartCard>

      <ChartCard
        title="Exchange Rates (monthly average)"
        subtitle="Source: Eurostat ert_bil_eur_m"
        loading={loading}
        error={errors.eurGbp && errors.eurUsd ? 'Exchange rate data unavailable' : undefined}
        data={fxMerged}
      >
        <LineChart data={fxMerged}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <ReferenceLine y={0.9} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '\u00a30.90', position: 'left', fontSize: 10, fill: '#ef4444' }} />
          <Line type="monotone" dataKey="eurGbp" name="EUR/GBP" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="eurUsd" name="EUR/USD" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ChartCard>
    </div>
  )
}
