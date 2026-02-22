import { Badge } from '@/components/ui/badge'

export function CostBadge({ cost, km }: { cost: string | number; km: string | number }) {
  const costNum = typeof cost === 'string' ? parseFloat(cost) : cost
  const kmNum = typeof km === 'string' ? parseFloat(km) : km

  return (
    <Badge variant="outline" className="gap-1 font-mono text-xs">
      {costNum.toFixed(2)} €
      {kmNum > 0 && <span className="text-muted-foreground">({kmNum.toFixed(0)} km)</span>}
    </Badge>
  )
}
