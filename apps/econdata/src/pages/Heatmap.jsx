import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TableProperties, Info, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  fetchHICPInflation,
  fetchCoreInflation,
  fetchConsumerConfidence,
  fetchBondYields,
  fetchBundSpread,
  fetchEURGBP,
  fetchEURUSD,
  fetchLiveRegister,
  fetchRetailTrade,
} from '@/services/indicators'

// Color scale for heatmap cells
function heatColor(value, metric) {
  if (value === null || value === undefined) return ''

  // Different color logic per metric type
  const configs = {
    sentiment: { green: [70, 100], amber: [50, 70], red: [0, 50] },
    inflation: { green: [1.5, 2.5], amber: [0, 1.5, 2.5, 4], red: [-Infinity, 0, 4, Infinity] },
    yield: { green: [0, 2.5], amber: [2.5, 3.5], red: [3.5, Infinity] },
    spread: { green: [0, 0.2], amber: [0.2, 0.4], red: [0.4, Infinity] },
    fxEURGBP: { neutral: true },
    fxEURUSD: { neutral: true },
    liveRegister: { green: [-Infinity, 160000], amber: [160000, 180000], red: [180000, Infinity] },
    retailTrade: { green: [105, Infinity], amber: [95, 105], red: [-Infinity, 95] },
  }

  const cfg = configs[metric]
  if (!cfg || cfg.neutral) return 'bg-slate-50'

  if (cfg.green) {
    if (Array.isArray(cfg.green) && cfg.green.length === 2) {
      if (value >= cfg.green[0] && value <= cfg.green[1]) return 'bg-green-100 text-green-900'
    }
  }
  if (cfg.amber) {
    if (Array.isArray(cfg.amber) && cfg.amber.length === 2) {
      if (value >= cfg.amber[0] && value < cfg.amber[1]) return 'bg-amber-100 text-amber-900'
    }
    if (Array.isArray(cfg.amber) && cfg.amber.length === 4) {
      if ((value >= cfg.amber[0] && value < cfg.amber[1]) || (value > cfg.amber[2] && value <= cfg.amber[3]))
        return 'bg-amber-100 text-amber-900'
    }
  }
  if (cfg.red) {
    if (Array.isArray(cfg.red) && cfg.red.length === 2) {
      if (value >= cfg.red[0] && value < cfg.red[1]) return 'bg-red-100 text-red-900'
    }
    if (Array.isArray(cfg.red) && cfg.red.length === 4) {
      if ((value >= cfg.red[0] && value < cfg.red[1]) || (value > cfg.red[2] && value <= cfg.red[3]))
        return 'bg-red-100 text-red-900'
    }
  }

  return 'bg-green-100 text-green-900'
}

function downloadCSV(rows, months) {
  const header = ['Indicator', ...months].join(',')
  const body = rows.map(r =>
    [r.label, ...months.map(m => r.data[m] ?? '')].join(',')
  )
  const csv = [header, ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'irish_economic_heatmap.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Heatmap() {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const fetchers = {
        hicp: fetchHICPInflation,
        coreInflation: fetchCoreInflation,
        sentiment: fetchConsumerConfidence,
        bondYield: fetchBondYields,
        bundSpread: fetchBundSpread,
        eurGbp: fetchEURGBP,
        eurUsd: fetchEURUSD,
        liveRegister: fetchLiveRegister,
        retailTrade: fetchRetailTrade,
      }

      const results = await Promise.allSettled(
        Object.entries(fetchers).map(async ([key, fn]) => {
          const d = await fn()
          return [key, d]
        })
      )

      if (cancelled) return

      const out = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const [key, val] = r.value
          out[key] = val
        }
      }

      setData(out)
      setLoading(false)
    }

    load().catch(e => {
      if (!cancelled) {
        setError(e.message)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [])

  // Build monthly periods from data — get all unique months, take last 15
  function getMonths() {
    const allMonths = new Set()
    for (const series of Object.values(data)) {
      if (Array.isArray(series)) {
        for (const d of series) {
          if (d.period) allMonths.add(d.period)
        }
      }
    }
    return [...allMonths]
      .sort((a, b) => a < b ? -1 : 1)
      .slice(-15)
  }

  function buildRow(label, key, metric, formatter) {
    const series = data[key] || []
    const map = {}
    for (const d of series) {
      map[d.period] = d.value
    }
    return {
      label,
      key,
      metric,
      data: map,
      formatter: formatter || (v => v),
    }
  }

  const months = getMonths()

  const rows = [
    buildRow('Consumer Sentiment Index', 'sentiment', 'sentiment'),
    buildRow('Annual Inflation Rate (HICP)', 'hicp', 'inflation', v => `${v}%`),
    buildRow('Annual Core Inflation', 'coreInflation', 'inflation', v => `${v}%`),
    buildRow('EUR/GBP', 'eurGbp', 'fxEURGBP'),
    buildRow('EUR/USD', 'eurUsd', 'fxEURUSD'),
    buildRow('Ireland 10yr Yield', 'bondYield', 'yield'),
    buildRow('10yr Spread to Bund', 'bundSpread', 'spread'),
    buildRow('Live Register', 'liveRegister', 'liveRegister', v => v?.toLocaleString()),
    buildRow('Retail Trade (vol. index)', 'retailTrade', 'retailTrade'),
  ]

  return (
    <motion.div
      className="p-8 space-y-6 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Irish Economic Heatmap</h1>
          <p className="text-slate-500 mt-1">Monthly indicator summary with color-coded performance</p>
        </div>
        {months.length > 0 && (
          <button
            onClick={() => downloadCSV(rows, months)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors px-3 py-2 rounded hover:bg-slate-100 border border-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
        )}
      </div>

      {/* Info box */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-800">
            Inspired by the Department of the Taoiseach&apos;s Monthly Economic Bulletin heatmap.
            Green indicates favourable values, amber signals caution, red flags concern.
            Note: PMI data (Manufacturing, Services, Construction) is proprietary (S&amp;P Global)
            and not available via free APIs.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-800">Error loading data: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Heatmap table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600" />
                <p className="text-sm text-slate-500">Loading heatmap data...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-800 text-white">
                    <th className="text-left py-3 px-4 font-medium sticky left-0 bg-slate-800 z-10 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <TableProperties className="h-4 w-4" />
                        Indicator
                      </div>
                    </th>
                    {months.map(m => (
                      <th key={m} className="text-right py-3 px-3 font-medium text-xs whitespace-nowrap">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-700 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {months.map(m => {
                        const val = row.data[m]
                        const display = val !== undefined && val !== null
                          ? (row.formatter ? row.formatter(val) : val)
                          : '\u2014'
                        return (
                          <td
                            key={m}
                            className={`text-right py-2.5 px-3 text-xs font-mono ${heatColor(val, row.metric)}`}
                          >
                            {display}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-green-100 border border-green-200" />
          Favourable
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-amber-100 border border-amber-200" />
          Caution
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-red-100 border border-red-200" />
          Concern
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-slate-50 border border-slate-200" />
          Neutral
        </div>
      </div>
    </motion.div>
  )
}
