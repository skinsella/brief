import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { Smile, TrendingUp, ShoppingCart, Factory, Wrench, Building2, Info } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { ChartCard } from '@/components/ChartCard'
import { Card, CardContent } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  fetchConsumerConfidence,
  fetchEconomicSentiment,
  fetchIndustrialConfidence,
  fetchServicesConfidence,
  fetchConstructionConfidence,
  fetchRetailTrade,
  fetchIndustrialProduction,
  fetchConsumerConfidenceComparison,
  fetchSentimentComparison,
} from '@/services/indicators'

const tabs = ['Sentiment', 'Activity', 'Peer Comparison']

function pivotComparison(data) {
  const map = new Map()
  data.forEach(d => {
    const existing = map.get(d.period) || { period: d.period }
    existing[d.geoLabel] = d.value
    map.set(d.period, existing)
  })
  return Array.from(map.values()).sort((a, b) => (a.period < b.period ? -1 : 1))
}

const PEER_COLORS = {
  Ireland: '#0ea5e9',
  'Euro Area': '#6366f1',
  'EU 27': '#8b5cf6',
  Germany: '#f59e0b',
  Netherlands: '#f97316',
  France: '#10b981',
}

export default function Confidence() {
  const [activeTab, setActiveTab] = useState('Sentiment')
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const fetchers = {
        consumerConf: fetchConsumerConfidence,
        esi: fetchEconomicSentiment,
        industrialConf: fetchIndustrialConfidence,
        servicesConf: fetchServicesConfidence,
        constructionConf: fetchConstructionConfidence,
        retailTrade: fetchRetailTrade,
        industrialProd: fetchIndustrialProduction,
        consumerConfComp: fetchConsumerConfidenceComparison,
        esiComp: fetchSentimentComparison,
      }

      const keys = Object.keys(fetchers)
      const results = await Promise.allSettled(keys.map(k => fetchers[k]()))

      if (cancelled) return

      const newData = {}
      const newErrors = {}

      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          newData[keys[i]] = result.value
        } else {
          newErrors[keys[i]] = result.status === 'rejected'
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

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Confidence & Leading Indicators</h1>
        <p className="text-slate-500 mt-1">Business & consumer sentiment, industrial production, and retail activity</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
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

      {activeTab === 'Sentiment' && (
        <SentimentTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      )}
      {activeTab === 'Activity' && (
        <ActivityTab data={data} errors={errors} loading={loading} latest={latest} slice={slice} />
      )}
      {activeTab === 'Peer Comparison' && (
        <ComparisonTab data={data} errors={errors} loading={loading} />
      )}
    </motion.div>
  )
}

function SentimentTab({ errors, loading, latest, slice, data }) {
  const consumer = latest('consumerConf')
  const esi = latest('esi')
  const industrial = latest('industrialConf')
  const services = latest('servicesConf')
  const construction = latest('constructionConf')

  // Merge confidence series
  const confidenceMerged = (() => {
    const series = {
      Consumer: data.consumerConf || [],
      Industrial: data.industrialConf || [],
      Services: data.servicesConf || [],
      Construction: data.constructionConf || [],
    }
    const map = new Map()
    Object.entries(series).forEach(([name, arr]) => {
      arr.forEach(d => {
        const existing = map.get(d.period) || { period: d.period }
        existing[name] = d.value
        map.set(d.period, existing)
      })
    })
    return Array.from(map.values())
      .sort((a, b) => (a.period < b.period ? -1 : 1))
      .slice(-36)
  })()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Consumer Confidence"
          value={consumer ? `${consumer.value}` : '\u2014'}
          subtitle={consumer ? `${consumer.period} \u00b7 Eurostat` : errors.consumerConf ? 'Unavailable' : 'Loading\u2026'}
          icon={Smile}
          color="sky"
          loading={loading}
        />
        <KpiCard
          title="Economic Sentiment"
          value={esi ? `${esi.value}` : '\u2014'}
          subtitle={esi ? `${esi.period} \u00b7 Eurostat (100=avg)` : errors.esi ? 'Unavailable' : 'Loading\u2026'}
          icon={TrendingUp}
          color="indigo"
          loading={loading}
        />
        <KpiCard
          title="Industrial Confidence"
          value={industrial ? `${industrial.value}` : '\u2014'}
          subtitle={industrial ? `${industrial.period}` : errors.industrialConf ? 'Unavailable' : 'Loading\u2026'}
          icon={Factory}
          color="amber"
          loading={loading}
        />
        <KpiCard
          title="Services Confidence"
          value={services ? `${services.value}` : '\u2014'}
          subtitle={services ? `${services.period}` : errors.servicesConf ? 'Unavailable' : 'Loading\u2026'}
          icon={Wrench}
          color="emerald"
          loading={loading}
        />
        <KpiCard
          title="Construction Confidence"
          value={construction ? `${construction.value}` : '\u2014'}
          subtitle={construction ? `${construction.period}` : errors.constructionConf ? 'Unavailable' : 'Loading\u2026'}
          icon={Building2}
          color="orange"
          loading={loading}
        />
      </div>

      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">
            Confidence indicators are <strong>leading indicators</strong> — they tend to move before actual
            economic activity changes. Values above zero signal optimism; below zero signals pessimism.
            The Economic Sentiment Indicator (ESI) is a composite where 100 represents the long-term average.
            Source: European Commission Business and Consumer Surveys via Eurostat.
          </p>
        </CardContent>
      </Card>

      <ChartCard
        title="Economic Sentiment Indicator (monthly, SA)"
        subtitle="Source: Eurostat ei_bssi_m_r2 · 100 = long-term average"
        loading={loading}
        error={errors.esi}
      >
        <LineChart data={slice('esi', 60)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'Long-term avg', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
          <Line type="monotone" dataKey="value" name="ESI" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ChartCard>

      <ChartCard
        title="Sectoral Confidence Indicators (monthly, SA, balance)"
        subtitle="Source: Eurostat ei_bssi_m_r2"
        loading={loading}
        error={errors.consumerConf && errors.industrialConf ? 'No data available' : undefined}
      >
        <LineChart data={confidenceMerged}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="Consumer" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 1 }} />
          <Line type="monotone" dataKey="Industrial" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 1 }} />
          <Line type="monotone" dataKey="Services" stroke={CHART_COLORS[4]} strokeWidth={2} dot={{ r: 1 }} />
          <Line type="monotone" dataKey="Construction" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 1 }} />
        </LineChart>
      </ChartCard>
    </div>
  )
}

function ActivityTab({ errors, loading, latest, slice }) {
  const retail = latest('retailTrade')
  const indProd = latest('industrialProd')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="Retail Trade Volume"
          value={retail ? `${retail.value}` : '\u2014'}
          subtitle={retail ? `${retail.period} \u00b7 Eurostat (2015=100, SA)` : errors.retailTrade ? 'Unavailable' : 'Loading\u2026'}
          icon={ShoppingCart}
          color="emerald"
          loading={loading}
        />
        <KpiCard
          title="Industrial Production"
          value={indProd ? `${indProd.value}` : '\u2014'}
          subtitle={indProd ? `${indProd.period} \u00b7 Eurostat (2015=100, SA)` : errors.industrialProd ? 'Unavailable' : 'Loading\u2026'}
          icon={Factory}
          color="indigo"
          loading={loading}
        />
      </div>

      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">
            Ireland&apos;s industrial production index is heavily influenced by multinational pharmaceutical
            and tech manufacturing. Retail trade volume provides a better gauge of domestic consumer demand.
            Both indices are seasonally and calendar adjusted (2015=100).
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Retail Trade Volume (monthly, 2015=100, SCA)"
          subtitle="Source: Eurostat sts_trtu_m (G47 - Retail)"
          loading={loading}
          error={errors.retailTrade}
        >
          <LineChart data={slice('retailTrade', 48)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" domain={['auto', 'auto']} />
            <Tooltip />
            <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="value" name="Retail Trade" stroke={CHART_COLORS[4]} strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Industrial Production Index (monthly, 2015=100, SCA)"
          subtitle="Source: Eurostat sts_inpr_m (B-D)"
          loading={loading}
          error={errors.industrialProd}
        >
          <LineChart data={slice('industrialProd', 48)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" domain={['auto', 'auto']} />
            <Tooltip />
            <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="value" name="Industrial Production" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ChartCard>
      </div>
    </div>
  )
}

function ComparisonTab({ data, errors, loading }) {
  const confComp = data.consumerConfComp ? pivotComparison(data.consumerConfComp) : []
  const esiComp = data.esiComp ? pivotComparison(data.esiComp) : []
  const countries = Object.keys(PEER_COLORS)

  return (
    <div className="space-y-6">
      <ChartCard
        title="Consumer Confidence — Ireland vs Peers (monthly, SA)"
        subtitle="Source: Eurostat ei_bsco_m"
        loading={loading}
        error={errors.consumerConfComp}
      >
        <LineChart data={confComp.slice(-24)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
          {countries.map(c => (
            <Line key={c} type="monotone" dataKey={c} name={c} stroke={PEER_COLORS[c]} strokeWidth={c === 'Ireland' ? 3 : 1.5} dot={{ r: c === 'Ireland' ? 3 : 1 }} />
          ))}
        </LineChart>
      </ChartCard>

      <ChartCard
        title="Economic Sentiment — Ireland vs Peers (monthly, SA)"
        subtitle="Source: Eurostat ei_bssi_m_r2 · 100 = long-term average"
        loading={loading}
        error={errors.esiComp}
      >
        <LineChart data={esiComp.slice(-24)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" />
          {countries.map(c => (
            <Line key={c} type="monotone" dataKey={c} name={c} stroke={PEER_COLORS[c]} strokeWidth={c === 'Ireland' ? 3 : 1.5} dot={{ r: c === 'Ireland' ? 3 : 1 }} />
          ))}
        </LineChart>
      </ChartCard>
    </div>
  )
}
