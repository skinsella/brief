import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveContainer } from 'recharts'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

function downloadCSV(data, title) {
  if (!data || data.length === 0) return

  const keys = Object.keys(data[0])
  const header = keys.join(',')
  const rows = data.map(row =>
    keys.map(k => {
      const v = row[k]
      // Quote strings that might contain commas
      if (typeof v === 'string' && v.includes(',')) return `"${v}"`
      return v ?? ''
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ChartCard({ title, subtitle, children, loading, error, className, data }) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          {data && data.length > 0 && (
            <button
              onClick={() => downloadCSV(data, title)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded hover:bg-slate-100"
              title="Download CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-sm text-slate-400 text-center px-4">{error}</p>
          </div>
        ) : (
          <div className="h-64" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
