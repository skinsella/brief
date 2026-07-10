import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Users, Zap, Globe, TrendingUp, Info, Heart } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  fetchDependencyRatio,
  fetchAged65Plus,
  fetchPovertyRate,
  fetchLabourCostIndex,
  fetchElectricityPrices,
  fetchFDIInward,
} from '@/services/indicators'

export default function Structural() {
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const fetchers = {
        dependencyRatio: fetchDependencyRatio,
        aged65: fetchAged65Plus,
        poverty: fetchPovertyRate,
        labourCost: fetchLabourCostIndex,
        electricity: fetchElectricityPrices,
        fdi: fetchFDIInward,
      }

      const keys = Object.keys(fetchers)
      const results = await Promise.allSettled(keys.map((k) => fetchers[k]()))

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

  function slice(key, n) {
    const s = data[key]
    if (!s) return []
    return n ? s.slice(-n) : s
  }

  const aged = latest('aged65')
  const poverty = latest('poverty')
  const elec = latest('electricity')
  const fdi = latest('fdi')

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Structural Indicators</h1>
        <p className="text-slate-500 mt-1">Demographics, social outcomes, competitiveness, and FDI</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Aged 65+"
          value={aged ? `${aged.value}%` : '\u2014'}
          subtitle={aged ? `${aged.period} \u00b7 Eurostat` : errors.aged65 ? 'Unavailable' : 'Loading\u2026'}
          icon={Users}
          color="violet"
          loading={loading}
        />
        <KpiCard
          title="At-Risk-of-Poverty"
          value={poverty ? `${poverty.value}%` : '\u2014'}
          subtitle={poverty ? `${poverty.period} \u00b7 Eurostat` : errors.poverty ? 'Unavailable' : 'Loading\u2026'}
          icon={Heart}
          color="rose"
          loading={loading}
        />
        <KpiCard
          title="Electricity Price"
          value={elec ? `\u20ac${elec.value} /kWh` : '\u2014'}
          subtitle={elec ? `${elec.period} \u00b7 Eurostat` : errors.electricity ? 'Unavailable' : 'Loading\u2026'}
          icon={Zap}
          color="amber"
          loading={loading}
        />
        <KpiCard
          title="FDI Inward"
          value={fdi ? `\u20ac${(fdi.value / 1000).toFixed(1)}bn` : '\u2014'}
          subtitle={fdi ? `${fdi.period} \u00b7 Eurostat` : errors.fdi ? 'Unavailable' : 'Loading\u2026'}
          icon={Globe}
          color="emerald"
          loading={loading}
        />
      </div>

      {/* Charts grid — 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Dependency Ratio (%, annual)"
          subtitle="Source: Eurostat"
          loading={loading}
          error={errors.dependencyRatio}
        >
          <LineChart data={slice('dependencyRatio')}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="Dependency Ratio" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="At-Risk-of-Poverty Rate (%, annual)"
          subtitle="Source: Eurostat"
          loading={loading}
          error={errors.poverty}
        >
          <LineChart data={slice('poverty')}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="Poverty Rate" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Labour Cost Index (YoY %, quarterly)"
          subtitle="Source: Eurostat"
          loading={loading}
          error={errors.labourCost}
        >
          <LineChart data={slice('labourCost')}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="LCI YoY" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Electricity Prices (EUR/kWh, half-yearly)"
          subtitle="Source: Eurostat"
          loading={loading}
          error={errors.electricity}
        >
          <LineChart data={slice('electricity')}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="EUR/kWh" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>
      </div>

      {/* FDI full-width bar chart */}
      <ChartCard
        title="FDI Inward Position (\u20ac millions, annual)"
        subtitle="Source: Eurostat"
        loading={loading}
        error={errors.fdi}
      >
        <BarChart data={slice('fdi')}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip formatter={(v) => `\u20ac${Number(v).toLocaleString()}m`} />
          <Bar dataKey="value" name="FDI Inward" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Info box */}
      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">
            The dependency ratio (population aged 0-14 and 65+ relative to 15-64) is a key
            long-term fiscal risk indicator. Ireland&apos;s ratio is currently below the EU average
            but is projected to rise sharply as the population ages, putting pressure on pensions,
            healthcare, and public finances over the coming decades.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
