'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Plus, MapPin } from 'lucide-react'
import type { EnrichedDesignation } from '@/lib/types'

interface AssignmentSlotProps {
  role: 'arbitro' | 'anotador'
  index: number
  designation?: EnrichedDesignation
  isActive?: boolean
  onActivate?: () => void
  onRemove?: (designationId: string) => void
}

const statusColors: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-50',
  notified: 'border-blue-200 bg-blue-50',
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  notified: 'Notificado',
}

export function AssignmentSlot({
  role,
  index,
  designation,
  isActive,
  onActivate,
  onRemove,
}: AssignmentSlotProps) {
  if (designation) {
    return (
      <div
        className={`flex items-center justify-between rounded-lg border p-3 ${statusColors[designation.status] ?? 'border-gray-200 bg-white'}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {designation.person?.name ?? 'Persona desconocida'}
            </span>
            <Badge variant="outline" className="text-xs">
              {statusLabels[designation.status] ?? designation.status}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            {designation.municipality && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {designation.municipality.name}
              </span>
            )}
            <span>
              {designation.travelCost} € · {designation.distanceKm} km
            </span>
          </div>
        </div>
        {onRemove && designation.status !== 'completed' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(designation.id)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={onActivate}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-sm transition-colors ${
        isActive
          ? 'border-fbm-orange text-fbm-orange bg-orange-50'
          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
      }`}
    >
      <Plus className="h-4 w-4" />
      <span>
        Asignar {role === 'arbitro' ? 'árbitro' : 'anotador'} {index + 1}
      </span>
    </button>
  )
}
