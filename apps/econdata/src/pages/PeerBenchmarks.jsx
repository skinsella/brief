import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { BookOpen, FlaskConical, Zap, Info } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  fetchProductivityPerHourComparison,
  fetchRDIntensityComparison,
  fetchTertiaryEducationComparison,
  fetchEducationSpendComparison,
  fetchGDPPerCapitaComparison,
} from '@/services/indicators'

function pivotByGeo(rows) {
  const byPeriod = new Map()
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period })
    byPeriod.get(r.period)[r.geoLabel] = r.value
  }
  return Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period))
}

function latestByGeo(rows, geoLabel) {
  const filtered = rows.filter(r => r.geoLabel === geoLabel)
  if (filtered.length === 0) return null
  return filtered.reduce((acc, r) => (r.period > acc.period ? r : acc), filtered[0])
}

function geosInRows(rows) {
  const seen = new Set()
  const order = []
  for (const r of rows) {
    if (!seen.has(r.geoLabel)) { seen.add(r.geoLabel); order.push(r.geoLabel) }
  }
  return order
}

export default function PeerBenchmarks() {
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const fetchers = {
        productivity:  fetchProductivityPerHourComparison,
        rd:            fetchRDIntensityComparison,
        tertiary:      fetchTertiaryEducationComparison,
        eduSpend:      fetchEducationSpendComparison,
        gdpPerCapita:  fetchGDPPerCapitaComparison,
      }

      const keys = Object.keys(fetchers)
      const results = await Promise.allSettled(keys.map(k => fetchers[k]()))

      if (cancelled) return
      const newData = {}, newErrors = {}
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

  const productivity = data.productivity || []
  const rd           = data.rd || []
  const tertiary     = data.tertiary || []
  const eduSpend     = data.eduSpend || []
  const gdpPC        = data.gdpPerCapita || []

  const productivityChart = useMemo(() => pivotByGeo(productivity), [productivity])
  const rdChart           = useMemo(() => pivotByGeo(rd), [rd])
  const tertiaryChart     = useMemo(() => pivotByGeo(tertiary), [tertiary])
  const eduSpendChart     = useMemo(() => pivotByGeo(eduSpend), [eduSpend])
  const gdpPCChart        = useMemo(() => pivotByGeo(gdpPC), [gdpPC])

  // Latest snapshot bars — Ireland vs peers for the most recent year we have
  const latestSnapshot = useMemo(() => {
    function snapshotFromRows(rows) {
      if (!rows || rows.length === 0) return []
      // pick the latest period that Ireland actually has data for, to avoid
      // missing bars from peers that report with a lag.
      const ireRows = rows.filter(r => r.geoLabel === 'Ireland')
      if (ireRows.length === 0) return []
      const latestPeriod = ireRows.reduce((m, r) => r.period > m ? r.period : m, ireRows[0].period)
      const keep = rows.filter(r => r.period === latestPeriod)
      return keep
    }
    return {
      productivity: snapshotFromRows(productivity),
      rd:           snapshotFromRows(rd),
      tertiary:     snapshotFromRows(tertiary),
      eduSpend:     snapshotFromRows(eduSpend),
      gdpPC:        snapshotFromRows(gdpPC),
    }
  }, [productivity, rd, tertiary, eduSpend, gdpPC])

  const latestIE = {
    productivity: latestByGeo(productivity, 'Ireland'),
    rd:           latestByGeo(rd, 'Ireland'),
    tertiary:     latestByGeo(tertiary, 'Ireland'),
    eduSpend:     latestByGeo(eduSpend, 'Ireland'),
    gdpPC:        latestByGeo(gdpPC, 'Ireland'),
  }

  function barChart(snapshot, fmt = v => v) {
    return (
      <BarChart data={snapshot.map(r => ({ name: r.geoLabel, value: r.value }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip formatter={v => fmt(v)} />
        <Bar dataKey="value" fill={CHART_COLORS[1]} />
      </BarChart>
    )
  }

  function multiLine(rows, fmt) {
    const labels = geosInRows(rows)
    return (
      <LineChart data={rows} margin={{ left: -10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip formatter={fmt || (v => v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {labels.map((g, i) => (
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
    )
  }

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Peer Benchmarks</h1>
        <p className="text-slate-500 mt-1">
          Ireland vs Euro Area, EU27, Germany, Netherlands and France on productivity, innovation and human capital.
        </p>
      </div>

      <Card className="border-indigo-200 bg-indigo-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
          <p className="text-sm text-indigo-900">
            Data are drawn from Eurostat (productivity, R&amp;D, education attainment and government education spend) and the World Bank (GDP per capita in current US$).
            A direct OECD Data Explorer integration is planned — the OECD SDMX API (<code>sdmx.oecd.org</code>) has migrated to SDMX 2.0 which requires a parser update in <code>src/services/oecd.js</code>.
          </p>
        </CardContent>
      </Card>

      {/* Headline KPIs for Ireland */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Productivity / hour"
          value={latestIE.productivity ? `${latestIE.productivity.value}` : '—'}
          subtitle={latestIE.productivity ? `${latestIE.productivity.period} · index 2015=100 · Ireland` : 'Loading…'}
          icon={Zap}
          color="emerald"
          loading={loading}
        />
        <KpiCard
          title="R&D intensity"
          value={latestIE.rd ? `${latestIE.rd.value}%` : '—'}
          subtitle={latestIE.rd ? `${latestIE.rd.period} · % of GDP · Ireland` : 'Loading…'}
          icon={FlaskConical}
          color="sky"
          loading={loading}
        />
        <KpiCard
          title="Tertiary attainment 25-34"
          value={latestIE.tertiary ? `${latestIE.tertiary.value}%` : '—'}
          subtitle={latestIE.tertiary ? `${latestIE.tertiary.period} · Ireland` : 'Loading…'}
          icon={BookOpen}
          color="violet"
          loading={loading}
        />
        <KpiCard
          title="GDP per capita"
          value={latestIE.gdpPC ? `$${(latestIE.gdpPC.value / 1000).toFixed(1)}k` : '—'}
          subtitle={latestIE.gdpPC ? `${latestIE.gdpPC.period} · current US$ · Ireland` : 'Loading…'}
          icon={Zap}
          color="indigo"
          loading={loading}
        />
      </div>

      {/* Latest snapshot bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Labour productivity — latest snapshot"
          subtitle="Real GDP per hour worked, index 2015=100 · Eurostat nama_10_lp_ulc"
          loading={loading}
          error={errors.productivity}
          data={latestSnapshot.productivity}
        >
          {barChart(latestSnapshot.productivity)}
        </ChartCard>
        <ChartCard
          title="R&D intensity — latest snapshot"
          subtitle="Gross R&D expenditure as % of GDP · Eurostat rd_e_gerdtot"
          loading={loading}
          error={errors.rd}
          data={latestSnapshot.rd}
        >
          {barChart(latestSnapshot.rd, v => `${v}%`)}
        </ChartCard>
        <ChartCard
          title="Tertiary attainment (25-34) — latest snapshot"
          subtitle="Share of 25-34 year-olds with ISCED 5-8 · Eurostat edat_lfse_03"
          loading={loading}
          error={errors.tertiary}
          data={latestSnapshot.tertiary}
        >
          {barChart(latestSnapshot.tertiary, v => `${v}%`)}
        </ChartCard>
        <ChartCard
          title="Gov education spend — latest snapshot"
          subtitle="COFOG GF09 general government expenditure · Eurostat gov_10a_exp"
          loading={loading}
          error={errors.eduSpend}
          data={latestSnapshot.eduSpend}
        >
          {barChart(latestSnapshot.eduSpend, v => `${v}% GDP`)}
        </ChartCard>
      </div>

      {/* Full time series */}
      <ChartCard
        title="Labour productivity per hour — time series"
        subtitle="Real GDP per hour worked · index 2015=100 · Eurostat nama_10_lp_ulc"
        loading={loading}
        error={errors.productivity}
        data={productivityChart}
      >
        {multiLine(productivityChart)}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="R&D intensity — time series"
          subtitle="Gross R&D expenditure, % GDP · Eurostat rd_e_gerdtot"
          loading={loading}
          error={errors.rd}
          data={rdChart}
        >
          {multiLine(rdChart, v => `${v}%`)}
        </ChartCard>
        <ChartCard
          title="Tertiary attainment — time series"
          subtitle="25-34 year-olds, ISCED 5-8, % · Eurostat edat_lfse_03"
          loading={loading}
          error={errors.tertiary}
          data={tertiaryChart}
        >
          {multiLine(tertiaryChart, v => `${v}%`)}
        </ChartCard>
      </div>

      <ChartCard
        title="GDP per capita (current US$) — incl. US &amp; UK comparators"
        subtitle="World Bank NY.GDP.PCAP.CD"
        loading={loading}
        error={errors.gdpPerCapita}
        data={gdpPCChart}
      >
        {multiLine(gdpPCChart, v => `$${Math.round(v / 1000)}k`)}
      </ChartCard>

      <p className="text-xs text-slate-400 text-center pt-4">
        Sources: Eurostat <code>nama_10_lp_ulc</code>, <code>rd_e_gerdtot</code>, <code>edat_lfse_03</code>, <code>gov_10a_exp</code>; World Bank <code>NY.GDP.PCAP.CD</code>.
        Ireland's GDP-based metrics are distorted by multinational activity; productivity-per-hour and per-capita numbers should be read alongside Ireland's Modified Domestic Demand on the Irish Economy page.
      </p>
    </motion.div>
  )
}
