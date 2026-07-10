import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, AlertCircle, Loader2, Filter } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO, isBefore, isToday, startOfDay, addMonths } from 'date-fns'

const CSO_CALENDAR_JSON = 'https://cdn.cso.ie/static/data/ReleaseCalendar.json'
const CSO_CALENDAR_PAGE = 'https://www.cso.ie/en/csolatestnews/releasecalendar/'

// Map CSO themes to short display categories and colours
const THEME_MAP = {
  'Economy/Prices': { label: 'Prices', color: 'bg-rose-100 text-rose-700' },
  'Economy/External Trade': { label: 'Trade', color: 'bg-blue-100 text-blue-700' },
  'Economy/Government Accounts': { label: 'Economy', color: 'bg-sky-100 text-sky-700' },
  'Labour Market and Earnings': { label: 'Labour Market', color: 'bg-amber-100 text-amber-700' },
  'Business/Agriculture and Fishing': { label: 'Agriculture', color: 'bg-emerald-100 text-emerald-700' },
  'Business/Transport': { label: 'Transport', color: 'bg-cyan-100 text-cyan-700' },
  'Business/Tourism and Travel': { label: 'Tourism', color: 'bg-teal-100 text-teal-700' },
  'Business/Multisectoral': { label: 'Business', color: 'bg-indigo-100 text-indigo-700' },
  'People and Society/Housing': { label: 'Housing', color: 'bg-orange-100 text-orange-700' },
  'People and Society/Social Conditions': { label: 'Social', color: 'bg-violet-100 text-violet-700' },
  'People and Society/Births, Deaths and Marriages': { label: 'Vital Stats', color: 'bg-pink-100 text-pink-700' },
  'People and Society/Crime and Justice': { label: 'Crime', color: 'bg-red-100 text-red-700' },
}

function categorise(theme) {
  if (!theme) return { label: 'Other', color: 'bg-slate-100 text-slate-700' }
  // Exact match first
  if (THEME_MAP[theme]) return THEME_MAP[theme]
  // Partial match on first segment
  for (const [key, val] of Object.entries(THEME_MAP)) {
    if (theme.startsWith(key.split('/')[0])) return val
  }
  return { label: 'Other', color: 'bg-slate-100 text-slate-700' }
}

// Parse the CSO JSON format into our release objects
// Actual CSO fields: releasedate (DD/MM/YYYY), orderdate (ISO), title, sector, subsector, refperiod, status
function parseCSOReleases(json) {
  // JSON is { releases: [...] } not a plain array
  const items = Array.isArray(json) ? json : json?.releases || []
  if (!items.length) return []

  return items
    .map((item) => {
      const title = item.title || ''
      // orderdate is ISO format "2026-03-18T00:00:00" — most reliable
      // releasedate is DD/MM/YYYY format
      let dateStr = ''
      if (item.orderdate) {
        dateStr = item.orderdate.substring(0, 10)
      } else if (item.releasedate) {
        // Convert DD/MM/YYYY to YYYY-MM-DD
        const parts = item.releasedate.split('/')
        if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`
      }
      if (!dateStr || !title) return null

      const theme = item.sector && item.subsector
        ? `${item.sector}/${item.subsector}`
        : item.sector || ''
      const refperiod = item.refperiod || ''

      return { date: dateStr, title, theme, refperiod }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
}

const RANGE_OPTIONS = [
  { key: '2w', label: '2 Weeks' },
  { key: '1m', label: '1 Month' },
  { key: '3m', label: '3 Months' },
  { key: 'all', label: 'All Upcoming' },
]

export default function CSOReleases() {
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('3m')
  const [catFilter, setCatFilter] = useState('All')

  useEffect(() => {
    let cancelled = false

    async function fetchCalendar() {
      try {
        const res = await fetch(CSO_CALENDAR_JSON, { signal: AbortSignal.timeout(10000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (cancelled) return
        const parsed = parseCSOReleases(json)
        if (parsed.length > 0) {
          setReleases(parsed)
        } else {
          setError('Could not parse release calendar data.')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch release calendar')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCalendar()
    return () => { cancelled = true }
  }, [])

  // Filter to upcoming only (today or later)
  const today = startOfDay(new Date())

  const upcomingReleases = useMemo(() => {
    return releases.filter((r) => {
      const d = parseISO(r.date)
      return !isBefore(d, today) || isToday(d)
    })
  }, [releases])

  // Apply range filter
  const rangeFiltered = useMemo(() => {
    if (range === 'all') return upcomingReleases
    const months = range === '2w' ? 0.5 : range === '1m' ? 1 : 3
    const cutoff = range === '2w'
      ? new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      : addMonths(today, months)
    return upcomingReleases.filter((r) => isBefore(parseISO(r.date), cutoff))
  }, [upcomingReleases, range])

  // Get unique categories for filter buttons
  const categories = useMemo(() => {
    const cats = new Set(rangeFiltered.map((r) => categorise(r.theme).label))
    return ['All', ...Array.from(cats).sort()]
  }, [rangeFiltered])

  // Apply category filter
  const displayed = useMemo(() => {
    if (catFilter === 'All') return rangeFiltered
    return rangeFiltered.filter((r) => categorise(r.theme).label === catFilter)
  }, [rangeFiltered, catFilter])

  // Group by month for display
  const grouped = useMemo(() => {
    const groups = {}
    for (const r of displayed) {
      const monthKey = r.date.substring(0, 7) // YYYY-MM
      if (!groups[monthKey]) groups[monthKey] = []
      groups[monthKey].push(r)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [displayed])

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">CSO Release Calendar</h1>
          <p className="text-slate-500 mt-1">Upcoming statistical releases from the Central Statistics Office</p>
        </div>
        <a
          href={CSO_CALENDAR_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 shrink-0"
        >
          View on CSO.ie
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Could not fetch live release calendar from CSO ({error}). Visit{' '}
              <a href={CSO_CALENDAR_PAGE} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                CSO Release Calendar
              </a>{' '}
              for the latest schedule.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">Loading release calendar…</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Range selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setRange(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    range === opt.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* Category filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-slate-400" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    catFilter === cat
                      ? 'bg-slate-700 text-white'
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <span className="ml-auto text-sm text-slate-500">
              {displayed.length} release{displayed.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grouped by month */}
          {grouped.length === 0 && (
            <p className="text-slate-500 text-center py-12">No upcoming releases match your filters.</p>
          )}

          {grouped.map(([monthKey, items]) => {
            const monthDate = parseISO(`${monthKey}-01`)
            return (
              <div key={monthKey}>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">
                  {format(monthDate, 'MMMM yyyy')}
                </h2>
                <div className="space-y-2">
                  {items.map((r, i) => (
                    <ReleaseRow key={`${r.date}-${i}`} release={r} />
                  ))}
                </div>
              </div>
            )
          })}

          <p className="text-xs text-slate-400 text-center">
            Data sourced live from{' '}
            <a href={CSO_CALENDAR_JSON} target="_blank" rel="noopener noreferrer" className="underline">
              CSO Release Calendar JSON
            </a>
            . Dates are subject to change by the CSO.
          </p>
        </>
      )}
    </motion.div>
  )
}

function ReleaseRow({ release }) {
  const { date, title, theme, refperiod } = release
  const d = parseISO(date)
  const todayRelease = isToday(d)
  const { label, color } = categorise(theme)

  return (
    <Card className={todayRelease ? 'border-sky-300 bg-sky-50/50' : ''}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="text-center shrink-0 w-14 text-slate-900">
          <p className="text-xs font-medium uppercase">{format(d, 'EEE')}</p>
          <p className="text-2xl font-bold leading-tight">{format(d, 'd')}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {refperiod && (
            <p className="text-xs text-slate-500 mt-0.5">{refperiod}</p>
          )}
          {todayRelease && (
            <p className="text-xs text-sky-600 font-medium mt-0.5">Releasing today</p>
          )}
        </div>
        <Badge className={`${color} shrink-0 text-xs`}>{label}</Badge>
      </CardContent>
    </Card>
  )
}
