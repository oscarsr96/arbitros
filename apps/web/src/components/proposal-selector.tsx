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
  X,
  Users,
} from 'lucide-react'
import type { Proposal, UnassignedSlot } from '@/lib/types'

interface ProposalSelectorProps {
  proposals: Proposal[]
  activeProposalId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onApply: () => void
  onDiscardAll: () => void
  applying: boolean
}

const statusConfig = {
  optimal: {
    icon: CheckCircle2,
    label: 'Solución óptima',
    ring: 'ring-green-500',
    bg: 'bg-green-50',
    bgHover: 'hover:bg-green-50/70',
    border: 'border-green-300',
    borderInactive: 'border-green-200',
    text: 'text-green-700',
    badgeBg: 'bg-green-100 text-green-700',
    progressBar: 'bg-green-500',
  },
  feasible: {
    icon: CheckCircle2,
    label: 'Solución factible',
    ring: 'ring-blue-500',
    bg: 'bg-blue-50',
    bgHover: 'hover:bg-blue-50/70',
    border: 'border-blue-300',
    borderInactive: 'border-blue-200',
    text: 'text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-700',
    progressBar: 'bg-blue-500',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Solución parcial',
    ring: 'ring-amber-500',
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-50/70',
    border: 'border-amber-300',
    borderInactive: 'border-amber-200',
    text: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-700',
    progressBar: 'bg-amber-500',
  },
  no_solution: {
    icon: XCircle,
    label: 'Sin solución',
    ring: 'ring-red-500',
    bg: 'bg-red-50',
    bgHover: 'hover:bg-red-50/70',
    border: 'border-red-300',
    borderInactive: 'border-red-200',
    text: 'text-red-700',
    badgeBg: 'bg-red-100 text-red-700',
    progressBar: 'bg-red-500',
  },
}

export function ProposalSelector({
  proposals,
  activeProposalId,
  onSelect,
  onDelete,
  onApply,
  onDiscardAll,
  applying,
}: ProposalSelectorProps) {
  const [expandedUnassigned, setExpandedUnassigned] = useState<string | null>(null)

  const activeProposal = proposals.find((p) => p.id === activeProposalId)
  const newAssignmentsCount = activeProposal
    ? activeProposal.assignments.filter((a) => a.isNew).length
    : 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Propuestas de asignación</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Selecciona una propuesta para previsualizarla en los partidos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscardAll}
            disabled={applying}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Descartar todas
          </Button>
          {newAssignmentsCount > 0 && (
            <Button
              size="sm"
              onClick={onApply}
              disabled={applying}
              className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
            >
              <Check className="h-3.5 w-3.5" />
              {applying ? 'Aplicando...' : 'Aplicar seleccionada'}
            </Button>
          )}
        </div>
      </div>

      {/* Cards grid — max 3 per row for readability */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {proposals.map((proposal) => {
          const config = statusConfig[proposal.status]
          const StatusIcon = config.icon
          const isActive = proposal.id === activeProposalId
          const newCount = proposal.assignments.filter((a) => a.isNew).length
          const coveragePct = proposal.metrics.coverage

          return (
            <button
              key={proposal.id}
              onClick={() => onSelect(proposal.id)}
              className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                isActive
                  ? `${config.bg} ${config.border} ring-2 ${config.ring} shadow-sm`
                  : `border-gray-200 bg-white ${config.bgHover} hover:border-gray-300 hover:shadow-sm`
              }`}
            >
              {/* Delete button */}
              {proposals.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(proposal.id)
                  }}
                  className="absolute right-3 top-3 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Title row */}
              <div className="mb-3 flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? config.badgeBg : 'bg-gray-100'}`}
                >
                  <StatusIcon
                    className={`h-4.5 w-4.5 ${isActive ? config.text : 'text-gray-500'}`}
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{proposal.label}</div>
                  <Badge className={`mt-0.5 text-xs ${config.badgeBg}`}>{config.label}</Badge>
                </div>
              </div>

              {/* Coverage bar */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600">Cobertura</span>
                  <span
                    className={`font-bold ${coveragePct === 100 ? 'text-green-600' : coveragePct >= 80 ? 'text-amber-600' : 'text-red-600'}`}
                  >
                    {coveragePct}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${config.progressBar}`}
                    style={{ width: `${coveragePct}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {proposal.metrics.coveredSlots} de {proposal.metrics.totalSlots} slots cubiertos
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-center">
                  <DollarSign className="mx-auto mb-1 h-4 w-4 text-gray-400" />
                  <div className="text-sm font-bold text-gray-900">
                    {proposal.metrics.totalCost.toFixed(0)} €
                  </div>
                  <div className="text-[11px] text-gray-500">Coste</div>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-center">
                  <Users className="mx-auto mb-1 h-4 w-4 text-gray-400" />
                  <div className="text-sm font-bold text-gray-900">{newCount}</div>
                  <div className="text-[11px] text-gray-500">Nueva{newCount !== 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-center">
                  <Clock className="mx-auto mb-1 h-4 w-4 text-gray-400" />
                  <div className="text-sm font-bold text-gray-900">
                    {proposal.metrics.resolutionTimeMs} ms
                  </div>
                  <div className="text-[11px] text-gray-500">Tiempo</div>
                </div>
              </div>

              {/* Unassigned slots */}
              {proposal.unassigned.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedUnassigned(expandedUnassigned === proposal.id ? null : proposal.id)
                    }}
                    className="flex w-full items-center justify-between text-xs font-medium text-amber-700"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {proposal.unassigned.length} slot{proposal.unassigned.length !== 1 ? 's' : ''}{' '}
                      sin cubrir
                    </span>
                    {expandedUnassigned === proposal.id ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedUnassigned === proposal.id && (
                    <UnassignedList unassigned={proposal.unassigned} />
                  )}
                </div>
              )}

              {/* Active indicator */}
              {isActive && (
                <div
                  className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold ${config.text} ${config.badgeBg}`}
                >
                  <Target className="h-3.5 w-3.5" />
                  Seleccionada
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function UnassignedList({ unassigned }: { unassigned: UnassignedSlot[] }) {
  return (
    <div className="mt-2 space-y-1">
      {unassigned.slice(0, 5).map((u, i) => (
        <div key={i} className="rounded bg-white/80 px-2 py-1 text-xs text-gray-600">
          <span className="font-medium">{u.matchLabel}</span>
          <span className="mx-1 text-gray-400">·</span>
          <span>
            {u.role === 'arbitro' ? 'Árbitro' : 'Anotador'} {u.slotIndex + 1}
          </span>
          {u.reason && (
            <>
              <span className="mx-1 text-gray-400">·</span>
              <span className="italic text-gray-500">{u.reason}</span>
            </>
          )}
        </div>
      ))}
      {unassigned.length > 5 && (
        <div className="px-2 text-xs text-gray-400">+{unassigned.length - 5} más</div>
      )}
    </div>
  )
}
