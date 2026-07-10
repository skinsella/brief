import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SOURCE_COLORS, DATA_SOURCES } from '@/lib/constants'

export default function DataSources() {
  const [statuses, setStatuses] = useState({})
  const [checking, setChecking] = useState(false)

  async function checkAll() {
    setChecking(true)
    const newStatuses = {}

    const results = await Promise.allSettled(
      DATA_SOURCES.map(async (source) => {
        if (!source.testPath) {
          return { provider: source.provider, status: 'unknown' }
        }
        const url = source.endpoint + source.testPath
        const start = performance.now()
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        })
        const ms = Math.round(performance.now() - start)
        return {
          provider: source.provider,
          status: response.ok ? 'ok' : 'degraded',
          ms,
          httpStatus: response.status,
        }
      })
    )

    results.forEach((result, i) => {
      const provider = DATA_SOURCES[i].provider
      if (result.status === 'fulfilled') {
        newStatuses[provider] = result.value
      } else {
        newStatuses[provider] = {
          provider,
          status: 'down',
          error: result.reason?.message || 'Connection failed',
        }
      }
    })

    setStatuses(newStatuses)
    setChecking(false)
  }

  useEffect(() => {
    checkAll()
  }, [])

  const counts = { ok: 0, degraded: 0, down: 0, unknown: 0 }
  Object.values(statuses).forEach((s) => {
    counts[s.status] = (counts[s.status] || 0) + 1
  })

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Data Sources</h1>
          <p className="text-slate-500 mt-1">Live status of connected economic data providers</p>
        </div>
        <button
          onClick={checkAll}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {checking ? 'Checking\u2026' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.ok}</p>
              <p className="text-sm text-slate-500">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.degraded}</p>
              <p className="text-sm text-slate-500">Degraded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.down + counts.unknown}</p>
              <p className="text-sm text-slate-500">Down / Untested</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DATA_SOURCES.map((source) => {
          const s = statuses[source.provider]
          const colors = SOURCE_COLORS[source.provider] || { bg: 'bg-slate-100', text: 'text-slate-800' }

          return (
            <Card key={source.provider}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{source.name}</h3>
                  <Badge className={`${colors.bg} ${colors.text}`}>
                    {source.provider.toUpperCase()}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {!s || checking ? (
                    <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                  ) : s.status === 'ok' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : s.status === 'degraded' ? (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  ) : s.status === 'unknown' ? (
                    <AlertCircle className="h-4 w-4 text-slate-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-slate-600">
                    {!s || checking
                      ? 'Checking\u2026'
                      : s.status === 'ok'
                        ? `OK${s.ms ? ` (${s.ms}ms)` : ''}`
                        : s.status === 'unknown'
                          ? 'Not tested'
                          : s.error || `HTTP ${s.httpStatus}`}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Update frequency: {source.frequency}
                </p>
                <p className="text-xs text-slate-400 truncate" title={source.endpoint}>
                  {source.endpoint}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </motion.div>
  )
}
