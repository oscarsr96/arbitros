import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color: string // tailwind bg + text + border classes
  icon?: LucideIcon
}

export function StatCard({ label, value, sub, color, icon: Icon }: StatCardProps) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-5 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        {Icon && <Icon className="h-4 w-4 opacity-50" />}
      </div>
      <span className="text-3xl font-bold">{value}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  )
}
