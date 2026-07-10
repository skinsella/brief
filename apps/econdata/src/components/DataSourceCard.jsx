import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SOURCE_COLORS } from '@/lib/constants'
import { CheckCircle, AlertCircle, Clock, Database } from 'lucide-react'

const STATUS_CONFIG = {
  ok: { icon: CheckCircle, label: 'Operational', dotColor: 'bg-emerald-500', textColor: 'text-emerald-700' },
  degraded: { icon: AlertCircle, label: 'Degraded', dotColor: 'bg-amber-500', textColor: 'text-amber-700' },
  down: { icon: AlertCircle, label: 'Down', dotColor: 'bg-red-500', textColor: 'text-red-700' },
}

export function DataSourceCard({ source }) {
  const { name, provider, status = 'ok', endpoint, frequency, last_updated } = source
  const colors = SOURCE_COLORS[provider] || { bg: 'bg-slate-100', text: 'text-slate-800' }
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.ok

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-slate-400" />
            <h4 className="font-semibold text-slate-900">{name}</h4>
          </div>
          <Badge className={`${colors.bg} ${colors.text}`}>
            {provider.toUpperCase()}
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusInfo.dotColor}`} />
          <span className={`text-sm font-medium ${statusInfo.textColor}`}>{statusInfo.label}</span>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Updated {frequency}</span>
          </div>
          {last_updated && (
            <p className="text-xs text-slate-400">Last fetched: {last_updated}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
