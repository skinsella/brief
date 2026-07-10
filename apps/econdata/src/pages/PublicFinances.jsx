import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Landmark, PieChart, Info } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  fetchTaxRevenue,
  TAX_LABELS,
  fetchGovSpending,
  COFOG_LABELS,
} from '@/services/indicators'

function pivotByPeriod(rows, categoryKey, labels) {
  const map = new Map()
  rows.forEach((d) => {
    const existing = map.get(d.period) || { period: d.period }
    const label = labels[d[categoryKey]] || d[categoryKey]
    existing[label] = d.value
    map.set(d.period, existing)
  })
  return Array.from(map.values()).sort((a, b) => (a.period < b.period ? -1 : 1))
}

export default function PublicFinances() {
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const results = await Promise.allSettled([
        fetchTaxRevenue(),
        fetchGovSpending(),
      ])

      if (cancelled) return

      const newData = {}
      const newErrors = {}

      // Tax revenue
      if (results[0].status === 'fulfilled' && results[0].value.length > 0) {
        newData.taxRevenue = pivotByPeriod(results[0].value, 'category', TAX_LABELS)
        newData.taxRaw = results[0].value
      } else {
        newErrors.taxRevenue = results[0].status === 'rejected'
          ? results[0].reason?.message || 'Unknown error'
          : 'No data available'
      }

      // Government spending
      if (results[1].status === 'fulfilled' && results[1].value.length > 0) {
        newData.govSpending = pivotByPeriod(results[1].value, 'cofog', COFOG_LABELS)
        newData.spendingRaw = results[1].value
      } else {
        newErrors.govSpending = results[1].status === 'rejected'
          ? results[1].reason?.message || 'Unknown error'
          : 'No data available'
      }

      setData(newData)
      setErrors(newErrors)
      setLoading(false)
    }

    loadAll()
    return () => { cancelled = true }
  }, [])

  // Latest value for a given category from raw data
  function latestByCategory(rawKey, category, labels) {
    const raw = data[rawKey]
    if (!raw) return null
    const filtered = raw.filter((d) => d[rawKey === 'taxRaw' ? 'category' : 'cofog'] === category)
    if (filtered.length === 0) return null
    const last = filtered[filtered.length - 1]
    return { value: last.value, period: last.period, label: labels[category] || category }
  }

  const taxLatest = latestByCategory('taxRaw', 'D5', TAX_LABELS)
  const totalTaxLatest = latestByCategory('taxRaw', 'D2_D5_D91', TAX_LABELS)
  const totalSpendLatest = latestByCategory('spendingRaw', 'TOTAL', COFOG_LABELS)
  const socialLatest = latestByCategory('spendingRaw', 'GF10', COFOG_LABELS)

  const taxCategories = Object.values(TAX_LABELS)
  const spendingCategories = Object.values(COFOG_LABELS)

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Public Finances</h1>
        <p className="text-slate-500 mt-1">Government revenue and expenditure as % of GNI — Eurostat + World Bank</p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Tax Revenue"
          value={totalTaxLatest ? `${totalTaxLatest.value}% GNI` : '\u2014'}
          subtitle={totalTaxLatest ? `${totalTaxLatest.period} \u00b7 Eurostat` : errors.taxRevenue ? 'Unavailable' : 'Loading\u2026'}
          icon={Landmark}
          color="green"
          loading={loading}
        />
        <KpiCard
          title="Income & Wealth Taxes"
          value={taxLatest ? `${taxLatest.value}% GNI` : '\u2014'}
          subtitle={taxLatest ? `${taxLatest.period} \u00b7 incl. corporation tax` : errors.taxRevenue ? 'Unavailable' : 'Loading\u2026'}
          icon={Landmark}
          color="sky"
          loading={loading}
        />
        <KpiCard
          title="Total Expenditure"
          value={totalSpendLatest ? `${totalSpendLatest.value}% GNI` : '\u2014'}
          subtitle={totalSpendLatest ? `${totalSpendLatest.period} \u00b7 Eurostat` : errors.govSpending ? 'Unavailable' : 'Loading\u2026'}
          icon={PieChart}
          color="amber"
          loading={loading}
        />
        <KpiCard
          title="Social Protection"
          value={socialLatest ? `${socialLatest.value}% GNI` : '\u2014'}
          subtitle={socialLatest ? `${socialLatest.period} \u00b7 largest COFOG category` : errors.govSpending ? 'Unavailable' : 'Loading\u2026'}
          icon={PieChart}
          color="rose"
          loading={loading}
        />
      </div>

      {/* ── Info Box ───────────────────────────────────────────────────── */}
      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">
            These ratios use GNI (World Bank) as the denominator instead of GDP.
            Ireland&apos;s headline GDP is significantly inflated by multinational IP transfers
            and aircraft leasing, making GDP-based ratios misleadingly low.
            GNI strips out net factor income flows and gives a truer picture of fiscal effort.
            The CSO&apos;s GNI* (Modified GNI) adjusts further for depreciation on foreign-owned
            IP and aircraft — see the{' '}
            <a
              href="https://www.cso.ie/en/statistics/nationalaccounts/quarterlynationalaccounts/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              CSO National Accounts
            </a>.
          </p>
        </CardContent>
      </Card>

      {/* ── Tax Revenue Chart ──────────────────────────────────────────── */}
      <ChartCard
        title="Tax Revenue by Category (% of GNI, annual)"
        subtitle="Source: Eurostat gov_10a_taxag + World Bank GNI"
        loading={loading}
        error={errors.taxRevenue}
      >
        <LineChart data={data.taxRevenue || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          {taxCategories.map((label, i) => (
            <Line
              key={label}
              type="monotone"
              dataKey={label}
              name={label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={label === TAX_LABELS.D2_D5_D91 ? 3 : 2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ChartCard>

      {/* ── Government Spending Chart ──────────────────────────────────── */}
      <ChartCard
        title="Government Spending by Function (% of GNI, annual)"
        subtitle="Source: Eurostat gov_10a_exp (COFOG) + World Bank GNI"
        loading={loading}
        error={errors.govSpending}
      >
        <LineChart data={data.govSpending || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          {spendingCategories.map((label, i) => (
            <Line
              key={label}
              type="monotone"
              dataKey={label}
              name={label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={label === COFOG_LABELS.TOTAL ? 3 : 2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ChartCard>
    </motion.div>
  )
}
