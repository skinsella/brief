import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Activity, Flame, UtensilsCrossed, ShoppingBag, Briefcase, TrendingUp, Info,
} from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  fetchHICPInflation,
  fetchCoreInflation,
  fetchSuperCoreInflation,
  fetchServicesInflation,
  fetchGoodsInflation,
  fetchEnergyInflation,
  fetchFoodInflation,
  fetchUnprocessedFoodInflation,
  fetchPriceTrendsPerceived,
  fetchPriceTrendsExpected,
  fetchProducerPrices,
  fetchEnergyProducerPrices,
  fetchInflationComparison,
  fetchHICPByCOICOP,
  HICP_COICOP_LABELS,
} from '@/services/indicators'

// Align multiple component time series on period. Each fetcher returns
// [{ period, rawPeriod, value }, ...] — merge into
// [{ period, rawPeriod, services, goods, energy, food, ... }, ...].
function mergeOnPeriod(seriesMap) {
  const byRaw = new Map()
  for (const [key, rows] of Object.entries(seriesMap)) {
    for (const r of rows) {
      const raw = r.rawPeriod || r.period
      if (!byRaw.has(raw)) byRaw.set(raw, { rawPeriod: raw, period: r.period })
      byRaw.get(raw)[key] = r.value
    }
  }
  return Array.from(byRaw.values()).sort((a, b) => a.rawPeriod.localeCompare(b.rawPeriod))
}

function pivotByGeo(rows) {
  const byPeriod = new Map()
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period })
    byPeriod.get(r.period)[r.geoLabel] = r.value
  }
  return Array.from(byPeriod.values())
}

// Pick latest row from an ordered series.
function last(arr) {
  return arr && arr.length > 0 ? arr[arr.length - 1] : null
}

export default function Inflation() {
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const fetchers = {
        headline:         fetchHICPInflation,
        core:             fetchCoreInflation,
        superCore:        fetchSuperCoreInflation,
        services:         fetchServicesInflation,
        goods:            fetchGoodsInflation,
        energy:           fetchEnergyInflation,
        food:             fetchFoodInflation,
        unprocFood:       fetchUnprocessedFoodInflation,
        perceived:        fetchPriceTrendsPerceived,
        expected:         fetchPriceTrendsExpected,
        ppi:              fetchProducerPrices,
        ppiEnergy:        fetchEnergyProducerPrices,
        peers:            fetchInflationComparison,
        hicpByCoicop:     fetchHICPByCOICOP,
      }

      const keys = Object.keys(fetchers)
      const results = await Promise.allSettled(keys.map(k => fetchers[k]()))

      if (cancelled) return
      const newData = {}
      const newErrors = {}
      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          newData[keys[i]] = result.value
        } else {
          newErrors[keys[i]] =
            result.status === 'rejected'
              ? result.reason?.message || 'Unknown error'
              : 'No data available'
        }
      })

      setData(newData)
      setErrors(newErrors)
      setLoading(false)
    }

    loadAll()
    return () => { cancelled = true }
  }, [])

  // Merge component series for the stacked-split chart
  const componentsMerged = useMemo(() => mergeOnPeriod({
    headline:  data.headline  || [],
    core:      data.core      || [],
    superCore: data.superCore || [],
    services:  data.services  || [],
    goods:     data.goods     || [],
    energy:    data.energy    || [],
    food:      data.food      || [],
  }), [data.headline, data.core, data.superCore, data.services, data.goods, data.energy, data.food])

  const headlineVsCore = useMemo(() => mergeOnPeriod({
    headline: data.headline  || [],
    core:     data.core      || [],
    superCore: data.superCore || [],
  }), [data.headline, data.core, data.superCore])

  const expectations = useMemo(() => mergeOnPeriod({
    perceived: data.perceived || [],
    expected:  data.expected  || [],
  }), [data.perceived, data.expected])

  const producerSeries = useMemo(() => mergeOnPeriod({
    ppi:       data.ppi       || [],
    ppiEnergy: data.ppiEnergy || [],
  }), [data.ppi, data.ppiEnergy])

  // HICP by ECOICOP division: latest snapshot
  const coicopLatestBars = useMemo(() => {
    const rows = data.hicpByCoicop || []
    if (rows.length === 0) return { period: null, bars: [] }
    const latestRaw = rows.reduce((acc, r) => (r.rawPeriod > acc ? r.rawPeriod : acc), rows[0].rawPeriod)
    const keep = rows.filter(r => r.rawPeriod === latestRaw)
    const sorted = keep.slice().sort((a, b) => b.value - a.value)
    return {
      period: sorted[0]?.period || null,
      bars: sorted.map(r => ({
        group: r.coicopLabel || HICP_COICOP_LABELS[r.coicop] || r.coicop,
        value: r.value,
      })),
    }
  }, [data.hicpByCoicop])

  const peersChart = useMemo(() => pivotByGeo(data.peers || []), [data.peers])
  const peerLabels = useMemo(() => {
    const s = new Set()
    for (const r of (data.peers || [])) s.add(r.geoLabel)
    return Array.from(s)
  }, [data.peers])

  const head = last(data.headline)
  const core = last(data.core)
  const sup  = last(data.superCore)
  const srv  = last(data.services)
  const nrg  = last(data.energy)
  const fd   = last(data.food)
  const ppi  = last(data.ppi)
  const exp  = last(data.expected)

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Inflation</h1>
        <p className="text-slate-500 mt-1">
          Headline HICP, core, economic-class split, producer prices, consumer expectations and CSO COICOP divisions — all updated as of the latest Eurostat / CSO release.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900">
            All HICP series on this page come from Eurostat <code>ei_cphi_m</code>, the current-vintage monthly
            HICP dataset (refreshed mid-month, ~2 weeks after the reference month). The legacy
            <code>prc_hicp_manr</code> / <code>prc_hicp_midx</code> datasets are frozen at the 2025 vintage and
            stop in December 2025 — they are no longer used here. Producer prices (Eurostat <code>sts_inppd_m</code>)
            are a leading upstream signal; sharp moves in energy PPI typically feed through into headline HICP
            2-6 months later.
          </p>
        </CardContent>
      </Card>

      {/* Top KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Headline HICP"
          value={head ? `${head.value}%` : '—'}
          subtitle={head ? `${head.period} · YoY · Eurostat` : 'Loading…'}
          icon={Activity}
          color="rose"
          loading={loading}
        />
        <KpiCard
          title="Core (ex energy, unproc. food)"
          value={core ? `${core.value}%` : '—'}
          subtitle={core ? `${core.period} · YoY` : 'Loading…'}
          icon={Activity}
          color="indigo"
          loading={loading}
        />
        <KpiCard
          title="Super-core (services ex volatile)"
          value={sup ? `${sup.value}%` : '—'}
          subtitle={sup ? `${sup.period} · ex energy, food, alc, tob` : 'Loading…'}
          icon={Briefcase}
          color="violet"
          loading={loading}
        />
        <KpiCard
          title="Services"
          value={srv ? `${srv.value}%` : '—'}
          subtitle={srv ? `${srv.period} · YoY · typically sticky` : 'Loading…'}
          icon={Briefcase}
          color="sky"
          loading={loading}
        />
        <KpiCard
          title="Energy"
          value={nrg ? `${nrg.value}%` : '—'}
          subtitle={nrg ? `${nrg.period} · YoY` : 'Loading…'}
          icon={Flame}
          color="orange"
          loading={loading}
        />
        <KpiCard
          title="Food (incl. alc. & tob.)"
          value={fd ? `${fd.value}%` : '—'}
          subtitle={fd ? `${fd.period} · YoY` : 'Loading…'}
          icon={UtensilsCrossed}
          color="green"
          loading={loading}
        />
        <KpiCard
          title="Producer prices (PPI)"
          value={ppi ? `${ppi.value}%` : '—'}
          subtitle={ppi ? `${ppi.period} · YoY · industry ex water` : 'Loading…'}
          icon={ShoppingBag}
          color="cyan"
          loading={loading}
        />
        <KpiCard
          title="Price expectations"
          value={exp ? `${exp.value}` : '—'}
          subtitle={exp ? `${exp.period} · balance · next 12 mths` : 'Loading…'}
          icon={TrendingUp}
          color="amber"
          loading={loading}
        />
      </div>

      {/* Headline vs core vs super-core */}
      <ChartCard
        title="Headline vs core vs super-core HICP"
        subtitle="Ireland · YoY % · Eurostat prc_hicp_manr. 2% reference line marks the ECB target."
        loading={loading}
        error={errors.headline}
        data={headlineVsCore}
      >
        <LineChart data={headlineVsCore} margin={{ left: -10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip formatter={v => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={2} stroke="#64748b" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="headline"  name="Headline"   stroke={CHART_COLORS[5]} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="core"      name="Core"       stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="superCore" name="Super-core" stroke={CHART_COLORS[6]} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ChartCard>

      {/* Component split: services / goods / energy / food */}
      <ChartCard
        title="HICP by economic class — what is driving the headline?"
        subtitle="Ireland · YoY % · services, non-energy goods, energy and food. Energy is the volatile driver; services is the persistent one."
        loading={loading}
        error={errors.services}
        data={componentsMerged}
      >
        <LineChart data={componentsMerged} margin={{ left: -10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip formatter={v => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Line type="monotone" dataKey="services" name="Services"         stroke="#0ea5e9" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="goods"    name="Goods (ex energy)" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="energy"   name="Energy"            stroke="#f97316" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="food"     name="Food"              stroke="#f43f5e" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      {/* Producer prices + expectations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Producer prices — leading signal"
          subtitle="Ireland · YoY % · sts_inppd_m · PPI B-E36 (industry) and D35 (electricity, gas)"
          loading={loading}
          error={errors.ppi}
          data={producerSeries}
        >
          <LineChart data={producerSeries} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip formatter={v => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Line type="monotone" dataKey="ppi"       name="Industry PPI" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ppiEnergy" name="Energy PPI (D35)" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Consumer price perception vs expectation"
          subtitle="Ireland · balance (SA) · Eurostat ei_bsco_m · BS-PT-LY / BS-PT-NY. Higher = more households expect rising prices."
          loading={loading}
          error={errors.perceived}
          data={expectations}
        >
          <LineChart data={expectations} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Line type="monotone" dataKey="perceived" name="Past 12m (perception)" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="expected"  name="Next 12m (expectation)" stroke={CHART_COLORS[5]} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ChartCard>
      </div>

      {/* HICP by ECOICOP division, latest snapshot */}
      <ChartCard
        title={`HICP by ECOICOP division — ${coicopLatestBars.period ?? 'loading…'}`}
        subtitle="Ireland · YoY % for the 13 ECOICOP divisions · Eurostat ei_cphi_m (current vintage). Housing/water/energy and restaurants often lead the ranking; transport is typically the most volatile."
        loading={loading}
        error={errors.hicpByCoicop}
        data={coicopLatestBars.bars}
      >
        <BarChart data={coicopLatestBars.bars} layout="vertical" margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis type="category" dataKey="group" tick={{ fontSize: 10 }} width={240} stroke="#94a3b8" />
          <Tooltip formatter={v => `${v}%`} />
          <ReferenceLine x={0} stroke="#cbd5e1" />
          <Bar dataKey="value" fill={CHART_COLORS[5]} />
        </BarChart>
      </ChartCard>

      {/* Peer comparison */}
      <ChartCard
        title="Headline HICP — Ireland vs peers"
        subtitle="YoY % · Ireland, Euro Area, EU27, Germany, Netherlands, France · Eurostat prc_hicp_manr"
        loading={loading}
        error={errors.peers}
        data={peersChart}
      >
        <LineChart data={peersChart} margin={{ left: -10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip formatter={v => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={2} stroke="#64748b" strokeDasharray="4 4" />
          {peerLabels.map((g, i) => (
            <Line
              key={g}
              type="monotone"
              dataKey={g}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={g === 'Ireland' ? 2.5 : 1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartCard>

      <p className="text-xs text-slate-400 text-center pt-4">
        Sources: Eurostat <code>ei_cphi_m</code> (headline + 13 ECOICOP divisions + economic-class aggregates, RT12 annual rate),
        <code>sts_inppd_m</code> (PPI, industry &amp; D35 energy, PCH_SM), <code>ei_bsco_m</code> (consumer survey BS-PT-LY / BS-PT-NY balances).
        The legacy <code>prc_hicp_manr</code> dataset (frozen at the 2025 vintage) is no longer used.
        Reference line at 2% marks the ECB inflation target.
      </p>
    </motion.div>
  )
}
