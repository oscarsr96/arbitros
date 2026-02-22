// Motor de asignacion greedy con restricciones
// Primera version: heuristico TS para ~10-50 partidos
// Produccion: microservicio Python con OR-Tools para ~1000 partidos

import type {
  EnrichedMatch,
  EnrichedPerson,
  SolverInput,
  SolverOutput,
  ProposedAssignment,
  UnassignedSlot,
  SolverMetrics,
} from './types'
import {
  mockAvailabilities,
  mockIncompatibilities,
  mockDesignations,
  mockMatches,
  getMockDistance,
  getMockMunicipality,
} from './mock-data'

// ── PRNG con seed (Mulberry32) ────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWithSeed<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ── Jerarquia de categorias ─────────────────────────────────────────────────

const CATEGORY_RANK: Record<string, number> = {
  provincial: 1,
  autonomico: 2,
  nacional: 3,
  feb: 4,
}

// ── Helpers de fecha ────────────────────────────────────────────────────────

function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Helpers de restricciones ────────────────────────────────────────────────

function isAvailable(personId: string, date: string, time: string): boolean {
  const d = new Date(date + 'T00:00:00')
  const jsDay = d.getDay()
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

  // Get week start using local time (not UTC via toISOString)
  const dateObj = new Date(date + 'T00:00:00')
  const dateDayOfWeek = dateObj.getDay()
  const diff = dateObj.getDate() - dateDayOfWeek + (dateDayOfWeek === 0 ? -6 : 1)
  dateObj.setDate(diff)
  const weekStartStr = formatLocalDate(dateObj)

  const avails = mockAvailabilities.filter(
    (a) => a.personId === personId && a.weekStart === weekStartStr && a.dayOfWeek === dayOfWeek,
  )

  const matchHour = parseInt(time.split(':')[0])
  return avails.some((a) => {
    const availStart = parseInt(a.startTime.split(':')[0])
    const availEnd = parseInt(a.endTime.split(':')[0])
    return matchHour >= availStart && matchHour < availEnd
  })
}

function meetsMinCategory(personCategory: string | null, requiredCategory: string): boolean {
  if (!personCategory) return false
  return (CATEGORY_RANK[personCategory] ?? 0) >= (CATEGORY_RANK[requiredCategory] ?? 0)
}

function hasIncompatibility(personId: string, homeTeam: string, awayTeam: string): boolean {
  const incomps = mockIncompatibilities.filter((i) => i.personId === personId)
  return incomps.some(
    (inc) =>
      homeTeam.toLowerCase().includes(inc.teamName.toLowerCase()) ||
      awayTeam.toLowerCase().includes(inc.teamName.toLowerCase()),
  )
}

function calculateTravelCost(
  personMuniId: string,
  venueMuniId: string,
): { cost: number; km: number } {
  if (personMuniId === venueMuniId) {
    return { cost: 3.0, km: 0 }
  }
  const km = getMockDistance(personMuniId, venueMuniId)
  return { cost: Number((km * 0.1).toFixed(2)), km }
}

// ── Estructura interna para tracking de asignaciones durante la resolucion ──

interface Assignment {
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  date: string
  time: string
}

function hasTimeOverlapWith(
  personId: string,
  matchDate: string,
  matchTime: string,
  currentAssignments: Assignment[],
  existingDesignations: typeof mockDesignations,
): boolean {
  const targetHour = parseInt(matchTime.split(':')[0])

  // Comprobar contra asignaciones ya propuestas en esta ejecucion
  for (const a of currentAssignments) {
    if (a.personId !== personId) continue
    if (a.date !== matchDate) continue
    const otherHour = parseInt(a.time.split(':')[0])
    if (Math.abs(targetHour - otherHour) < 2) return true
  }

  // Comprobar contra designaciones existentes en la BD (mock)
  for (const d of existingDesignations) {
    if (d.personId !== personId || d.status === 'rejected') continue
    const match = getMockMatchLocal(d.matchId)
    if (!match || match.date !== matchDate) continue
    const otherHour = parseInt(match.time.split(':')[0])
    if (Math.abs(targetHour - otherHour) < 2) return true
  }

  return false
}

function getMockMatchLocal(matchId: string) {
  return mockMatches.find((m) => m.id === matchId)
}

// ── Solver principal ────────────────────────────────────────────────────────

export function solve(input: SolverInput, seed?: number): SolverOutput {
  const startTime = performance.now()
  const { matches, persons, parameters } = input
  const { costWeight, balanceWeight, maxMatchesPerPerson, forceExisting } = parameters
  const rng = seed !== undefined ? mulberry32(seed) : null

  const assignments: ProposedAssignment[] = []
  const unassigned: UnassignedSlot[] = []
  const currentAssignments: Assignment[] = []

  // Contar partidos asignados por persona (incluye existentes)
  const personLoadCount: Record<string, number> = {}
  for (const p of persons) {
    personLoadCount[p.id] = 0
  }

  // Cargar designaciones existentes como asignaciones ya hechas
  const existingByMatch: Record<string, { personId: string; role: string }[]> = {}
  for (const d of mockDesignations) {
    if (d.status === 'rejected') continue
    if (!existingByMatch[d.matchId]) existingByMatch[d.matchId] = []
    existingByMatch[d.matchId].push({ personId: d.personId, role: d.role })
    if (personLoadCount[d.personId] !== undefined) {
      personLoadCount[d.personId]++
    }
    // Registrar en currentAssignments para control de solapamiento
    const m = matches.find((m) => m.id === d.matchId)
    if (m) {
      currentAssignments.push({
        matchId: d.matchId,
        personId: d.personId,
        role: d.role,
        date: m.date,
        time: m.time,
      })
    }
  }

  // Si forceExisting, marcar asignaciones existentes como propuestas (isNew=false)
  if (forceExisting) {
    for (const match of matches) {
      const existing = existingByMatch[match.id] ?? []
      for (const e of existing) {
        const person = persons.find((p) => p.id === e.personId)
        if (!person) continue
        const venueMuni = match.venue?.municipalityId ?? ''
        const { cost, km } = calculateTravelCost(person.municipalityId, venueMuni)
        const municipality = getMockMunicipality(person.municipalityId)
        assignments.push({
          matchId: match.id,
          personId: person.id,
          personName: person.name,
          role: e.role as 'arbitro' | 'anotador',
          travelCost: cost,
          distanceKm: km,
          isNew: false,
          municipalityName: municipality?.name ?? '',
        })
      }
    }
  }

  // Ordenar partidos por prioridad:
  // 1. Sin asignaciones primero
  // 2. Mayor categoria requerida primero
  // Con seed: shuffle parcial para generar variacion entre ejecuciones
  const baseSorted = [...matches].sort((a, b) => {
    const aExisting = (existingByMatch[a.id] ?? []).length
    const bExisting = (existingByMatch[b.id] ?? []).length
    if (aExisting !== bExisting) return aExisting - bExisting

    const aCatRank = CATEGORY_RANK[a.competition?.minRefCategory ?? 'provincial'] ?? 0
    const bCatRank = CATEGORY_RANK[b.competition?.minRefCategory ?? 'provincial'] ?? 0
    return bCatRank - aCatRank
  })

  // Con seed, hacer un shuffle parcial dentro de grupos con misma prioridad
  const sortedMatches = rng ? shuffleWithinGroups(baseSorted, existingByMatch, rng) : baseSorted

  // Pasar rng a findBestCandidate para seleccion con variacion
  // Para cada partido, para cada slot vacio
  for (const match of sortedMatches) {
    const existing = existingByMatch[match.id] ?? []
    const venueMuni = match.venue?.municipalityId ?? ''

    // Slots de arbitros
    const existingRefs = existing.filter((e) => e.role === 'arbitro')
    const refsNeeded = match.refereesNeeded - (forceExisting ? existingRefs.length : 0)

    for (let i = 0; i < refsNeeded; i++) {
      const slotIndex = forceExisting ? existingRefs.length + i : i
      const candidate = findBestCandidate(
        match,
        'arbitro',
        venueMuni,
        persons,
        currentAssignments,
        personLoadCount,
        maxMatchesPerPerson,
        costWeight,
        balanceWeight,
        assignments,
        rng,
      )

      if (candidate) {
        const municipality = getMockMunicipality(candidate.person.municipalityId)
        const proposed: ProposedAssignment = {
          matchId: match.id,
          personId: candidate.person.id,
          personName: candidate.person.name,
          role: 'arbitro',
          travelCost: candidate.cost,
          distanceKm: candidate.km,
          isNew: true,
          municipalityName: municipality?.name ?? '',
        }
        assignments.push(proposed)
        currentAssignments.push({
          matchId: match.id,
          personId: candidate.person.id,
          role: 'arbitro',
          date: match.date,
          time: match.time,
        })
        personLoadCount[candidate.person.id] = (personLoadCount[candidate.person.id] ?? 0) + 1
      } else {
        unassigned.push({
          matchId: match.id,
          matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
          role: 'arbitro',
          slotIndex,
          reason: getUnassignedReason(
            match,
            'arbitro',
            persons,
            currentAssignments,
            personLoadCount,
            maxMatchesPerPerson,
            assignments,
          ),
        })
      }
    }

    // Slots de anotadores
    const existingScorers = existing.filter((e) => e.role === 'anotador')
    const scorersNeeded = match.scorersNeeded - (forceExisting ? existingScorers.length : 0)

    for (let i = 0; i < scorersNeeded; i++) {
      const slotIndex = forceExisting ? existingScorers.length + i : i
      const candidate = findBestCandidate(
        match,
        'anotador',
        venueMuni,
        persons,
        currentAssignments,
        personLoadCount,
        maxMatchesPerPerson,
        costWeight,
        balanceWeight,
        assignments,
        rng,
      )

      if (candidate) {
        const municipality = getMockMunicipality(candidate.person.municipalityId)
        const proposed: ProposedAssignment = {
          matchId: match.id,
          personId: candidate.person.id,
          personName: candidate.person.name,
          role: 'anotador',
          travelCost: candidate.cost,
          distanceKm: candidate.km,
          isNew: true,
          municipalityName: municipality?.name ?? '',
        }
        assignments.push(proposed)
        currentAssignments.push({
          matchId: match.id,
          personId: candidate.person.id,
          role: 'anotador',
          date: match.date,
          time: match.time,
        })
        personLoadCount[candidate.person.id] = (personLoadCount[candidate.person.id] ?? 0) + 1
      } else {
        unassigned.push({
          matchId: match.id,
          matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
          role: 'anotador',
          slotIndex,
          reason: getUnassignedReason(
            match,
            'anotador',
            persons,
            currentAssignments,
            personLoadCount,
            maxMatchesPerPerson,
            assignments,
          ),
        })
      }
    }
  }

  const endTime = performance.now()
  const newAssignments = assignments.filter((a) => a.isNew)
  const totalSlots = matches.reduce((sum, m) => sum + m.refereesNeeded + m.scorersNeeded, 0)
  const coveredSlots = totalSlots - unassigned.length

  const metrics: SolverMetrics = {
    totalCost: Number(newAssignments.reduce((sum, a) => sum + a.travelCost, 0).toFixed(2)),
    coverage: totalSlots > 0 ? Number(((coveredSlots / totalSlots) * 100).toFixed(1)) : 100,
    coveredSlots,
    totalSlots,
    resolutionTimeMs: Math.round(endTime - startTime),
  }

  let status: SolverOutput['status']
  if (unassigned.length === 0) {
    status = 'optimal'
  } else if (newAssignments.length > 0) {
    status = 'partial'
  } else {
    status = 'no_solution'
  }

  return { status, assignments, metrics, unassigned }
}

// ── Buscar mejor candidato para un slot ─────────────────────────────────────

function findBestCandidate(
  match: EnrichedMatch,
  role: 'arbitro' | 'anotador',
  venueMuniId: string,
  persons: EnrichedPerson[],
  currentAssignments: Assignment[],
  personLoadCount: Record<string, number>,
  maxMatchesPerPerson: number,
  costWeight: number,
  balanceWeight: number,
  proposedAssignments: ProposedAssignment[],
  rng: (() => number) | null = null,
): { person: EnrichedPerson; cost: number; km: number } | null {
  const candidates: { person: EnrichedPerson; cost: number; km: number; score: number }[] = []

  // Encontrar max carga para normalizar
  const maxLoad = Math.max(1, ...Object.values(personLoadCount))

  for (const person of persons) {
    // Filtrar por rol
    if (person.role !== role) continue
    if (!person.active) continue

    // Ya asignado a este partido?
    const alreadyAssigned = proposedAssignments.some(
      (a) => a.matchId === match.id && a.personId === person.id,
    )
    if (alreadyAssigned) continue

    // Carga maxima
    const currentLoad = personLoadCount[person.id] ?? 0
    if (currentLoad >= maxMatchesPerPerson) continue

    // Disponibilidad
    if (!isAvailable(person.id, match.date, match.time)) continue

    // Solapamiento temporal
    if (hasTimeOverlapWith(person.id, match.date, match.time, currentAssignments, mockDesignations))
      continue

    // Categoria minima (solo arbitros)
    if (role === 'arbitro' && match.competition?.minRefCategory) {
      if (!meetsMinCategory(person.category, match.competition.minRefCategory)) continue
    }

    // Incompatibilidades
    if (hasIncompatibility(person.id, match.homeTeam, match.awayTeam)) continue

    // Calcular coste y score
    const { cost, km } = calculateTravelCost(person.municipalityId, venueMuniId)
    const normalizedCost = cost / 10 // normalizar a rango ~0-1
    const normalizedLoad = currentLoad / maxLoad

    const score = costWeight * normalizedCost + balanceWeight * normalizedLoad
    candidates.push({ person, cost, km, score })
  }

  if (candidates.length === 0) return null

  // Ordenar por score (menor = mejor)
  candidates.sort((a, b) => a.score - b.score)

  // Con rng: seleccionar aleatoriamente entre candidatos dentro de un umbral del 5%
  if (rng && candidates.length > 1) {
    const threshold = candidates[0].score * 1.05
    const topCandidates = candidates.filter((c) => c.score <= threshold)
    const idx = Math.floor(rng() * topCandidates.length)
    return topCandidates[idx]
  }

  return candidates[0]
}

// ── Shuffle parcial dentro de grupos de misma prioridad ─────────────────────

function shuffleWithinGroups(
  sorted: EnrichedMatch[],
  existingByMatch: Record<string, { personId: string; role: string }[]>,
  rng: () => number,
): EnrichedMatch[] {
  // Agrupar partidos con mismo "nivel de prioridad" (misma cant. de existentes + misma cat)
  const result: EnrichedMatch[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    const aExisting = (existingByMatch[sorted[i].id] ?? []).length
    const aCat = CATEGORY_RANK[sorted[i].competition?.minRefCategory ?? 'provincial'] ?? 0
    while (j < sorted.length) {
      const bExisting = (existingByMatch[sorted[j].id] ?? []).length
      const bCat = CATEGORY_RANK[sorted[j].competition?.minRefCategory ?? 'provincial'] ?? 0
      if (aExisting !== bExisting || aCat !== bCat) break
      j++
    }
    // Shuffle the group [i, j)
    const group = shuffleWithSeed(sorted.slice(i, j), rng)
    result.push(...group)
    i = j
  }
  return result
}

// ── Diagnostico de por que un slot no se puede cubrir ───────────────────────

function getUnassignedReason(
  match: EnrichedMatch,
  role: 'arbitro' | 'anotador',
  persons: EnrichedPerson[],
  currentAssignments: Assignment[],
  personLoadCount: Record<string, number>,
  maxMatchesPerPerson: number,
  proposedAssignments: ProposedAssignment[],
): string {
  const candidatesOfRole = persons.filter((p) => p.role === role && p.active)
  if (candidatesOfRole.length === 0)
    return `No hay ${role === 'arbitro' ? 'árbitros' : 'anotadores'} activos`

  let noAvailability = 0
  let overlap = 0
  let categoryInsufficient = 0
  let incompatible = 0
  let maxLoad = 0
  let alreadyAssigned = 0

  for (const person of candidatesOfRole) {
    if (proposedAssignments.some((a) => a.matchId === match.id && a.personId === person.id)) {
      alreadyAssigned++
      continue
    }
    if ((personLoadCount[person.id] ?? 0) >= maxMatchesPerPerson) {
      maxLoad++
      continue
    }
    if (!isAvailable(person.id, match.date, match.time)) {
      noAvailability++
      continue
    }
    if (
      hasTimeOverlapWith(person.id, match.date, match.time, currentAssignments, mockDesignations)
    ) {
      overlap++
      continue
    }
    if (
      role === 'arbitro' &&
      match.competition?.minRefCategory &&
      !meetsMinCategory(person.category, match.competition.minRefCategory)
    ) {
      categoryInsufficient++
      continue
    }
    if (hasIncompatibility(person.id, match.homeTeam, match.awayTeam)) {
      incompatible++
      continue
    }
  }

  const reasons: string[] = []
  if (noAvailability > 0) reasons.push(`${noAvailability} sin disponibilidad`)
  if (overlap > 0) reasons.push(`${overlap} con solapamiento`)
  if (categoryInsufficient > 0) reasons.push(`${categoryInsufficient} categoría insuficiente`)
  if (incompatible > 0) reasons.push(`${incompatible} incompatible`)
  if (maxLoad > 0) reasons.push(`${maxLoad} con carga máxima`)
  if (alreadyAssigned > 0) reasons.push(`${alreadyAssigned} ya asignados`)

  return reasons.length > 0 ? reasons.join(', ') : 'Sin candidatos válidos'
}

// ── Re-optimizacion parcial ─────────────────────────────────────────────────
// Solo busca candidatos para un slot especifico respetando restricciones

export function solvePartial(
  match: EnrichedMatch,
  role: 'arbitro' | 'anotador',
  slotIndex: number,
  matches: EnrichedMatch[],
  persons: EnrichedPerson[],
  parameters: { costWeight: number; balanceWeight: number; maxMatchesPerPerson: number },
): SolverOutput {
  const startTime = performance.now()
  const venueMuni = match.venue?.municipalityId ?? ''

  // Construir estado actual de asignaciones
  const currentAssignments: Assignment[] = []
  const personLoadCount: Record<string, number> = {}
  for (const p of persons) personLoadCount[p.id] = 0

  for (const d of mockDesignations) {
    if (d.status === 'rejected') continue
    const m = matches.find((m) => m.id === d.matchId)
    if (m) {
      currentAssignments.push({
        matchId: d.matchId,
        personId: d.personId,
        role: d.role,
        date: m.date,
        time: m.time,
      })
      if (personLoadCount[d.personId] !== undefined) personLoadCount[d.personId]++
    }
  }

  const proposedAssignments: ProposedAssignment[] = []
  const candidate = findBestCandidate(
    match,
    role,
    venueMuni,
    persons,
    currentAssignments,
    personLoadCount,
    parameters.maxMatchesPerPerson,
    parameters.costWeight,
    parameters.balanceWeight,
    proposedAssignments,
  )

  const endTime = performance.now()

  if (candidate) {
    const municipality = getMockMunicipality(candidate.person.municipalityId)
    return {
      status: 'optimal',
      assignments: [
        {
          matchId: match.id,
          personId: candidate.person.id,
          personName: candidate.person.name,
          role,
          travelCost: candidate.cost,
          distanceKm: candidate.km,
          isNew: true,
          municipalityName: municipality?.name ?? '',
        },
      ],
      metrics: {
        totalCost: candidate.cost,
        coverage: 100,
        coveredSlots: 1,
        totalSlots: 1,
        resolutionTimeMs: Math.round(endTime - startTime),
      },
      unassigned: [],
    }
  }

  return {
    status: 'no_solution',
    assignments: [],
    metrics: {
      totalCost: 0,
      coverage: 0,
      coveredSlots: 0,
      totalSlots: 1,
      resolutionTimeMs: Math.round(endTime - startTime),
    },
    unassigned: [
      {
        matchId: match.id,
        matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
        role,
        slotIndex,
        reason: getUnassignedReason(
          match,
          role,
          persons,
          currentAssignments,
          personLoadCount,
          parameters.maxMatchesPerPerson,
          proposedAssignments,
        ),
      },
    ],
  }
}
