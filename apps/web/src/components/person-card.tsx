'use client'

import { Badge } from '@/components/ui/badge'
import { MapPin } from 'lucide-react'

interface PersonCardProps {
  person: {
    id: string
    name: string
    role: 'arbitro' | 'anotador'
    category: string | null
    municipalityId: string
  }
  municipalityName?: string
  matchesAssigned?: number
  totalCost?: number
  onClick?: () => void
}

const categoryLabels: Record<string, string> = {
  provincial: 'Provincial',
  autonomico: 'Autonómico',
  nacional: 'Nacional',
  feb: 'FEB',
}

export function PersonCard({
  person,
  municipalityName,
  matchesAssigned = 0,
  totalCost = 0,
  onClick,
}: PersonCardProps) {
  const initials = person.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors ${
        onClick ? 'cursor-pointer hover:border-gray-300 hover:bg-gray-50' : ''
      }`}
      onClick={onClick}
    >
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          person.role === 'arbitro' ? 'bg-fbm-navy' : 'bg-purple-600'
        }`}
      >
        <span className="text-xs font-semibold text-white">{initials}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{person.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-xs ${
              person.role === 'arbitro'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-purple-200 bg-purple-50 text-purple-700'
            }`}
          >
            {person.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
          </Badge>
          {person.category && (
            <Badge variant="outline" className="text-xs">
              {categoryLabels[person.category] ?? person.category}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        {municipalityName && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3 w-3" />
            {municipalityName}
          </span>
        )}
        <span className="text-xs text-gray-400">
          {matchesAssigned} partido{matchesAssigned !== 1 ? 's' : ''} · {totalCost.toFixed(2)} €
        </span>
      </div>
    </div>
  )
}
