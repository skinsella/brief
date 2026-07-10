import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, Area, ComposedChart,
} from 'recharts'
import { TrendingUp, DollarSign, Users, Landmark, ArrowUpDown, Info, Globe } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import { fetchIMFMultiple, fetchGlobalGrowth, IMF_INDICATORS, IMF_LABELS, IMF_UNITS, GLOBAL_GROWTH_LABELS, GLOBAL_GROWTH_COLORS } from '@/services/imf'

const FORECAST_INDICATORS = [
  { code: 'NGDP_RPCH', icon: TrendingUp, color: 'sky', name: 'GDP Growth' },
  { code: 'PCPIPCH', icon: DollarSign, color: 'rose', name: 'Inflation' },
  { code: 'LUR', icon: Users, color: 'amber', name: 'Unemployment' },
  { code: 'GGXCNL_NGDP', icon: Landmark, color: 'green', name: 'Fiscal Balance' },
  { code: 'GGXWDG_NGDP', icon: Landmark, color: 'slate', name: 'Government Debt' },
  { code: 'BCA_NGDPD', icon: ArrowUpDown, color: 'indigo', name: 'Current Account' },
]

// Custom tooltip showing forecast flag
function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm text-slate-900">
        {label} {d?.forecast ? '(Forecast)' : '(Actual)'}
      </p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm" style={{ color: p.stroke || p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Outlook() {
  const [data, setData] = useState({})
  const [globalData, setGlobalData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const codes = Object.values(IMF_INDICATORS)
        const [result, global] = await Promise.all([
          fetchIMFMultiple(codes),
          fetchGlobalGrowth().catch(() => ({})),
        ])
        if (!cancelled) {
          setData(result)
          setGlobalData(global)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const currentYear = new Date().getFullYear()

  function getLatestActual(code) {
    const series = data[code]
    if (!series) return null
    const actuals = series.filter(d => !d.forecast)
    return actuals.length > 0 ? actuals[actuals.length - 1] : null
  }

  function getNextForecast(code) {
    const series = data[code]
    if (!series) return null
    const forecasts = series.filter(d => d.forecast)
    return forecasts.length > 0 ? forecasts[0] : null
  }

  function getChartData(code) {
    const series = data[code]
    if (!series) return []
    // Show from 2015 onwards
    return series.filter(d => parseInt(d.period) >= 2015)
  }

  // Build a merged dataset for the summary chart (all indicators, recent years)
  function buildSummaryData() {
    const years = []
    for (let y = 2020; y <= currentYear + 4; y++) years.push(String(y))

    return years.map(year => {
      const row = { period: year, forecast: parseInt(year) > currentYear }
      FORECAST_INDICATORS.forEach(ind => {
        const series = data[ind.code]
        if (series) {
          const point = series.find(d => d.period === year)
          if (point) row[ind.name] = point.value
        }
      })
      return row
    })
  }

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Economic Outlook</h1>
        <p className="text-slate-500 mt-1">
          IMF World Economic Outlook — actuals and forecasts for Ireland
        </p>
      </div>

      {/* ── KPI Cards: Latest + Next Forecast ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {FORECAST_INDICATORS.map(ind => {
          const actual = getLatestActual(ind.code)
          const forecast = getNextForecast(ind.code)
          const displayVal = forecast || actual
          const unit = IMF_UNITS[ind.code]

          return (
            <KpiCard
              key={ind.code}
              title={ind.name}
              value={displayVal ? `${displayVal.value}${unit}` : '\u2014'}
              subtitle={
                displayVal
                  ? `${displayVal.period} ${displayVal.forecast ? 'forecast' : 'actual'} \u00b7 IMF`
                  : loading ? 'Loading\u2026' : 'Unavailable'
              }
              icon={ind.icon}
              color={ind.color}
              loading={loading}
            />
          )
        })}
      </div>

      {/* ── Info Box ───────────────────────────────────────────────────── */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Forecasts are from the{' '}
            <a
              href="https://www.imf.org/en/Publications/WEO"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              IMF World Economic Outlook
            </a>{' '}
            (updated April and October each year). The shaded area on each chart marks
            the forecast horizon. Note that fiscal and debt ratios use GDP as denominator
            (IMF convention) — Ireland&apos;s GDP is inflated by multinational activity,
            so the Public Finances page uses GNI for a truer picture.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-800">Failed to load IMF data: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Individual Indicator Charts ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {FORECAST_INDICATORS.map((ind, i) => {
          const chartData = getChartData(ind.code)
          const unit = IMF_UNITS[ind.code]
          const hasData = chartData.length > 0

          return (
            <ChartCard
              key={ind.code}
              title={`${ind.name} (${unit}, annual)`}
              subtitle="Source: IMF World Economic Outlook"
              loading={loading}
              error={!loading && !hasData ? 'No data available' : undefined}
              data={chartData}
            >
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip content={<ForecastTooltip />} />
                <ReferenceLine x={String(currentYear)} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Now', position: 'top', fontSize: 10, fill: '#94a3b8' }} />
                {(ind.code === 'GGXCNL_NGDP' || ind.code === 'BCA_NGDPD') && (
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                )}
                {/* Forecast shading */}
                <Area
                  dataKey={(d) => d.forecast ? d.value : null}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.1}
                  stroke="none"
                  name="_forecast_area"
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={ind.name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    return (
                      <circle
                        key={`dot-${payload.period}`}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={payload.forecast ? '#fff' : CHART_COLORS[i % CHART_COLORS.length]}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={payload.forecast ? 2 : 0}
                      />
                    )
                  }}
                />
              </ComposedChart>
            </ChartCard>
          )
        })}
      </div>

      {/* ── Global GDP Growth Comparison ─────────────────────────────── */}
      {Object.keys(globalData).length > 0 && (() => {
        const countries = Object.keys(GLOBAL_GROWTH_LABELS)
        const years = []
        for (let y = 2019; y <= currentYear + 2; y++) years.push(String(y))

        const chartData = years.map(year => {
          const row = { period: year, forecast: parseInt(year) > currentYear }
          countries.forEach(c => {
            const series = globalData[c] || []
            const point = series.find(d => d.period === year)
            if (point) row[c] = point.value
          })
          return row
        })

        return (
          <ChartCard
            title="Global Economic Growth (%, annual)"
            subtitle="Source: IMF World Economic Outlook — OECD Economic Outlook"
            loading={loading}
            data={chartData}
          >
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip content={<ForecastTooltip />} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <ReferenceLine x={String(currentYear)} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Now', position: 'top', fontSize: 10, fill: '#94a3b8' }} />
              {countries.map(c => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={c}
                  name={GLOBAL_GROWTH_LABELS[c]}
                  stroke={GLOBAL_GROWTH_COLORS[c]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ChartCard>
        )
      })()}

      {/* ── Summary Table ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-slate-500" />
            IMF Forecast Summary — Ireland
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-4 font-medium text-slate-500">Indicator</th>
                  {(() => {
                    const years = []
                    for (let y = currentYear - 2; y <= currentYear + 4; y++) years.push(String(y))
                    return years.map(y => (
                      <th key={y} className={`text-right py-2 px-2 font-medium ${parseInt(y) > currentYear ? 'text-amber-600' : 'text-slate-500'}`}>
                        {y}{parseInt(y) > currentYear ? '*' : ''}
                      </th>
                    ))
                  })()}
                </tr>
              </thead>
              <tbody>
                {FORECAST_INDICATORS.map(ind => {
                  const series = data[ind.code] || []
                  return (
                    <tr key={ind.code} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-700">{ind.name} ({IMF_UNITS[ind.code]})</td>
                      {(() => {
                        const years = []
                        for (let y = currentYear - 2; y <= currentYear + 4; y++) years.push(String(y))
                        return years.map(y => {
                          const point = series.find(d => d.period === y)
                          return (
                            <td key={y} className={`text-right py-2 px-2 ${parseInt(y) > currentYear ? 'text-amber-700 bg-amber-50' : 'text-slate-900'}`}>
                              {point ? point.value : '\u2014'}
                            </td>
                          )
                        })
                      })()}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">* Forecast values. Source: IMF World Economic Outlook.</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
