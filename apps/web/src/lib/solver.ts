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
  mockIncompatibilities,
  mockDesignations,
  mockMatches,
  getMockDistance,
  getMockMunicipality,
  isPersonAvailable,
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

// ── Helpers de restricciones ────────────────────────────────────────────────
// Disponibilidad: delega en mock-data (misma lógica que el picker del portal/
// admin, comparación en minutos con intervalos semiabiertos). Antes este
// módulo duplicaba el cálculo con granularidad de HORAS ENTERAS (parseInt),
// lo que tenía un bug latente: una franja 15:30-22:00 daba disponible un
// partido a las 15:00.

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

// Micro-refactor de rendimiento: antes se recorrian TODOS los currentAssignments
// (array plano) y TODAS las mockDesignations por cada candidato evaluado — con
// 324 partidos x 1279 personas eso es cuadratico. Ahora ambas fuentes se indexan
// por personId UNA vez por resolucion (`buildAssignmentIndex`/`buildDesignationIndex`
// en `solve`/`solvePartial`) y aqui solo se recorre la lista (pequena, acotada por
// maxMatchesPerPerson) de ESA persona.
function hasTimeOverlapWith(
  personId: string,
  matchDate: string,
  matchTime: string,
  assignmentsByPerson: Map<string, Assignment[]>,
  designationsByPerson: Map<string, typeof mockDesignations>,
  matchesById: Map<string, { date: string; time: string }>,
): boolean {
  const targetHour = parseInt(matchTime.split(':')[0])

  // Comprobar contra asignaciones ya propuestas en esta ejecucion
  const current = assignmentsByPerson.get(personId)
  if (current) {
    for (const a of current) {
      if (a.date !== matchDate) continue
      const otherHour = parseInt(a.time.split(':')[0])
      if (Math.abs(targetHour - otherHour) < 2) return true
    }
  }

  // Comprobar contra designaciones existentes en la BD (mock)
  const existing = designationsByPerson.get(personId)
  if (existing) {
    for (const d of existing) {
      const match = matchesById.get(d.matchId)
      if (!match || match.date !== matchDate) continue
      const otherHour = parseInt(match.time.split(':')[0])
      if (Math.abs(targetHour - otherHour) < 2) return true
    }
  }

  return false
}

function buildDesignationIndex(
  designations: typeof mockDesignations,
): Map<string, typeof mockDesignations> {
  const index = new Map<string, typeof mockDesignations>()
  for (const d of designations) {
    const list = index.get(d.personId)
    if (list) list.push(d)
    else index.set(d.personId, [d])
  }
  return index
}

function addAssignment(index: Map<string, Assignment[]>, assignment: Assignment): void {
  const list = index.get(assignment.personId)
  if (list) list.push(assignment)
  else index.set(assignment.personId, [assignment])
}

// Indice matchId -> Set<personId> ya propuestos. Mismo motivo que el resto de
// indices: "¿esta persona ya asignada a este partido?" se preguntaba antes con
// proposedAssignments.some(...), un escaneo del array COMPLETO de asignaciones
// (crece hasta ~totalSlots) por cada candidato evaluado — con el roster
// completo (1279 personas x 324 partidos) eso dominaba el tiempo de resolucion.
function markAssigned(index: Map<string, Set<string>>, matchId: string, personId: string): void {
  const set = index.get(matchId)
  if (set) set.add(personId)
  else index.set(matchId, new Set([personId]))
}

// ── Solver principal ────────────────────────────────────────────────────────

export function solve(input: SolverInput, seed?: number): SolverOutput {
  const startTime = performance.now()
  const { matches, persons, parameters } = input
  const { costWeight, balanceWeight, maxMatchesPerPerson, forceExisting } = parameters
  // findBestCandidate recorre esta lista para CADA slot (hasta ~1000 con el
  // roster completo): pre-filtrar por rol una vez evita iterar los ~1279
  // completos (arbitros+anotadores) cuando solo un rol es relevante por slot.
  const referees = persons.filter((p) => p.role === 'arbitro')
  const scorers = persons.filter((p) => p.role === 'anotador')
  const rng = seed !== undefined ? mulberry32(seed) : null

  const assignments: ProposedAssignment[] = []
  const unassigned: UnassignedSlot[] = []
  // Indices por personId (ver comentario sobre hasTimeOverlapWith): evitan
  // recorrer arrays completos por cada candidato evaluado.
  const assignmentsByPerson = new Map<string, Assignment[]>()
  const designationsByPerson = buildDesignationIndex(mockDesignations)
  const matchesById = new Map(mockMatches.map((m) => [m.id, { date: m.date, time: m.time }]))
  const assignedPersonsByMatch = new Map<string, Set<string>>()

  // Contar partidos asignados por persona (incluye existentes)
  const personLoadCount: Record<string, number> = {}
  for (const p of persons) {
    personLoadCount[p.id] = 0
  }

  // La carga cuenta SOLO las designaciones dentro del conjunto de partidos acotado
  // (rango/jornada activo, o el único partido en modo partial), no toda la temporada.
  // Regla FBM / CLAUDE.md restricción 7: la carga máxima es POR JORNADA; contarla global
  // excluiría de por vida a quien pite el máximo en una jornada al designar la siguiente.
  const inScopeMatchIds = new Set(matches.map((m) => m.id))

  // Cargar designaciones existentes como asignaciones ya hechas
  const existingByMatch: Record<string, { personId: string; role: string }[]> = {}
  for (const d of mockDesignations) {
    if (!existingByMatch[d.matchId]) existingByMatch[d.matchId] = []
    existingByMatch[d.matchId].push({ personId: d.personId, role: d.role })
    if (personLoadCount[d.personId] !== undefined && inScopeMatchIds.has(d.matchId)) {
      personLoadCount[d.personId]++
    }
    // Registrar en assignmentsByPerson para control de solapamiento
    const m = matches.find((m) => m.id === d.matchId)
    if (m) {
      addAssignment(assignmentsByPerson, {
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
        markAssigned(assignedPersonsByMatch, match.id, person.id)
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
        referees,
        assignmentsByPerson,
        designationsByPerson,
        matchesById,
        personLoadCount,
        maxMatchesPerPerson,
        costWeight,
        balanceWeight,
        assignedPersonsByMatch,
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
        addAssignment(assignmentsByPerson, {
          matchId: match.id,
          personId: candidate.person.id,
          role: 'arbitro',
          date: match.date,
          time: match.time,
        })
        markAssigned(assignedPersonsByMatch, match.id, candidate.person.id)
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
            referees,
            assignmentsByPerson,
            designationsByPerson,
            matchesById,
            personLoadCount,
            maxMatchesPerPerson,
            assignedPersonsByMatch,
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
        scorers,
        assignmentsByPerson,
        designationsByPerson,
        matchesById,
        personLoadCount,
        maxMatchesPerPerson,
        costWeight,
        balanceWeight,
        assignedPersonsByMatch,
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
        addAssignment(assignmentsByPerson, {
          matchId: match.id,
          personId: candidate.person.id,
          role: 'anotador',
          date: match.date,
          time: match.time,
        })
        markAssigned(assignedPersonsByMatch, match.id, candidate.person.id)
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
            scorers,
            assignmentsByPerson,
            designationsByPerson,
            matchesById,
            personLoadCount,
            maxMatchesPerPerson,
            assignedPersonsByMatch,
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
  assignmentsByPerson: Map<string, Assignment[]>,
  designationsByPerson: Map<string, typeof mockDesignations>,
  matchesById: Map<string, { date: string; time: string }>,
  personLoadCount: Record<string, number>,
  maxMatchesPerPerson: number,
  costWeight: number,
  balanceWeight: number,
  assignedPersonsByMatch: Map<string, Set<string>>,
  rng: (() => number) | null = null,
): { person: EnrichedPerson; cost: number; km: number } | null {
  const candidates: { person: EnrichedPerson; cost: number; km: number; score: number }[] = []

  // Encontrar max carga para normalizar. Bucle plano en vez de
  // Math.max(1, ...Object.values(...)): esto se llama una vez POR SLOT (hasta
  // ~1000 con el roster completo) sobre un Record de hasta 1279 entradas — el
  // spread de argumentos de Math.max es notablemente más lento a este tamaño.
  let maxLoad = 1
  for (const key in personLoadCount) {
    if (personLoadCount[key] > maxLoad) maxLoad = personLoadCount[key]
  }

  for (const person of persons) {
    // Filtrar por rol
    if (person.role !== role) continue
    if (!person.active) continue

    // Ya asignado a este partido?
    if (assignedPersonsByMatch.get(match.id)?.has(person.id)) continue

    // Carga maxima
    const currentLoad = personLoadCount[person.id] ?? 0
    if (currentLoad >= maxMatchesPerPerson) continue

    // Disponibilidad (misma lógica minutos/semiabierto que el picker del portal/admin)
    if (!isPersonAvailable(person.id, match.date, match.time)) continue

    // Solapamiento temporal
    if (
      hasTimeOverlapWith(
        person.id,
        match.date,
        match.time,
        assignmentsByPerson,
        designationsByPerson,
        matchesById,
      )
    )
      continue

    // Categoria minima (solo arbitros)
    if (role === 'arbitro' && match.competition?.minRefCategory) {
      if (!meetsMinCategory(person.category, match.competition.minRefCategory)) continue
    }

    // Incompatibilidades
    if (hasIncompatibility(person.id, match.homeTeam, match.awayTeam)) continue

    // Calcular coste y score
    const { cost, km } = calculateTravelCost(person.municipalityId, venueMuniId)

    // Hard constraint: sin coche y >30km → descartado
    if (!person.hasCar && km > 30) continue

    let normalizedCost = cost / 10 // normalizar a rango ~0-1
    if (!person.hasCar && km > 15) {
      normalizedCost *= 2.0
    }
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
  assignmentsByPerson: Map<string, Assignment[]>,
  designationsByPerson: Map<string, typeof mockDesignations>,
  matchesById: Map<string, { date: string; time: string }>,
  personLoadCount: Record<string, number>,
  maxMatchesPerPerson: number,
  assignedPersonsByMatch: Map<string, Set<string>>,
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
  let noCarTooFar = 0

  for (const person of candidatesOfRole) {
    if (assignedPersonsByMatch.get(match.id)?.has(person.id)) {
      alreadyAssigned++
      continue
    }
    if ((personLoadCount[person.id] ?? 0) >= maxMatchesPerPerson) {
      maxLoad++
      continue
    }
    if (!isPersonAvailable(person.id, match.date, match.time)) {
      noAvailability++
      continue
    }
    if (
      hasTimeOverlapWith(
        person.id,
        match.date,
        match.time,
        assignmentsByPerson,
        designationsByPerson,
        matchesById,
      )
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

    // Comprobar hard constraint coche para diagnóstico
    const venueMuni = match.venue?.municipalityId ?? ''
    const { km } = calculateTravelCost(person.municipalityId, venueMuni)
    if (!person.hasCar && km > 30) {
      noCarTooFar++
      continue
    }
  }

  const reasons: string[] = []
  if (noAvailability > 0) reasons.push(`${noAvailability} sin disponibilidad`)
  if (overlap > 0) reasons.push(`${overlap} con solapamiento`)
  if (categoryInsufficient > 0) reasons.push(`${categoryInsufficient} categoría insuficiente`)
  if (incompatible > 0) reasons.push(`${incompatible} incompatible`)
  if (noCarTooFar > 0) reasons.push(`${noCarTooFar} sin coche (>30km)`)
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
  const assignmentsByPerson = new Map<string, Assignment[]>()
  const designationsByPerson = buildDesignationIndex(mockDesignations)
  const matchesById = new Map(mockMatches.map((m) => [m.id, { date: m.date, time: m.time }]))
  const personLoadCount: Record<string, number> = {}
  for (const p of persons) personLoadCount[p.id] = 0

  for (const d of mockDesignations) {
    const m = matches.find((m) => m.id === d.matchId)
    if (m) {
      addAssignment(assignmentsByPerson, {
        matchId: d.matchId,
        personId: d.personId,
        role: d.role,
        date: m.date,
        time: m.time,
      })
      if (personLoadCount[d.personId] !== undefined) personLoadCount[d.personId]++
    }
  }

  // solvePartial evalúa un único slot: no hay asignaciones propuestas previas
  // en esta misma resolución (mapa vacío, misma semántica que el array vacío
  // que sustituye).
  const assignedPersonsByMatch = new Map<string, Set<string>>()
  const candidate = findBestCandidate(
    match,
    role,
    venueMuni,
    persons,
    assignmentsByPerson,
    designationsByPerson,
    matchesById,
    personLoadCount,
    parameters.maxMatchesPerPerson,
    parameters.costWeight,
    parameters.balanceWeight,
    assignedPersonsByMatch,
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
          assignmentsByPerson,
          designationsByPerson,
          matchesById,
          personLoadCount,
          parameters.maxMatchesPerPerson,
          assignedPersonsByMatch,
        ),
      },
    ],
  }
}
