import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  Database,
  Calendar,
  Home as HomeIcon,
  Globe,
  ClipboardList,
  BarChart3,
  Scale,
  Landmark,
  Building,
  Eye,
  Smile,
  TableProperties,
  Zap,
  Briefcase,
  FlaskConical,
  Activity,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Heatmap', path: '/heatmap', icon: TableProperties },
  { name: 'Economic Overview', path: '/irish-economy', icon: TrendingUp },
  { name: 'Inflation', path: '/inflation', icon: Activity },
  { name: 'Outlook & Forecasts', path: '/outlook', icon: Eye },
  { name: 'Confidence', path: '/confidence', icon: Smile },
  { name: 'Benchmarks', path: '/benchmarks', icon: Scale },
  { name: 'Productivity & Skills', path: '/peer-benchmarks', icon: FlaskConical },
  { name: 'Public Finances', path: '/public-finances', icon: Landmark },
  { name: 'Employment', path: '/employment', icon: Briefcase },
  { name: 'Structural', path: '/structural', icon: Building },
  { name: 'Latest Reports', path: '/latest-reports', icon: FileText },
  { name: 'Trade Reports', path: '/trade-reports', icon: Globe },
  { name: 'Housing Reports', path: '/housing', icon: HomeIcon },
  { name: 'CSO Releases', path: '/cso-releases', icon: ClipboardList },
  { name: 'Days Until', path: '/days-until', icon: Calendar },
  { name: 'Energy Tracker', path: '/energy-tracker', icon: Zap },
  { name: 'Data Sources', path: '/data-sources', icon: Database },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-slate-700">
        <a
          href="../"
          className="block text-[11px] font-semibold tracking-[0.14em] text-emerald-400 hover:text-emerald-300 mb-3"
        >
          ← THE BRIEF
        </a>
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-sky-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Data Explorer</h1>
            <p className="text-xs text-slate-400">Irish Economic Data</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Econ Dashboard 2026
        </p>
      </div>
    </aside>
  )
}
