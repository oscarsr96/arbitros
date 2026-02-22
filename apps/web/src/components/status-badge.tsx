import { Badge } from '@/components/ui/badge'

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  pending: {
    label: 'Pendiente',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
  notified: {
    label: 'Notificada',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  confirmed: {
    label: 'Confirmada',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  rejected: {
    label: 'Rechazada',
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
  },
  completed: {
    label: 'Completada',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    label: status,
    variant: 'outline' as const,
    className: '',
  }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
