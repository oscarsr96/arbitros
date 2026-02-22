'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MatchCard } from '@/components/match-card'
import { AssignmentSlot } from '@/components/assignment-slot'
import { PersonPicker } from '@/components/person-picker'
import { PublishDialog } from '@/components/publish-dialog'
import { useAdminStore } from '@/stores/admin-store'
import { Send, Zap, Info } from 'lucide-react'
import { toast } from 'sonner'
import type { EnrichedMatch, AssignmentValidation } from '@/lib/types'
import {
  mockPersons,
  mockDesignations,
  calculateMockTravelCost,
  isPersonAvailable,
  hasTimeOverlap,
  meetsMinCategory,
  getPersonIncompatibilities,
  getMockMunicipality,
  getMockVenue,
} from '@/lib/mock-data'

interface PickerPerson {
  id: string
  name: string
  role: 'arbitro' | 'anotador'
  category: string | null
  municipalityId: string
  municipalityName: string
  travelCost: number
  travelKm: number
  matchesAssigned: number
  validation: AssignmentValidation
}

export function AsignacionView() {
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'cost' | 'load'>('cost')
  const { activeSlot, setActiveSlot, expandedMatchIds, toggleExpandedMatch } = useAdminStore()

  const fetchMatches = useCallback(() => {
    fetch('/api/admin/matches')
      .then((r) => r.json())
      .then((data) => setMatches(data.matches))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleAssign = async (personId: string) => {
    if (!activeSlot) return

    const res = await fetch('/api/admin/designations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: activeSlot.matchId,
        personId,
        role: activeSlot.role,
      }),
    })

    if (res.ok) {
      toast.success('Persona asignada correctamente')
      setActiveSlot(null)
      fetchMatches()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Error al asignar')
    }
  }

  const handleRemove = async (designationId: string) => {
    const res = await fetch(`/api/admin/designations/${designationId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      toast.success('Asignación eliminada')
      fetchMatches()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Error al eliminar')
    }
  }

  const handlePublish = async () => {
    const res = await fetch('/api/admin/designations/publish', { method: 'POST' })
    const data = await res.json()
    toast.success(data.message)
    setPublishOpen(false)
    fetchMatches()
  }

  // Build person picker data for active slot
  const getPickerPersons = (): PickerPerson[] => {
    if (!activeSlot) return []

    const match = matches.find((m) => m.id === activeSlot.matchId)
    if (!match) return []

    const venue = match.venue ? getMockVenue(match.venueId) : undefined

    return mockPersons
      .filter((p) => p.role === activeSlot.role && p.active)
      .map((person) => {
        const municipality = getMockMunicipality(person.municipalityId)
        const { cost, km } = calculateMockTravelCost(
          person.municipalityId,
          venue?.municipalityId ?? '',
        )

        // Count current active assignments for this person
        const assigned = mockDesignations.filter(
          (d) => d.personId === person.id && d.status !== 'rejected',
        ).length

        // Already assigned to this match?
        const alreadyAssigned = match.designations.some(
          (d) => d.personId === person.id && d.status !== 'rejected',
        )

        // Validate
        let validation: AssignmentValidation = { valid: true }

        if (alreadyAssigned) {
          validation = { valid: false, reason: 'Ya asignado a este partido' }
        } else if (!isPersonAvailable(person.id, match.date, match.time)) {
          validation = { valid: false, reason: 'No disponible en esta franja' }
        } else if (hasTimeOverlap(person.id, match.id)) {
          validation = { valid: false, reason: 'Solapamiento con otro partido' }
        } else if (
          activeSlot.role === 'arbitro' &&
          match.competition?.minRefCategory &&
          !meetsMinCategory(person.category, match.competition.minRefCategory)
        ) {
          validation = {
            valid: false,
            reason: `Categoría insuficiente (mín. ${match.competition.minRefCategory})`,
          }
        } else {
          // Check incompatibilities
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
          municipalityId: person.municipalityId,
          municipalityName: municipality?.name ?? '',
          travelCost: cost,
          travelKm: km,
          matchesAssigned: assigned,
          validation,
        }
      })
  }

  const totalMatches = matches.length
  const coveredMatches = matches.filter((m) => m.isCovered).length
  const pendingDesigs = mockDesignations.filter((d) => d.status === 'pending').length
  const personsToNotify = new Set(
    mockDesignations.filter((d) => d.status === 'pending').map((d) => d.personId),
  ).size

  // Sort matches by date/time
  const sorted = [...matches].sort((a, b) => {
    const dc = a.date.localeCompare(b.date)
    return dc !== 0 ? dc : a.time.localeCompare(b.time)
  })

  return (
    <TooltipProvider>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asignación</h1>
            <p className="mt-1 text-sm text-gray-500">
              Asignación manual de árbitros y anotadores a partidos.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled className="gap-2 opacity-50">
                <Zap className="h-4 w-4" />
                Asignación automática
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Disponible en Fase 3 (motor OR-Tools)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Optimizer config (display only) */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800">Parámetros del optimizador</h2>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Configurables cuando el motor de optimización esté activo (Fase 3)</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Peso coste (α)</label>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                0.7
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Peso equilibrio (β)
              </label>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                0.3
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Máx. partidos/persona
              </label>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                3
              </div>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Left: matches */}
          <div className="space-y-3 lg:col-span-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl border bg-gray-50" />
                ))}
              </div>
            ) : (
              sorted.map((match) => {
                const expanded = expandedMatchIds.has(match.id)
                const refDesigs = match.designations.filter(
                  (d) => d.role === 'arbitro' && d.status !== 'rejected',
                )
                const scorerDesigs = match.designations.filter(
                  (d) => d.role === 'anotador' && d.status !== 'rejected',
                )

                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    expanded={expanded}
                    onToggle={() => toggleExpandedMatch(match.id)}
                  >
                    <div className="space-y-4">
                      {/* Referee slots */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-gray-600">Árbitros</h4>
                        <div className="space-y-2">
                          {Array.from({ length: match.refereesNeeded }).map((_, i) => (
                            <AssignmentSlot
                              key={`ref-${i}`}
                              role="arbitro"
                              index={i}
                              designation={refDesigs[i]}
                              isActive={
                                activeSlot?.matchId === match.id &&
                                activeSlot?.role === 'arbitro' &&
                                i >= refDesigs.length
                              }
                              onActivate={() =>
                                i >= refDesigs.length
                                  ? setActiveSlot({ matchId: match.id, role: 'arbitro' })
                                  : undefined
                              }
                              onRemove={handleRemove}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Scorer slots */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-gray-600">Anotadores</h4>
                        <div className="space-y-2">
                          {Array.from({ length: match.scorersNeeded }).map((_, i) => (
                            <AssignmentSlot
                              key={`scorer-${i}`}
                              role="anotador"
                              index={i}
                              designation={scorerDesigs[i]}
                              isActive={
                                activeSlot?.matchId === match.id &&
                                activeSlot?.role === 'anotador' &&
                                i >= scorerDesigs.length
                              }
                              onActivate={() =>
                                i >= scorerDesigs.length
                                  ? setActiveSlot({ matchId: match.id, role: 'anotador' })
                                  : undefined
                              }
                              onRemove={handleRemove}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </MatchCard>
                )
              })
            )}
          </div>

          {/* Right: person picker */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              <PersonPicker
                persons={getPickerPersons()}
                activeSlot={activeSlot}
                onAssign={handleAssign}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-card fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 px-6 py-3 shadow-lg lg:left-56">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">
                {coveredMatches} de {totalMatches} cubiertos
              </span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${totalMatches > 0 ? (coveredMatches / totalMatches) * 100 : 0}%`,
                  }}
                />
              </div>
              {pendingDesigs > 0 && (
                <Badge variant="outline" className="text-xs">
                  {pendingDesigs} pendiente{pendingDesigs !== 1 ? 's' : ''} de publicar
                </Badge>
              )}
            </div>
            <Button
              onClick={() => setPublishOpen(true)}
              disabled={pendingDesigs === 0}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Publicar designaciones
            </Button>
          </div>
        </div>

        {/* Spacer for fixed bottom bar */}
        <div className="h-16" />

        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          onConfirm={handlePublish}
          stats={{
            totalMatches,
            coveredMatches,
            pendingDesignations: pendingDesigs,
            personsToNotify: personsToNotify,
          }}
        />
      </div>
    </TooltipProvider>
  )
}
