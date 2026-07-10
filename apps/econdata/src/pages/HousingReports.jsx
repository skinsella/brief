import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Home } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { ReportCard } from '@/components/ReportCard'
import { HOUSING_REPORTS, CHART_COLORS } from '@/lib/constants'
import { fetchHousePriceIndex } from '@/services/indicators'

export default function HousingReports() {
  const [hpiData, setHpiData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchHousePriceIndex()
      .then((d) => { if (!cancelled) setHpiData(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const latestHpi = hpiData.length > 0 ? hpiData[hpiData.length - 1] : null

  // Calculate YoY change if we have enough data
  const yoyChange = (() => {
    if (hpiData.length < 5) return null // need at least 4 quarters back
    const current = hpiData[hpiData.length - 1]
    const yearAgo = hpiData[hpiData.length - 5] // 4 quarters back
    if (!current || !yearAgo || !yearAgo.value) return null
    return Math.round(((current.value - yearAgo.value) / yearAgo.value) * 1000) / 10
  })()

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Housing Reports</h1>
        <p className="text-slate-500 mt-1">Residential property data and analysis for Ireland</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="House Price Index"
          value={latestHpi ? `${latestHpi.value}` : '—'}
          subtitle={latestHpi ? `${latestHpi.period} · Eurostat (2015=100)` : 'Loading\u2026'}
          icon={Home}
          color="violet"
          loading={loading}
        />
        <KpiCard
          title="Annual Change"
          value={yoyChange !== null ? `${yoyChange > 0 ? '+' : ''}${yoyChange}%` : '—'}
          subtitle={yoyChange !== null ? 'YoY · calculated from HPI' : 'Loading\u2026'}
          icon={Home}
          color="emerald"
          loading={loading}
        />
      </div>

      <ChartCard
        title="House Price Index (2015=100, quarterly)"
        subtitle="Source: Eurostat prc_hpi_q"
        loading={loading}
        error={error}
      >
        <LineChart data={hpiData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[4]}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS[4] }}
          />
        </LineChart>
      </ChartCard>

      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Key Housing Sources</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {HOUSING_REPORTS.map((report) => (
            <ReportCard key={report.title} report={report} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
