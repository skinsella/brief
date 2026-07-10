import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Briefcase, Users, TrendingUp, Info } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  fetchEmploymentRate,
  fetchActivityRate,
  fetchYouthEmploymentRate,
  fetchEmploymentRateComparison,
  fetchEmploymentByNACE,
  NACE_A10_LABELS,
} from '@/services/indicators'

// Pivot long-form { period, geoLabel, value } into recharts-friendly
// rows: { period, [geoLabel]: value, ... }
function pivotByGeo(rows) {
  const byPeriod = new Map()
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period })
    byPeriod.get(r.period)[r.geoLabel] = r.value
  }
  return Array.from(byPeriod.values())
}

// Pivot long-form { period, sectorLabel, value } into recharts rows.
function pivotBySector(rows) {
  const byPeriod = new Map()
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period })
    byPeriod.get(r.period)[r.sectorLabel] = r.value
  }
  return Array.from(byPeriod.values())
}

export default function Employment() {
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const fetchers = {
        employmentRate:     fetchEmploymentRate,
        activityRate:       fetchActivityRate,
        youthEmployment:    fetchYouthEmploymentRate,
        employmentPeers:    fetchEmploymentRateComparison,
        employmentByNACE:   fetchEmploymentByNACE,
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

  function latest(key) {
    const s = data[key]
    return s && s.length > 0 ? s[s.length - 1] : null
  }

  const empLatest   = latest('employmentRate')
  const actLatest   = latest('activityRate')
  const youthLatest = latest('youthEmployment')

  const peerChartData = useMemo(
    () => pivotByGeo(data.employmentPeers || []),
    [data.employmentPeers],
  )

  const { sectorLatestPeriod, sectorBarData } = useMemo(() => {
    const rows = data.employmentByNACE || []
    if (rows.length === 0) return { sectorLatestPeriod: null, sectorBarData: [] }
    // Find the latest period and build a bar-chart-friendly array
    const latestPeriod = rows.reduce((acc, r) => r.period > acc ? r.period : acc, rows[0].period)
    const latestRows = rows.filter(r => r.period === latestPeriod)
    const bar = latestRows
      .map(r => ({ sector: r.sectorLabel, value: r.value }))
      .sort((a, b) => b.value - a.value)
    return { sectorLatestPeriod: latestPeriod, sectorBarData: bar }
  }, [data.employmentByNACE])

  const sectorSharePct = useMemo(() => {
    const total = sectorBarData.reduce((s, r) => s + (r.value || 0), 0) || 1
    return sectorBarData.map(r => ({ ...r, share: Math.round((r.value / total) * 1000) / 10 }))
  }, [sectorBarData])

  const peerLabels = useMemo(() => {
    const rows = data.employmentPeers || []
    const set = new Set(rows.map(r => r.geoLabel))
    return Array.from(set)
  }, [data.employmentPeers])

  const empTrend = data.employmentRate || []
  const totalEmployment = sectorBarData.reduce((s, r) => s + (r.value || 0), 0)

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Employment Structure</h1>
        <p className="text-slate-500 mt-1">
          Labour-market headline rates, sectoral composition and peer benchmarks — Eurostat LFS &amp; national-accounts employment.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Employment rate (20-64)"
          value={empLatest ? `${empLatest.value}%` : '—'}
          subtitle={empLatest ? `${empLatest.period} · Eurostat lfsi_emp_q · SA` : 'Loading…'}
          icon={Briefcase}
          color="emerald"
          loading={loading}
        />
        <KpiCard
          title="Activity rate (20-64)"
          value={actLatest ? `${actLatest.value}%` : '—'}
          subtitle={actLatest ? `${actLatest.period} · labour force / population · SA` : 'Loading…'}
          icon={TrendingUp}
          color="sky"
          loading={loading}
        />
        <KpiCard
          title="Youth employment (15-24)"
          value={youthLatest ? `${youthLatest.value}%` : '—'}
          subtitle={youthLatest ? `${youthLatest.period} · SA` : 'Loading…'}
          icon={Users}
          color="indigo"
          loading={loading}
        />
        <KpiCard
          title="Total employment"
          value={totalEmployment > 0 ? `${Math.round(totalEmployment).toLocaleString()}k` : '—'}
          subtitle={sectorLatestPeriod ? `${sectorLatestPeriod} · sum of NACE A10 sectors` : 'Loading…'}
          icon={Users}
          color="violet"
          loading={loading}
        />
      </div>

      {/* Context card */}
      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-900">
            Ireland's labour market reached a record employment rate above 75% of 20-64s in 2023-24 and has plateaued near that level since.
            The services-heavy composition — especially Information &amp; Communication and Professional services — reflects the concentration
            of multinational activity; goods-producing sectors (Agriculture, Industry ex-construction, Construction) together account for a smaller
            share than in most EU peers.
          </p>
        </CardContent>
      </Card>

      {/* Time series */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Employment rate (20-64)"
          subtitle="Ireland · quarterly · SA · Eurostat lfsi_emp_q"
          loading={loading}
          error={errors.employmentRate}
          data={empTrend}
        >
          <LineChart data={empTrend} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[4]} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Employment rate vs peers"
          subtitle="20-64, quarterly, SA — IE vs EA, EU27, DE, NL, FR"
          loading={loading}
          error={errors.employmentPeers}
          data={peerChartData}
        >
          <LineChart data={peerChartData} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
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
      </div>

      {/* Sectoral composition */}
      <ChartCard
        title={`Employment by NACE A10 sector${sectorLatestPeriod ? ` — ${sectorLatestPeriod}` : ''}`}
        subtitle="Thousands of persons, domestic concept, SCA — Eurostat namq_10_a10_e"
        loading={loading}
        error={errors.employmentByNACE}
        data={sectorSharePct}
      >
        <BarChart data={sectorSharePct} layout="vertical" margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis type="category" dataKey="sector" tick={{ fontSize: 10 }} width={210} stroke="#94a3b8" />
          <Tooltip formatter={(v, n, p) => [`${v}k (${p.payload.share}%)`, 'Employed']} />
          <Bar dataKey="value" fill={CHART_COLORS[1]} />
        </BarChart>
      </ChartCard>

      <p className="text-xs text-slate-400 text-center pt-4">
        Sources: Eurostat <code>lfsi_emp_q</code> (employment &amp; activity rates), <code>namq_10_a10_e</code> (national-accounts employment by NACE A10 sector).
        Rates are % of population aged 20-64; youth rate uses age 15-24. Peer chart shows Ireland, Euro Area, EU 27, Germany, Netherlands, France.
      </p>
    </motion.div>
  )
}
