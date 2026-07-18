'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MapPin, Check, X, AlertTriangle } from 'lucide-react'
import type { EnrichedMatch, AssignmentValidation } from '@/lib/types'
import {
  mockPersons,
  calculateMockTravelCost,
  isPersonAvailable,
  hasTimeOverlap,
  getPersonIncompatibilities,
  getMockMunicipality,
  getMockVenue,
} from '@/lib/mock-data'
import {
  POSITION_LABELS,
  firstFreePosition,
  type DesignationPosition,
} from '@/lib/designation-positions'
import { checkSlotEligibility, isRefereeLevel } from '@/lib/referee-eligibility'
import { resolveFineCategory } from '@/lib/competition-fine-category'

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

function getCandidates(
  match: EnrichedMatch,
  role: 'arbitro' | 'anotador',
  matches: EnrichedMatch[],
  removedPosition?: DesignationPosition,
): CandidatePerson[] {
  const venue = match.venue ? getMockVenue(match.venueId) : undefined
  // Categoría fina (T6): `matches` viene de `/api/admin/matches`, que no la
  // enriquece (solo lo hace el enrich del solver), así que se resuelve aquí
  // por nombre canónico.
  const fineCategory = match.competition ? resolveFineCategory(match.competition) : null

  // Posición efectiva del hueco (Fix A1, review 7 niveles): si la designación
  // eliminada llevaba `position`, esa es la vacante. Si era legacy (sin
  // `position`, las ~90 reales del piloto), se deriva de las designaciones
  // RESTANTES del partido (ya sin la eliminada: `match` viene del estado
  // `matches`, recién refrescado tras el DELETE) con la MISMA regla que
  // aplicará el POST de sustitución (`autoFillPosition`/`mapDesignationsToSlots`).
  // Sin esto, un hueco Principal se validaba con la regla genérica de "pita en
  // algún rol" en vez de exigir el rol `principal`.
  const needed = role === 'arbitro' ? match.refereesNeeded : match.scorersNeeded
  const effectivePosition = removedPosition ?? firstFreePosition(match.designations, role, needed)
  const slotPosition =
    effectivePosition === 'principal' || effectivePosition === 'auxiliar'
      ? effectivePosition
      : undefined

  const assignedCounts = new Map<string, number>()
  for (const m of matches) {
    for (const d of m.designations) {
      assignedCounts.set(d.personId, (assignedCounts.get(d.personId) ?? 0) + 1)
    }
  }

  return mockPersons
    .filter((p) => p.role === role && p.active)
    .map((person) => {
      const municipality = getMockMunicipality(person.municipalityId)
      const { cost, km } = calculateMockTravelCost(
        person.municipalityId,
        venue?.municipalityId ?? '',
      )
      const assigned = assignedCounts.get(person.id) ?? 0

      const alreadyAssigned = match.designations.some((d) => d.personId === person.id)

      let validation: AssignmentValidation = { valid: true }

      if (alreadyAssigned) {
        validation = { valid: false, reason: 'Ya asignado a este partido' }
      } else if (!isPersonAvailable(person.id, match.date, match.time)) {
        validation = { valid: false, reason: 'No disponible en esta franja' }
      } else if (hasTimeOverlap(person.id, match.id)) {
        validation = { valid: false, reason: 'Solapamiento con otro partido' }
      } else if (
        role === 'arbitro' &&
        match.competition &&
        !checkSlotEligibility(
          { role: person.role, category: person.category, refereeLevel: person.refereeLevel },
          { fineCategory, minRefCategory: match.competition.minRefCategory },
          slotPosition,
        )
      ) {
        validation = {
          valid: false,
          reason:
            fineCategory && isRefereeLevel(person.refereeLevel)
              ? 'Nivel no elegible para esta competición'
              : `Categoría insuficiente (mín. ${match.competition.minRefCategory})`,
        }
      } else {
        const incomps = getPersonIncompatibilities(person.id)
        const hasIncompat = incomps.some(
          (inc) =>
            match.homeTeam.toLowerCase().includes(inc.teamName.toLowerCase()) ||
            match.awayTeam.toLowerCase().includes(inc.teamName.toLowerCase()),
        )
        if (hasIncompat) {
          validation = { valid: false, reason: 'Incompatibilidad con equipo' }
        }
      }

      return {
        id: person.id,
        name: person.name,
        role: person.role,
        category: person.category,
        municipalityName: municipality?.name ?? '',
        travelCost: cost,
        travelKm: km,
        matchesAssigned: assigned,
        validation,
      }
    })
    .sort((a, b) => {
      // Valid candidates first, then by cost
      if (a.validation.valid && !b.validation.valid) return -1
      if (!a.validation.valid && b.validation.valid) return 1
      return a.travelCost - b.travelCost
    })
}

export function SubstitutionPanel({
  context,
  matches,
  onClose,
  onSubstitute,
}: SubstitutionPanelProps) {
  const match = context ? matches.find((m) => m.id === context.matchId) : null
  // La posición efectiva del hueco (la de la designación eliminada, o la
  // derivada de las restantes si era legacy) se calcula dentro de
  // `getCandidates` — ver comentario ahí (Fix A1).
  const candidates =
    match && context ? getCandidates(match, context.role, matches, context.position) : []
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
              {validCount} candidato{validCount !== 1 ? 's' : ''} disponible
              {validCount !== 1 ? 's' : ''} de {candidates.length} total
              {candidates.length !== 1 ? 'es' : ''}
            </p>

            {/* Candidates list */}
            <div className="space-y-2">
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
