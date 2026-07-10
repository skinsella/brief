import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ChartCard } from '@/components/ChartCard'
import {
  fetchGDPGrowthComparison,
  fetchUnemploymentComparison,
  fetchInflationComparison,
  fetchDebtComparison,
  fetchBondYieldComparison,
} from '@/services/indicators'

const tabs = ['GDP Growth', 'Unemployment', 'Inflation', 'Debt', 'Bond Yields']

const COUNTRY_COLORS = {
  Ireland: '#0ea5e9',
  'Euro Area': '#f59e0b',
  EU: '#6366f1',
  Germany: '#10b981',
  Netherlands: '#f43f5e',
  France: '#8b5cf6',
}

const COUNTRY_KEYS = Object.keys(COUNTRY_COLORS)

/**
 * Pivot flat comparison data (with geoLabel) into one object per period,
 * with a key for each country. Then keep only the last `n` periods.
 */
function pivot(raw, n = 12) {
  const map = new Map()
  raw.forEach(({ period, value, geoLabel }) => {
    if (!map.has(period)) map.set(period, { period })
    map.get(period)[geoLabel] = value
  })
  return Array.from(map.values())
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .slice(-n)
}

export default function Benchmarks() {
  const [activeTab, setActiveTab] = useState('GDP Growth')
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const fetchers = {
        gdp: fetchGDPGrowthComparison,
        unemployment: fetchUnemploymentComparison,
        inflation: fetchInflationComparison,
        debt: fetchDebtComparison,
        bondYields: fetchBondYieldComparison,
      }

      const keys = Object.keys(fetchers)
      const results = await Promise.allSettled(keys.map((k) => fetchers[k]()))

      if (cancelled) return

      const newData = {}
      const newErrors = {}

      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          newData[keys[i]] = pivot(result.value)
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

  function renderChart(dataKey, title, subtitle, unit = '%') {
    return (
      <ChartCard title={title} subtitle={subtitle} loading={loading} error={errors[dataKey]}>
        <LineChart data={data[dataKey] || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip formatter={(v) => `${v}${unit}`} />
          <Legend />
          {COUNTRY_KEYS.map((country) => (
            <Line
              key={country}
              type="monotone"
              dataKey={country}
              name={country}
              stroke={COUNTRY_COLORS[country]}
              strokeWidth={country === 'Ireland' ? 2.5 : 1.5}
              dot={{ r: country === 'Ireland' ? 3 : 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ChartCard>
    )
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'GDP Growth':
        return renderChart('gdp', 'GDP Growth (% YoY, quarterly)', 'Source: Eurostat namq_10_gdp')
      case 'Unemployment':
        return renderChart('unemployment', 'Unemployment Rate (%, monthly, SA)', 'Source: Eurostat une_rt_m')
      case 'Inflation':
        return renderChart('inflation', 'HICP Inflation (% YoY, monthly)', 'Source: Eurostat prc_hicp_manr')
      case 'Debt':
        return renderChart('debt', 'Government Debt (% of GDP, annual)', 'Source: Eurostat gov_10dd_edpt1')
      case 'Bond Yields':
        return renderChart('bondYields', '10-Year Government Bond Yields (%, monthly)', 'Source: Eurostat irt_lt_mcby_m')
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
        <h1 className="text-3xl font-bold text-slate-900">International Benchmarks</h1>
        <p className="text-slate-500 mt-1">Ireland compared to European peers — live Eurostat data</p>
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
