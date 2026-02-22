'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Target,
  Trash2,
  Check,
} from 'lucide-react'
import type { SolverMetrics, UnassignedSlot } from '@/lib/types'

interface OptimizationBannerProps {
  status: 'optimal' | 'feasible' | 'partial' | 'no_solution'
  metrics: SolverMetrics
  unassigned: UnassignedSlot[]
  newAssignmentsCount: number
  onApply: () => void
  onDiscard: () => void
  applying: boolean
}

const statusConfig = {
  optimal: {
    icon: CheckCircle2,
    label: 'Solución óptima',
    color: 'bg-green-50 border-green-200 text-green-800',
    badgeColor: 'bg-green-100 text-green-700',
  },
  feasible: {
    icon: CheckCircle2,
    label: 'Solución factible',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Solución parcial',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  no_solution: {
    icon: XCircle,
    label: 'Sin solución',
    color: 'bg-red-50 border-red-200 text-red-800',
    badgeColor: 'bg-red-100 text-red-700',
  },
}

export function OptimizationBanner({
  status,
  metrics,
  unassigned,
  newAssignmentsCount,
  onApply,
  onDiscard,
  applying,
}: OptimizationBannerProps) {
  const [showUnassigned, setShowUnassigned] = useState(false)
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className={`rounded-xl border p-4 ${config.color}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{config.label}</span>
              <Badge className={`text-xs ${config.badgeColor}`}>
                {newAssignmentsCount} nueva{newAssignmentsCount !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs opacity-80">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {metrics.totalCost.toFixed(2)} €
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {metrics.coverage}% cobertura ({metrics.coveredSlots}/{metrics.totalSlots})
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {metrics.resolutionTimeMs} ms
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={applying}
            className="border-current/20 hover:bg-current/10 gap-1 text-current"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Descartar
          </Button>
          {newAssignmentsCount > 0 && (
            <Button
              size="sm"
              onClick={onApply}
              disabled={applying}
              className="gap-1 bg-green-600 text-white hover:bg-green-700"
            >
              <Check className="h-3.5 w-3.5" />
              {applying ? 'Aplicando...' : 'Aplicar propuesta'}
            </Button>
          )}
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="border-current/10 mt-3 border-t pt-3">
          <button
            onClick={() => setShowUnassigned(!showUnassigned)}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
          >
            {showUnassigned ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {unassigned.length} slot{unassigned.length !== 1 ? 's' : ''} sin cubrir
          </button>
          {showUnassigned && (
            <div className="mt-2 space-y-1">
              {unassigned.map((u, i) => (
                <div key={i} className="rounded bg-white/50 px-3 py-1.5 text-xs">
                  <span className="font-medium">{u.matchLabel}</span>
                  <span className="text-current/60 mx-1">·</span>
                  <span>
                    {u.role === 'arbitro' ? 'Árbitro' : 'Anotador'} {u.slotIndex + 1}
                  </span>
                  <span className="text-current/60 mx-1">·</span>
                  <span className="italic">{u.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
