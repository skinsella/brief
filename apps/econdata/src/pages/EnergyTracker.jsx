import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Zap,
  Flame,
  ExternalLink,
  Info,
  Filter,
  Download,
  Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  POLICY_CATEGORIES,
  POLICY_STATUS,
  COUNTRIES,
  MEASURES,
  getMeasuresByCountry,
} from '@/lib/energyPolicyData'

const REGION_FILTERS = ['EU', 'EU-level', 'Non-EU', 'All']
const CATEGORY_FILTERS = [
  { id: 'all',          label: 'All categories' },
  { id: 'conservation', label: 'Conservation' },
  { id: 'support',      label: 'Support' },
]

function flagEmoji(iso) {
  // ISO-2 → regional indicator symbols. GB is UK alpha-2 here.
  if (!iso || iso.length !== 2) return ''
  const A = 0x1f1e6
  return String.fromCodePoint(...iso.toUpperCase().split('').map(c => A + c.charCodeAt(0) - 65))
}

function downloadCSV() {
  const header = ['Country', 'ISO', 'Region', 'Category', 'Subcategory', 'Title', 'Description', 'Announced', 'Status', 'Source URL']
  const rows = MEASURES.map(m => {
    const country = COUNTRIES.find(c => c.iso === m.country)
    const sub = POLICY_CATEGORIES[m.category]?.subcategories.find(s => s.id === m.subcategory)
    return [
      country?.name ?? m.country,
      m.country,
      country?.region ?? '',
      POLICY_CATEGORIES[m.category]?.label ?? m.category,
      sub?.label ?? m.subcategory,
      m.title,
      m.description,
      m.announced,
      m.status,
      m.source_url,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  })
  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'energy_crisis_policy_tracker.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function MeasurePill({ measure }) {
  const cat = POLICY_CATEGORIES[measure.category]
  const sub = cat?.subcategories.find(s => s.id === measure.subcategory)
  const status = POLICY_STATUS[measure.status] || POLICY_STATUS.active
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cat?.color.bg} ${cat?.color.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cat?.color.dot}`} />
            {sub?.label ?? measure.subcategory}
          </span>
          <Badge className={`${status.bg} ${status.text}`}>{status.label}</Badge>
        </div>
        {measure.announced && (
          <span className="text-xs text-slate-400 font-mono shrink-0">{measure.announced}</span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-900">{measure.title}</p>
      <p className="mt-1 text-sm text-slate-600">{measure.description}</p>
      {measure.source_url && (
        <a
          href={measure.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
        >
          {measure.source_label || 'Primary source'}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

export default function EnergyTracker() {
  const [region, setRegion] = useState('EU')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [onlyWithMeasures, setOnlyWithMeasures] = useState(false)

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return COUNTRIES
      .filter(c => {
        if (region === 'All') return true
        // 'EU' filter shows both EU member states and the EU-wide pseudo-entry.
        if (region === 'EU') return c.region === 'EU' || c.region === 'EU-level'
        return c.region === region
      })
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .map(c => {
        let measures = getMeasuresByCountry(c.iso)
        if (category !== 'all') {
          measures = measures.filter(m => m.category === category)
        }
        measures = [...measures].sort((a, b) => (b.announced || '').localeCompare(a.announced || ''))
        return { ...c, measures }
      })
      .filter(c => onlyWithMeasures ? c.measures.length > 0 : true)
  }, [region, category, search, onlyWithMeasures])

  const totals = useMemo(() => {
    const counts = { conservation: 0, support: 0, countries: 0 }
    for (const c of filteredCountries) {
      if (c.measures.length > 0) counts.countries += 1
      for (const m of c.measures) counts[m.category] += 1
    }
    return counts
  }, [filteredCountries])

  return (
    <motion.div
      className="p-8 space-y-6 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Energy Crisis Policy Response Tracker</h1>
          <p className="text-slate-500 mt-1">
            Government measures in force in 2026. EU-level + EU-27 prioritised, with UK / Norway / Switzerland comparators.
          </p>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors px-3 py-2 rounded hover:bg-slate-100 border border-slate-200"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </button>
      </div>

      {/* Methodology / disclaimer */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm text-emerald-900 space-y-1">
            <p>
              Inspired by the IEA <em>Energy Crisis Policy Response Tracker</em> (last IEA update 14 April 2026). Measures
              are grouped into two pillars: <strong>Energy Conservation</strong> and <strong>Consumer Support</strong>.
              The 2022-23 electricity and gas price caps have largely expired, but since March 2026 the Iran-war fuel-price shock
              has triggered a fresh wave of excise cuts, sectoral support schemes and — in Ireland's case — a post-protest €505m
              top-up on 13 April 2026 and a voluntary fuel-conservation campaign.
            </p>
            <p>
              Each entry links to a primary government, EU-institution or IEA source for verification. Extend
              <code className="bg-emerald-100 px-1 rounded">src/lib/energyPolicyData.js</code> to add measures. Statuses
              (<em>active / extended / expired / announced</em>) should be re-checked against the linked source before citing.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Headline counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2.5">
              <Filter className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Countries with measures</p>
              <p className="text-2xl font-bold text-slate-900">{totals.countries}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Conservation measures</p>
              <p className="text-2xl font-bold text-slate-900">{totals.conservation}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-sky-100 p-2.5">
              <Flame className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Support measures</p>
              <p className="text-2xl font-bold text-slate-900">{totals.support}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter row */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
            {REGION_FILTERS.map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  region === r ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
            {CATEGORY_FILTERS.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  category === c.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={onlyWithMeasures}
              onChange={e => setOnlyWithMeasures(e.target.checked)}
              className="rounded border-slate-300"
            />
            Only countries with measures
          </label>
          <div className="ml-auto relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>
        </CardContent>
      </Card>

      {/* Country grid */}
      <div className="space-y-4">
        {filteredCountries.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              No countries match the current filters.
            </CardContent>
          </Card>
        )}
        {filteredCountries.map(country => (
          <Card key={country.iso}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none" aria-hidden>{flagEmoji(country.iso)}</span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{country.name}</h3>
                    <p className="text-xs text-slate-500">{country.region} · {country.iso}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {country.measures.length} measure{country.measures.length !== 1 ? 's' : ''}
                </span>
              </div>

              {country.measures.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No measures recorded yet — extend the seed dataset to populate.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {country.measures.map((m, i) => (
                    <MeasurePill key={`${country.iso}-${i}`} measure={m} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center pt-4">
        Template inspired by the IEA Energy Crisis Policy Response Tracker (iea.org). Data verified against primary government sources.
      </p>
    </motion.div>
  )
}
