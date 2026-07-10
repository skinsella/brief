import { useState } from 'react'
import { motion } from 'framer-motion'
import { ReportCard } from '@/components/ReportCard'
import { LATEST_REPORTS } from '@/lib/constants'

const filters = ['All', 'cso', 'cbi', 'dof', 'oecd', 'esri', 'eurostat']
const filterLabels = { All: 'All', cso: 'CSO', cbi: 'CBI', dof: 'DoF', oecd: 'OECD', esri: 'ESRI', eurostat: 'Eurostat' }

export default function LatestReports() {
  const [activeFilter, setActiveFilter] = useState('All')

  const filteredReports =
    activeFilter === 'All'
      ? LATEST_REPORTS
      : LATEST_REPORTS.filter((r) => r.source === activeFilter)

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Latest Reports</h1>
        <p className="text-slate-500 mt-1">Recent economic publications and analysis</p>
      </div>

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
          {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
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
