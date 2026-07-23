'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
import { Send, Zap, Loader2, MapPin, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { EnrichedMatch, AssignmentValidation, ProposedAssignment, Proposal } from '@/lib/types'
import { getJornadaSaturdayForDate, getMatchdayWindow } from '@/lib/matchday-availability'
import {
  mapDesignationsToSlots,
  positionForSlot,
  firstFreePosition,
} from '@/lib/designation-positions'
import {
  getPublishConflicts,
  type PublishConflictHelpers,
  type ScheduleConflict,
} from '@/lib/schedule-conflicts'

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
  matchdayNotes: string | null
}

/** Matriz de distancias entre municipios, servida por /api/catalog. */
type DistanceLookup = (originMuniId: string, destMuniId: string) => number

export function AsignacionView() {
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [sortBy, setSortBy] = useState<'cost' | 'load'>('cost')
  const [applying, setApplying] = useState(false)
  const [substitutionContext, setSubstitutionContext] = useState<SubstitutionContext | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rangeInitialized, setRangeInitialized] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [pickerPersons, setPickerPersons] = useState<PickerPerson[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  // Matriz de distancias entre municipios (~465 pares fijos), por fetch: vive en
  // mock-data, que importa el seed de partidos y no puede entrar en el bundle.
  const [distanceKm, setDistanceKm] = useState<DistanceLookup>(() => () => 35)
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

  // Default del rango: la primera JORNADA COMPLETA del calendario (viernes→jueves, vía
  // getMatchdayWindow), no solo el fin de semana. El piloto tiene partidos entre semana
  // (lunes→jueves) que deben entrar en la designación y contar para el tope de carga por
  // jornada.
  //
  // El rango se pide con `?meta=1` (solo minDate/maxDate y total) ANTES de pedir los
  // partidos: derivarlo del array de partidos obligaba a descargarse el calendario
  // entero, que con la temporada real son ~24.500 partidos ≈ 20 MB. Solo se calcula una
  // vez; cambios posteriores del usuario no se sobrescriben.
  useEffect(() => {
    fetch('/api/admin/matches?meta=1')
      .then((r) => r.json())
      .then((data) => {
        if (data.range?.minDate) {
          const jornadaWindow = getMatchdayWindow(getJornadaSaturdayForDate(data.range.minDate))
          setDateFrom(jornadaWindow.friday)
          setDateTo(jornadaWindow.thursday)
        }
      })
      .finally(() => setRangeInitialized(true))
  }, [])

  // Matriz de distancias para el cálculo de conflictos pre-publicación. Se indexa
  // una vez en un Map; el fallback de 35 km replica el de `getMockDistance`.
  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((data: { distances?: { originId: string; destId: string; distanceKm: number }[] }) => {
        const index = new Map<string, number>()
        for (const d of data.distances ?? []) {
          index.set(`${d.originId}|${d.destId}`, d.distanceKm)
          index.set(`${d.destId}|${d.originId}`, d.distanceKm)
        }
        setDistanceKm(() => (originId: string, destId: string) => {
          if (originId === destId) return 0
          return index.get(`${originId}|${destId}`) ?? 35
        })
      })
      .catch(() => {
        /* se mantiene el fallback fijo */
      })
  }, [])

  // Los partidos se piden YA FILTRADOS por el servidor con el rango activo.
  const fetchMatches = useCallback(() => {
    if (!rangeInitialized) return
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    setLoading(true)
    fetch(`/api/admin/matches?${params}`)
      .then((r) => r.json())
      .then((data) => setMatches(data.matches ?? []))
      .finally(() => setLoading(false))
  }, [rangeInitialized, dateFrom, dateTo])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  // Rango normalizado: si desde > hasta, se intercambian silenciosamente.
  const handleDateFromChange = (value: string) => {
    if (dateTo && value > dateTo) {
      setDateFrom(dateTo)
      setDateTo(value)
    } else {
      setDateFrom(value)
    }
  }

  const handleDateToChange = (value: string) => {
    // Solo intercambiar con un valor real: vaciar "Hasta" (value === '') debe abrir
    // el extremo superior, no invertir el rango (`'' < dateFrom` es true lexicográficamente).
    if (value && dateFrom && value < dateFrom) {
      setDateTo(dateFrom)
      setDateFrom(value)
    } else {
      setDateTo(value)
    }
  }

  // Opciones de categoría derivadas de los partidos cargados (value = categoría de
  // competición, label = nombre de competición), como en la vista de Partidos.
  const categoryOptions = useMemo(() => {
    const byValue = new Map<string, string>()
    for (const m of matches) {
      if (m.competition?.category) byValue.set(m.competition.category, m.competition.name)
    }
    return Array.from(byValue, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    )
  }, [matches])

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    )
  }

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (dateFrom && m.date < dateFrom) return false
      if (dateTo && m.date > dateTo) return false
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(m.competition?.category ?? '')
      ) {
        return false
      }
      return true
    })
  }, [matches, dateFrom, dateTo, selectedCategories])

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
        position: activeSlot.position,
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
    let removedPosition: SubstitutionContext['position']
    for (const match of matches) {
      const desig = match.designations.find((d) => d.id === designationId)
      if (desig) {
        removedPersonName = desig.person?.name ?? ''
        removedMatchId = match.id
        removedRole = desig.role
        removedPosition = desig.position
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
          position: removedPosition,
        })
      }
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Error al eliminar')
    }
  }

  const handleSubstitute = async (personId: string) => {
    if (!substitutionContext) return
    // Posición efectiva del hueco (Fix A1): si la designación eliminada llevaba
    // `position`, esa es la vacante. Si era legacy (sin `position`), se deriva
    // de las designaciones RESTANTES del partido (misma regla que
    // `getCandidates` en substitution-panel.tsx) y se envía EXPLÍCITA, para que
    // el POST no caiga en `autoFillPosition` (que ignora las legacy y
    // devolvería 'principal' aunque el hueco real validado fuera 'auxiliar').
    const match = matches.find((m) => m.id === substitutionContext.matchId)
    const needed =
      substitutionContext.role === 'arbitro'
        ? (match?.refereesNeeded ?? 0)
        : (match?.scorersNeeded ?? 0)
    const position =
      substitutionContext.position ??
      (match ? firstFreePosition(match.designations, substitutionContext.role, needed) : undefined)

    const res = await fetch('/api/admin/designations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: substitutionContext.matchId,
        personId,
        role: substitutionContext.role,
        position,
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/designations/persist', { method: 'POST' })
      if (res.ok) {
        toast.success('Designaciones guardadas ✓')
        setLastSavedAt(new Date())
      } else {
        toast.error('Error al guardar')
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
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
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
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
    try {
      // Propuesta generada SIN forzar: los partidos que cubre reemplazan sus
      // designaciones `pending` existentes (las publicadas no se tocan, ver
      // `replaceMatchIds` en el route). Con forzar, comportamiento actual intacto.
      const replaceMatchIds =
        activeProposal.forceExisting === false
          ? [...new Set(newAssignments.map((a) => a.matchId))]
          : undefined

      const res = await fetch('/api/admin/designations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: newAssignments.map((a) => ({
            matchId: a.matchId,
            personId: a.personId,
            role: a.role,
            position: a.position,
          })),
          ...(replaceMatchIds ? { replaceMatchIds } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al aplicar la propuesta')
      }

      const { applied, failed, removed } = await res.json()
      clearAllProposals()
      fetchMatches()

      if (failed === 0) {
        toast.success(
          removed > 0
            ? `${applied} asignaciones aplicadas correctamente (${removed} reemplazadas)`
            : `${applied} asignaciones aplicadas correctamente`,
        )
      } else {
        toast.warning(`${applied} aplicadas, ${failed} fallidas`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al aplicar la propuesta')
    } finally {
      setApplying(false)
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
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
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
              position: a.position,
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

  // Candidatos del hueco activo: los calcula el servidor (/api/admin/picker →
  // lib/candidate-picker.ts). Antes se construían aquí, lo que exigía importar
  // mockPersons + isPersonAvailable + hasTimeOverlap de mock-data y arrastraba el
  // seed de partidos (~10 MB) al bundle de cliente; además `mockAvailabilities` se
  // genera a partir de las fechas de TODOS los partidos, así que el cliente pagaba
  // también generar la disponibilidad de temporada de 1.279 personas al arrancar.
  // Depende de `matches` para que la carga por persona se refresque tras asignar.
  useEffect(() => {
    if (!activeSlot) {
      setPickerPersons([])
      return
    }
    const params = new URLSearchParams({ matchId: activeSlot.matchId, role: activeSlot.role })
    if (activeSlot.position) params.set('position', activeSlot.position)

    let cancelled = false
    setPickerLoading(true)
    fetch(`/api/admin/picker?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPickerPersons(data.candidates ?? [])
      })
      .catch(() => {
        if (!cancelled) setPickerPersons([])
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeSlot, matches])

  // Get proposed assignments for a specific match slot from the active proposal
  const getProposedForSlot = (
    matchId: string,
    role: 'arbitro' | 'anotador',
  ): ProposedAssignment[] => {
    if (optimizationState !== 'done' || !showDiff || !activeProposal) return []
    return proposedAssignments.filter((a) => a.matchId === matchId && a.role === role && a.isNew)
  }

  const totalMatches = filteredMatches.length
  const coveredMatches = filteredMatches.filter((m) => m.isCovered).length
  // Pendientes de publicar: se derivan del estado `matches` (datos reales del
  // servidor vía fetchMatches), NO del `mockDesignations` importado, que en el
  // cliente es la copia estática del seed y nunca refleja lo que se ha aplicado
  // → si no, "Publicar designaciones" quedaría siempre deshabilitado.
  // Memoizado: `matches.flatMap` recorre todas las designaciones, y esta lista
  // alimenta tanto los contadores de abajo como el cálculo de conflictos (E2); sin
  // memo se recalcularía en cada render (p. ej. al mover un slider del solver).
  const allDesignations = useMemo(() => matches.flatMap((m) => m.designations), [matches])
  const pendingDesigs = allDesignations.filter((d) => d.status === 'pending').length
  const personsToNotify = new Set(
    allDesignations.filter((d) => d.status === 'pending').map((d) => d.personId),
  ).size

  // Conflictos de horario para el panel de verificación pre-publicación (E2, Tanda 2).
  // Todo se resuelve desde el estado `matches` (datos del servidor): partidos, municipio
  // del pabellón y persona vienen ya enriquecidos en la respuesta de la API, y las
  // distancias del catálogo (`distanceKm`). Antes personas y distancias salían de
  // mock-data, que arrastra el seed de partidos al bundle de cliente.
  const conflicts = useMemo<ScheduleConflict[]>(() => {
    const matchById = new Map(matches.map((m) => [m.id, m]))
    const muniByVenue = new Map<string, string>()
    const personById = new Map<string, NonNullable<(typeof allDesignations)[number]['person']>>()
    for (const m of matches) {
      if (m.venue?.municipalityId) muniByVenue.set(m.venueId, m.venue.municipalityId)
      for (const d of m.designations) {
        if (d.person) personById.set(d.personId, d.person)
      }
    }
    const helpers: PublishConflictHelpers = {
      getMatch: (matchId) => {
        const match = matchById.get(matchId)
        return match ? { date: match.date, time: match.time, venueId: match.venueId } : undefined
      },
      getVenueMunicipality: (venueId) => muniByVenue.get(venueId),
      getPerson: (personId) => {
        const person = personById.get(personId)
        return person
          ? {
              name: person.name,
              nick: person.nick,
              hasCar: person.hasCar,
              municipalityId: person.municipalityId,
            }
          : undefined
      },
      getDistanceKm: distanceKm,
    }
    return getPublishConflicts(allDesignations, helpers)
  }, [matches, allDesignations, distanceKm])

  // Etiquetas legibles ("Local vs Visitante (hora)") para los partidos citados en las
  // filas de conflicto del diálogo de publicación.
  const conflictMatchLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const m of matches) labels[m.id] = `${m.homeTeam} vs ${m.awayTeam} (${m.time})`
    return labels
  }, [matches])

  const sorted = [...filteredMatches].sort((a, b) => {
    const dc = a.date.localeCompare(b.date)
    return dc !== 0 ? dc : a.time.localeCompare(b.time)
  })

  return (
    <TooltipProvider>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Designar</h1>
            <p className="mt-1 text-sm text-gray-500">
              Designación manual y automática de árbitros y anotadores.
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

        {/* Rango de fechas */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500" htmlFor="asignacion-date-from">
              Desde
            </label>
            <input
              id="asignacion-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500" htmlFor="asignacion-date-to">
              Hasta
            </label>
            <input
              id="asignacion-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {totalMatches} partido{totalMatches !== 1 ? 's' : ''} en el rango
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
          >
            Toda la temporada
          </Button>
        </div>

        {/* Filtro por categoría (multi-selección) */}
        {categoryOptions.length > 0 && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">Categorías a designar</label>
              {selectedCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="hover:text-fbm-orange text-xs font-medium text-gray-400"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((opt) => {
                const active = selectedCategories.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleCategory(opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-fbm-orange bg-fbm-orange text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {selectedCategories.length === 0
                ? 'Todas las categorías: la asignación automática cubrirá todos los partidos del rango.'
                : `La asignación automática solo cubrirá los partidos de ${selectedCategories.length} categoría${selectedCategories.length !== 1 ? 's' : ''} seleccionada${selectedCategories.length !== 1 ? 's' : ''}.`}
            </p>
          </div>
        )}

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
                // Slots nombrados: puede ser más largo que needed si hay
                // designaciones sobrantes (datos raros) — se itera el array
                // devuelto, nunca Array.from({length: needed}).
                const refSlots = mapDesignationsToSlots(refDesigs, 'arbitro', match.refereesNeeded)
                const scorerSlots = mapDesignationsToSlots(
                  scorerDesigs,
                  'anotador',
                  match.scorersNeeded,
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
                          {refSlots.map((existingDesig, i) => {
                            const slotPosition = positionForSlot('arbitro', i)
                            const emptyOrdinal = existingDesig
                              ? -1
                              : refSlots.slice(0, i).filter((d) => !d).length
                            const proposedForSlot =
                              !existingDesig && proposedRefs.length > emptyOrdinal
                                ? proposedRefs[emptyOrdinal]
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
                                        activeSlot?.position === slotPosition
                                      }
                                      onActivate={() =>
                                        setActiveSlot({
                                          matchId: match.id,
                                          role: 'arbitro',
                                          position: slotPosition,
                                        })
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
                          {scorerSlots.map((existingDesig, i) => {
                            const slotPosition = positionForSlot('anotador', i)
                            const emptyOrdinal = existingDesig
                              ? -1
                              : scorerSlots.slice(0, i).filter((d) => !d).length
                            const proposedForSlot =
                              !existingDesig && proposedScorers.length > emptyOrdinal
                                ? proposedScorers[emptyOrdinal]
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
                                        activeSlot?.position === slotPosition
                                      }
                                      onActivate={() =>
                                        setActiveSlot({
                                          matchId: match.id,
                                          role: 'anotador',
                                          position: slotPosition,
                                        })
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
                persons={pickerPersons}
                loading={pickerLoading}
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
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {lastSavedAt
                  ? `Guardado ✓ ${lastSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Se guarda automáticamente al asignar'}
              </span>
              <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar
              </Button>
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
          conflicts={conflicts}
          matchLabels={conflictMatchLabels}
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
