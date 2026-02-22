import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { label: string; variant: string }> = {
  scheduled: { label: 'Programado', variant: 'bg-gray-100 text-gray-700 border-gray-200' },
  designated: { label: 'Designado', variant: 'bg-blue-100 text-blue-700 border-blue-200' },
  played: { label: 'Jugado', variant: 'bg-green-100 text-green-700 border-green-200' },
  suspended: { label: 'Suspendido', variant: 'bg-red-100 text-red-700 border-red-200' },
}

export function MatchStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.scheduled
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.variant}`}>
      {config.label}
    </Badge>
  )
}
