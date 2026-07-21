'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MapPin, Check, X, AlertTriangle } from 'lucide-react'
import type { EnrichedMatch, AssignmentValidation } from '@/lib/types'
import { POSITION_LABELS, type DesignationPosition } from '@/lib/designation-positions'

export interface SubstitutionContext {
  matchId: string
  role: 'arbitro' | 'anotador'
  removedPersonName: string
  position?: DesignationPosition
}

interface CandidatePerson {
  id: string
  name: string
  role: 'arbitro' | 'anotador'
  category: string | null
  municipalityName: string
  travelCost: number
  travelKm: number
  matchesAssigned: number
  validation: AssignmentValidation
}

interface SubstitutionPanelProps {
  context: SubstitutionContext | null
  matches: EnrichedMatch[]
  onClose: () => void
  onSubstitute: (personId: string) => void
}

// Los candidatos y su validación los calcula el servidor
// (/api/admin/picker → lib/candidate-picker.ts). Antes se calculaban aquí, lo
// que obligaba a importar mock-data (disponibilidad y solapamientos dependen
// del calendario) y metía el seed de partidos, ~10 MB, en el bundle de cliente.
// De paso, `hasTimeOverlap` ahora es correcto: en cliente leía la copia
// estática de mockDesignations, siempre vacía, y nunca detectaba nada.
function useCandidates(context: SubstitutionContext | null) {
  const [candidates, setCandidates] = useState<CandidatePerson[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!context) {
      setCandidates([])
      return
    }
    const params = new URLSearchParams({ matchId: context.matchId, role: context.role })
    if (context.position) params.set('position', context.position)

    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/picker?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        // Válidos primero, luego por coste (mismo orden que antes).
        const list: CandidatePerson[] = data.candidates ?? []
        setCandidates(
          [...list].sort((a, b) => {
            if (a.validation.valid && !b.validation.valid) return -1
            if (!a.validation.valid && b.validation.valid) return 1
            return a.travelCost - b.travelCost
          }),
        )
      })
      .catch(() => {
        if (!cancelled) setCandidates([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [context])

  return { candidates, loading }
}

export function SubstitutionPanel({
  context,
  matches,
  onClose,
  onSubstitute,
}: SubstitutionPanelProps) {
  const match = context ? matches.find((m) => m.id === context.matchId) : null
  // La posición efectiva del hueco (la de la designación eliminada, o la
  // derivada de las restantes si era legacy) la resuelve el servidor cuando
  // `position` no viaja en la query — ver buildCandidates (Fix A1).
  const { candidates, loading } = useCandidates(context)
  const validCount = candidates.filter((c) => c.validation.valid).length

  return (
    <Sheet
      open={!!context}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Sustitución rápida</SheetTitle>
        </SheetHeader>

        {context && match && (
          <div className="space-y-4 pt-4">
            {/* Context info */}
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">
                Se ha eliminado a <span className="font-bold">{context.removedPersonName}</span>
              </p>
              <p className="mt-1 text-xs text-red-600">
                {match.homeTeam} vs {match.awayTeam} — {match.date} · {match.time}
              </p>
              <p className="text-xs text-red-600">
                Rol: {context.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
                {context.position && ` (${POSITION_LABELS[context.position]})`}
              </p>
            </div>

            {/* Candidates count */}
            <p className="text-xs font-medium text-gray-600">
              {loading
                ? 'Buscando candidatos…'
                : `${validCount} candidato${validCount !== 1 ? 's' : ''} disponible${
                    validCount !== 1 ? 's' : ''
                  } de ${candidates.length} total${candidates.length !== 1 ? 'es' : ''}`}
            </p>

            {/* Candidates list */}
            <div className="space-y-2">
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                ))}
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={`rounded-lg border p-3 ${
                    candidate.validation.valid
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{candidate.name}</span>
                        {candidate.category && (
                          <Badge variant="outline" className="text-[10px]">
                            {candidate.category}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {candidate.municipalityName}
                        </span>
                        <span>{candidate.travelCost.toFixed(2)} €</span>
                        <span>{candidate.travelKm} km</span>
                        <span>
                          {candidate.matchesAssigned} partido
                          {candidate.matchesAssigned !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {candidate.validation.valid ? (
                      <Button
                        size="sm"
                        className="ml-2 gap-1"
                        onClick={() => onSubstitute(candidate.id)}
                      >
                        <Check className="h-3 w-3" />
                        Asignar
                      </Button>
                    ) : (
                      <div className="ml-2 flex items-center gap-1 text-xs text-red-500">
                        <AlertTriangle className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  {!candidate.validation.valid && candidate.validation.reason && (
                    <p className="mt-1 text-[10px] text-red-500">{candidate.validation.reason}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t pt-3">
              <Button variant="outline" className="w-full gap-2" onClick={onClose}>
                <X className="h-4 w-4" />
                Cerrar sin sustituir
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
