'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MatchCard } from '@/components/match-card'
import { AssignmentSlot } from '@/components/assignment-slot'
import { PersonPicker } from '@/components/person-picker'
import { PublishDialog } from '@/components/publish-dialog'
import { ProposalSelector } from '@/components/proposal-selector'
import { SubstitutionPanel, type SubstitutionContext } from '@/components/substitution-panel'
import { useAdminStore } from '@/stores/admin-store'
import { Send, Zap, Loader2, MapPin, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { EnrichedMatch, AssignmentValidation, ProposedAssignment, Proposal } from '@/lib/types'
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
  const [applying, setApplying] = useState(false)
  const [substitutionContext, setSubstitutionContext] = useState<SubstitutionContext | null>(null)
  const { activeSlot, setActiveSlot, expandedMatchIds, toggleExpandedMatch } = useAdminStore()

  const {
    optimizationState,
    solverParameters,
    proposals,
    activeProposalId,
    showDiff,
    setSolverParameters,
    setProposals,
    setActiveProposalId,
    deleteProposal,
    setOptimizationState,
    setShowDiff,
    clearAllProposals,
  } = useAdminStore()

  const fetchMatches = useCallback(() => {
    fetch('/api/admin/matches')
      .then((r) => r.json())
      .then((data) => setMatches(data.matches))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  // Derive active proposal
  const activeProposal = proposals.find((p) => p.id === activeProposalId) ?? null
  const proposedAssignments = activeProposal?.assignments ?? []

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
    // Find designation details before deleting
    let removedPersonName = ''
    let removedMatchId = ''
    let removedRole: 'arbitro' | 'anotador' = 'arbitro'
    for (const match of matches) {
      const desig = match.designations.find((d) => d.id === designationId)
      if (desig) {
        removedPersonName = desig.person?.name ?? ''
        removedMatchId = match.id
        removedRole = desig.role
        break
      }
    }

    const res = await fetch(`/api/admin/designations/${designationId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      toast.success('Asignación eliminada')
      fetchMatches()
      // Open substitution panel
      if (removedMatchId && removedPersonName) {
        setSubstitutionContext({
          matchId: removedMatchId,
          role: removedRole,
          removedPersonName,
        })
      }
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Error al eliminar')
    }
  }

  const handleSubstitute = async (personId: string) => {
    if (!substitutionContext) return
    const res = await fetch('/api/admin/designations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: substitutionContext.matchId,
        personId,
        role: substitutionContext.role,
      }),
    })

    if (res.ok) {
      toast.success('Sustituto asignado correctamente')
      setSubstitutionContext(null)
      fetchMatches()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Error al asignar sustituto')
    }
  }

  const handlePublish = async () => {
    const res = await fetch('/api/admin/designations/publish', { method: 'POST' })
    const data = await res.json()
    toast.success(data.message)
    setPublishOpen(false)
    fetchMatches()
  }

  const handleRunOptimization = async () => {
    setOptimizationState('running')
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costWeight: solverParameters.costWeight,
          balanceWeight: solverParameters.balanceWeight,
          maxMatchesPerPerson: solverParameters.maxMatchesPerPerson,
          forceExisting: solverParameters.forceExisting,
          numProposals: solverParameters.numProposals,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error del solver')
      }

      const result = await res.json()
      const receivedProposals: Proposal[] = result.proposals
      setProposals(receivedProposals)
      toast.success(
        `${receivedProposals.length} propuesta${receivedProposals.length !== 1 ? 's' : ''} generada${receivedProposals.length !== 1 ? 's' : ''}`,
      )
    } catch (error) {
      setOptimizationState('error')
      toast.error(error instanceof Error ? error.message : 'Error al optimizar')
    }
  }

  const handleApplyProposal = async () => {
    if (!activeProposal) return
    const newAssignments = activeProposal.assignments.filter((a) => a.isNew)
    if (newAssignments.length === 0) return

    setApplying(true)
    let success = 0
    let failed = 0

    for (const assignment of newAssignments) {
      const res = await fetch('/api/admin/designations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: assignment.matchId,
          personId: assignment.personId,
          role: assignment.role,
        }),
      })
      if (res.ok) success++
      else failed++
    }

    setApplying(false)
    clearAllProposals()
    fetchMatches()

    if (failed === 0) {
      toast.success(`${success} asignaciones aplicadas correctamente`)
    } else {
      toast.warning(`${success} aplicadas, ${failed} fallidas`)
    }
  }

  const handleReoptimizeSlot = async (matchId: string, role: 'arbitro' | 'anotador') => {
    const match = matches.find((m) => m.id === matchId)
    if (!match) return

    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costWeight: solverParameters.costWeight,
          balanceWeight: solverParameters.balanceWeight,
          maxMatchesPerPerson: solverParameters.maxMatchesPerPerson,
          forceExisting: true,
          numProposals: 1,
          partial: { matchId, role },
        }),
      })

      if (res.ok) {
        const result = await res.json()
        const proposal: Proposal | undefined = result.proposals?.[0]
        if (proposal && proposal.assignments.length > 0) {
          toast.success('Candidato encontrado')
          const a = proposal.assignments[0]
          const assignRes = await fetch('/api/admin/designations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId: a.matchId,
              personId: a.personId,
              role: a.role,
            }),
          })
          if (assignRes.ok) {
            fetchMatches()
            toast.success(`${a.personName} asignado/a`)
          }
        } else {
          toast.error('No se encontró candidato disponible')
        }
      }
    } catch {
      toast.error('Error al re-optimizar')
    }
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

        const assigned = mockDesignations.filter((d) => d.personId === person.id).length

        const alreadyAssigned = match.designations.some((d) => d.personId === person.id)

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

  // Get proposed assignments for a specific match slot from the active proposal
  const getProposedForSlot = (
    matchId: string,
    role: 'arbitro' | 'anotador',
  ): ProposedAssignment[] => {
    if (optimizationState !== 'done' || !showDiff || !activeProposal) return []
    return proposedAssignments.filter((a) => a.matchId === matchId && a.role === role && a.isNew)
  }

  const totalMatches = matches.length
  const coveredMatches = matches.filter((m) => m.isCovered).length
  const pendingDesigs = mockDesignations.filter((d) => d.status === 'pending').length
  const personsToNotify = new Set(
    mockDesignations.filter((d) => d.status === 'pending').map((d) => d.personId),
  ).size

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
              Asignación manual y automática de árbitros y anotadores.
            </p>
          </div>
          <Button
            onClick={handleRunOptimization}
            disabled={optimizationState === 'running'}
            className="gap-2"
          >
            {optimizationState === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {optimizationState === 'running' ? 'Optimizando...' : 'Asignación automática'}
          </Button>
        </div>

        {/* Optimizer parameters */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-800">Parámetros del optimizador</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Peso coste (α): {solverParameters.costWeight.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={solverParameters.costWeight}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setSolverParameters({
                    costWeight: v,
                    balanceWeight: Number((1 - v).toFixed(1)),
                  })
                }}
                className="accent-fbm-orange h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Peso equilibrio (β): {solverParameters.balanceWeight.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={solverParameters.balanceWeight}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setSolverParameters({
                    balanceWeight: v,
                    costWeight: Number((1 - v).toFixed(1)),
                  })
                }}
                className="accent-fbm-orange h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Máx. partidos/persona
              </label>
              <select
                value={solverParameters.maxMatchesPerPerson}
                onChange={(e) =>
                  setSolverParameters({ maxMatchesPerPerson: parseInt(e.target.value) })
                }
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Nº ejecuciones</label>
              <select
                value={solverParameters.numProposals}
                onChange={(e) => setSolverParameters({ numProposals: parseInt(e.target.value) })}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <input
                  type="checkbox"
                  checked={solverParameters.forceExisting}
                  onChange={(e) => setSolverParameters({ forceExisting: e.target.checked })}
                  className="accent-fbm-orange rounded border-gray-300"
                />
                Mantener existentes
              </label>
            </div>
          </div>
        </div>

        {/* Proposal selector (replaces single optimization banner) */}
        {optimizationState === 'done' && proposals.length > 0 && (
          <div className="mb-5">
            <ProposalSelector
              proposals={proposals}
              activeProposalId={activeProposalId}
              onSelect={setActiveProposalId}
              onDelete={deleteProposal}
              onApply={handleApplyProposal}
              onDiscardAll={clearAllProposals}
              applying={applying}
            />
          </div>
        )}

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
                const refDesigs = match.designations.filter((d) => d.role === 'arbitro')
                const scorerDesigs = match.designations.filter((d) => d.role === 'anotador')
                const proposedRefs = getProposedForSlot(match.id, 'arbitro')
                const proposedScorers = getProposedForSlot(match.id, 'anotador')

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
                          {Array.from({ length: match.refereesNeeded }).map((_, i) => {
                            const existingDesig = refDesigs[i]
                            const proposedForSlot =
                              !existingDesig && proposedRefs.length > i - refDesigs.length
                                ? proposedRefs[i - refDesigs.length]
                                : undefined

                            return (
                              <div key={`ref-${i}`}>
                                {existingDesig ? (
                                  <AssignmentSlot
                                    role="arbitro"
                                    index={i}
                                    designation={existingDesig}
                                    isActive={false}
                                    onRemove={handleRemove}
                                  />
                                ) : proposedForSlot ? (
                                  <ProposedSlot
                                    assignment={proposedForSlot}
                                    onReoptimize={() => handleReoptimizeSlot(match.id, 'arbitro')}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <AssignmentSlot
                                      role="arbitro"
                                      index={i}
                                      isActive={
                                        activeSlot?.matchId === match.id &&
                                        activeSlot?.role === 'arbitro' &&
                                        i >= refDesigs.length
                                      }
                                      onActivate={() =>
                                        i >= refDesigs.length
                                          ? setActiveSlot({
                                              matchId: match.id,
                                              role: 'arbitro',
                                            })
                                          : undefined
                                      }
                                      onRemove={handleRemove}
                                    />
                                    {optimizationState === 'done' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="hover:text-fbm-orange h-8 w-8 flex-shrink-0 p-0 text-gray-400"
                                            onClick={() =>
                                              handleReoptimizeSlot(match.id, 'arbitro')
                                            }
                                          >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Re-optimizar slot</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Scorer slots */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-gray-600">Anotadores</h4>
                        <div className="space-y-2">
                          {Array.from({ length: match.scorersNeeded }).map((_, i) => {
                            const existingDesig = scorerDesigs[i]
                            const proposedForSlot =
                              !existingDesig && proposedScorers.length > i - scorerDesigs.length
                                ? proposedScorers[i - scorerDesigs.length]
                                : undefined

                            return (
                              <div key={`scorer-${i}`}>
                                {existingDesig ? (
                                  <AssignmentSlot
                                    role="anotador"
                                    index={i}
                                    designation={existingDesig}
                                    isActive={false}
                                    onRemove={handleRemove}
                                  />
                                ) : proposedForSlot ? (
                                  <ProposedSlot
                                    assignment={proposedForSlot}
                                    onReoptimize={() => handleReoptimizeSlot(match.id, 'anotador')}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <AssignmentSlot
                                      role="anotador"
                                      index={i}
                                      isActive={
                                        activeSlot?.matchId === match.id &&
                                        activeSlot?.role === 'anotador' &&
                                        i >= scorerDesigs.length
                                      }
                                      onActivate={() =>
                                        i >= scorerDesigs.length
                                          ? setActiveSlot({
                                              matchId: match.id,
                                              role: 'anotador',
                                            })
                                          : undefined
                                      }
                                      onRemove={handleRemove}
                                    />
                                    {optimizationState === 'done' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="hover:text-fbm-orange h-8 w-8 flex-shrink-0 p-0 text-gray-400"
                                            onClick={() =>
                                              handleReoptimizeSlot(match.id, 'anotador')
                                            }
                                          >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Re-optimizar slot</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
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

        <SubstitutionPanel
          context={substitutionContext}
          matches={matches}
          onClose={() => setSubstitutionContext(null)}
          onSubstitute={handleSubstitute}
        />
      </div>
    </TooltipProvider>
  )
}

// ── Proposed assignment slot (orange dashed border) ─────────────────────────

function ProposedSlot({
  assignment,
  onReoptimize,
}: {
  assignment: ProposedAssignment
  onReoptimize: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{assignment.personName}</span>
          <Badge className="bg-orange-100 text-xs text-orange-700">Propuesta</Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {assignment.municipalityName}
          </span>
          <span>
            {assignment.travelCost.toFixed(2)} € · {assignment.distanceKm} km
          </span>
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hover:text-fbm-orange h-7 w-7 p-0 text-gray-400"
            onClick={(e) => {
              e.stopPropagation()
              onReoptimize()
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Buscar otro candidato</TooltipContent>
      </Tooltip>
    </div>
  )
}
