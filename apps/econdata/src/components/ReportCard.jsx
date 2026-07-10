import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SOURCE_COLORS } from '@/lib/constants'
import { ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export function ReportCard({ report }) {
  const { title, source, url, published_date, summary_points, description } = report
  const colors = SOURCE_COLORS[source] || { bg: 'bg-slate-100', text: 'text-slate-800' }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge className={`${colors.bg} ${colors.text} shrink-0`}>
            {source.toUpperCase().replace('_', ' ')}
          </Badge>
        </div>
        {published_date && (
          <p className="text-xs text-slate-500">
            {format(parseISO(published_date), 'd MMM yyyy')}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {description && (
          <p className="mb-4 text-sm text-slate-600">{description}</p>
        )}
        {summary_points && summary_points.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {summary_points.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                {point}
              </li>
            ))}
          </ul>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View latest
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </CardContent>
    </Card>
  )
}
