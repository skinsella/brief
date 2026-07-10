import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartCard } from '@/components/ChartCard'
import { ReportCard } from '@/components/ReportCard'
import { TRADE_REPORTS, CHART_COLORS } from '@/lib/constants'
import { fetchTradeToGDP } from '@/services/indicators'

const filters = ['All', 'wto', 'imf', 'eu_trade']
const filterLabels = { All: 'All', wto: 'WTO', imf: 'IMF', eu_trade: 'EU Trade' }

export default function TradeReports() {
  const [activeFilter, setActiveFilter] = useState('All')
  const [tradeData, setTradeData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchTradeToGDP()
      .then((d) => { if (!cancelled) setTradeData(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filteredReports =
    activeFilter === 'All'
      ? TRADE_REPORTS
      : TRADE_REPORTS.filter((r) => r.source === activeFilter)

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Trade Reports</h1>
        <p className="text-slate-500 mt-1">Global and EU trade analysis and outlook</p>
      </div>

      <ChartCard
        title="Ireland: Trade as % of GDP"
        subtitle="Source: World Bank (NE.TRD.GNFS.ZS)"
        loading={loading}
        error={error}
      >
        <LineChart data={tradeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip formatter={(v) => `${v}%`} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[1]}
            strokeWidth={2}
            dot={{ r: 4, fill: CHART_COLORS[1] }}
          />
        </LineChart>
      </ChartCard>

      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === f
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500">
          {filteredReports.length} source{filteredReports.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredReports.map((report) => (
          <ReportCard key={report.title} report={report} />
        ))}
      </div>
    </motion.div>
  )
}
