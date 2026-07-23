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
  getMockVenue,
  isPersonAvailable,
  calculateDailyTravelCost,
} from './mock-data'
import { pairOverlap, timeToMinutes, isSolverConflict, type OverlapMatch } from './overlap'
import { roadKmBetween } from './geo-distance'
import {
  mapDesignationsToSlots,
  positionForSlot,
  type DesignationPosition,
} from './designation-positions'
import {
  checkSlotEligibility,
  eligibleRoles,
  isRefereeLevel,
  type CompetitionCategory,
  type EligibleRole,
} from './referee-eligibility'

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

// Prioridad por ESCASEZ de árbitros elegibles cuando el partido lleva categoría
// FINA (T4, tasks/todo-solver-7niveles.md): mayor = pool de principales más
// pequeño según ELIGIBILITY × REFEREE_LEVEL_DISTRIBUTION = se resuelve antes.
// `nacional` (solo 60 nivel nacional) y las `primera_aut_*` (solo 70 de 1ª aut)
// primero; las de escuela (cadete/infantil/minibasket, las pita casi todo el
// roster) al final. Los valores se solapan con el rango legacy 1-4 de
// CATEGORY_RANK para que una mezcla de partidos tagueados y sin taguear ordene
// de forma determinista.
const FINE_PRIORITY: Record<CompetitionCategory, number> = {
  nacional: 10,
  primera_aut_oro: 9,
  primera_aut_plata: 9,
  primera_aut_fem: 9,
  junior_especial_oro: 8,
  sub22_oro: 8,
  segunda_aut_oro: 7,
  junior_especial_plata: 6,
  junior_especial_bronce: 6,
  sub22_plata: 6,
  sub22_bronce: 6,
  segunda_aut_plata: 5,
  segunda_aut_bronce: 4,
  junior_pref: 3,
  cadete_pref: 2,
  infantil_pref: 2,
  minibasket: 1,
}

// Rango de prioridad de un partido en la ordenación (solve/shuffleWithinGroups):
// con `fineCategory` usa FINE_PRIORITY; sin ella, el ranking legacy por
// minRefCategory (idéntico al comportamiento previo a T4).
function matchPriorityRank(match: EnrichedMatch): number {
  const fine = match.competition?.fineCategory
  if (fine) return FINE_PRIORITY[fine] ?? 0
  return CATEGORY_RANK[match.competition?.minRefCategory ?? 'provincial'] ?? 0
}

// ── Helpers de restricciones ────────────────────────────────────────────────
// Disponibilidad: delega en mock-data (misma lógica que el picker del portal/
// admin, comparación en minutos con intervalos semiabiertos). Antes este
// módulo duplicaba el cálculo con granularidad de HORAS ENTERAS (parseInt),
// lo que tenía un bug latente: una franja 15:30-22:00 daba disponible un
// partido a las 15:00.

// El slot `principal`/`auxiliar` de árbitro coincide con los roles de la matriz
// de elegibilidad; las posiciones de mesa (anotador/crono/24") no aplican al
// check (checkSlotEligibility ya da true a anotadores).
function toEligibleRole(position?: DesignationPosition): EligibleRole | undefined {
  return position === 'principal' || position === 'auxiliar' ? position : undefined
}

// Distancia DIRECTA persona→pabellón en km: coords reales (roadKm = haversine
// ×1.3) cuando persona Y venue las tienen; si falta alguna, fallback a la
// matriz muni→muni (getMockDistance). Solo decide la feasibility del coche y
// el `distanceKm` reportado — el COSTE sigue siendo muni→muni (regla FBM,
// calculateDailyTravelCost).
function personVenueKm(
  person: EnrichedPerson,
  venue: EnrichedMatch['venue'],
  venueMuniId: string,
): number {
  return roadKmBetween(person, venue) ?? getMockDistance(person.municipalityId, venueMuniId)
}

// ¿El rechazo de elegibilidad vino del modelo FINO o del fallback legacy?
// Mismo criterio de activación que checkSlotEligibility: partido con
// fineCategory Y persona con refereeLevel reconocido.
function usesFineModel(
  person: { refereeLevel?: string | null },
  competition: { fineCategory?: CompetitionCategory | null } | undefined,
): boolean {
  return Boolean(competition?.fineCategory && isRefereeLevel(person.refereeLevel))
}

// Slots LIBRES de un partido para un rol, con su índice ABSOLUTO (el que hay
// que reportar en UnassignedSlot.slotIndex) y la posición nombrada que les
// corresponde. Reutiliza mapDesignationsToSlots (designation-positions.ts):
// las designaciones con `position` explícita reclaman SU slot y las legacy
// sin posición rellenan los huecos en orden de llegada — la MISMA regla que
// la UI de slots. Con forceExisting=false el llamador pasa `existing=[]` y
// todos los slots quedan libres en orden. El índice absoluto (no el ordinal
// entre libres) importa porque una designación existente puede reclamar una
// posición NO inicial (p. ej. solo el auxiliar): el próximo hueco libre es
// entonces el principal (índice 0), no "nº de existentes" (M2, review 7
// niveles). Posiciones más allá de las nombradas del rol (p. ej. un 3er
// árbitro) → position undefined, slotIndex sigue siendo el índice real.
function getFreeSlots(
  existing: { role: string; position?: DesignationPosition }[],
  role: 'arbitro' | 'anotador',
  needed: number,
): { slotIndex: number; position?: DesignationPosition }[] {
  const slots = mapDesignationsToSlots(existing, role, needed)
  const free: { slotIndex: number; position?: DesignationPosition }[] = []
  for (let i = 0; i < needed; i++) {
    if (slots[i] === undefined) free.push({ slotIndex: i, position: positionForSlot(role, i) })
  }
  return free
}

function hasIncompatibility(personId: string, homeTeam: string, awayTeam: string): boolean {
  const incomps = mockIncompatibilities.filter((i) => i.personId === personId)
  return incomps.some(
    (inc) =>
      homeTeam.toLowerCase().includes(inc.teamName.toLowerCase()) ||
      awayTeam.toLowerCase().includes(inc.teamName.toLowerCase()),
  )
}

// ── Estructura interna para tracking de asignaciones durante la resolucion ──

interface Assignment {
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  date: string
  time: string
  venueId: string
  venueMuniId: string
}

// Micro-refactor de rendimiento: antes se recorrian TODOS los currentAssignments
// (array plano) y TODAS las mockDesignations por cada candidato evaluado — con
// 324 partidos x 1279 personas eso es cuadratico. Ahora ambas fuentes se indexan
// por personId UNA vez por resolucion (`buildAssignmentIndex`/`buildDesignationIndex`
// en `solve`/`solvePartial`) y aqui solo se recorre la lista (pequena, acotada por
// maxMatchesPerPerson) de ESA persona.
// Chequeo de conflicto duro de horario para un candidato: delega en `pairOverlap`
// (lib/overlap.ts), la misma primitiva minutos + duración real + viaje estimado
// (estimateTravelMinutes) + hasCar que usa el panel de verificación pre-publicación
// (schedule-conflicts.ts). Antes este módulo duplicaba el cálculo con granularidad de
// HORAS ENTERAS (parseInt(time.split(':')[0]) y |horaA-horaB|<2), lo que ignoraba
// minutos, duración, pabellón y viaje: un partido justo encadenado en el mismo pabellón
// (14:00 y 15:30, duración 90min) se marcaba como solape, y un hueco insuficiente para
// viajar entre dos municipios distintos podía no detectarse. El solver es más
// conservador que el panel: usa `isSolverConflict` (mismo módulo), que exige un colchón
// adicional (CONFLICT_MARGIN_MIN) sobre el viaje estimado antes de dar un candidato por
// válido, salvo cuando ambos partidos son en el mismo pabellón.
function toOverlapMatch(
  m: { date: string; time: string; venueId: string },
  municipalityId: string,
): OverlapMatch {
  return { date: m.date, startMin: timeToMinutes(m.time), venueId: m.venueId, municipalityId }
}

// Índice matchId → OverlapMatch de TODOS los mockMatches, compartido por
// solve/solvePartial para resolver las designaciones existentes de una persona.
function buildOverlapMatchIndex(): Map<string, OverlapMatch> {
  return new Map(
    mockMatches.map((m) => [
      m.id,
      toOverlapMatch(m, getMockVenue(m.venueId)?.municipalityId ?? ''),
    ]),
  )
}

function hasScheduleConflict(
  personId: string,
  candidateMatch: OverlapMatch,
  hasCar: boolean,
  assignmentsByPerson: Map<string, Assignment[]>,
  designationsByPerson: Map<string, typeof mockDesignations>,
  matchesById: Map<string, OverlapMatch>,
): boolean {
  const ctx = { hasCar, getDistanceKm: getMockDistance }
  const conflictsWithOther = (other: OverlapMatch): boolean =>
    isSolverConflict(pairOverlap(candidateMatch, other, ctx))

  // Comprobar contra asignaciones ya propuestas en esta ejecucion
  const current = assignmentsByPerson.get(personId)
  if (current) {
    for (const a of current) {
      if (conflictsWithOther(toOverlapMatch(a, a.venueMuniId))) return true
    }
  }

  // Comprobar contra designaciones existentes en la BD (mock)
  const existing = designationsByPerson.get(personId)
  if (existing) {
    for (const d of existing) {
      const match = matchesById.get(d.matchId)
      if (!match) continue
      if (conflictsWithOther(match)) return true
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

// Coste MARGINAL de anadir `venueMuniId` a las asignaciones YA acumuladas de
// `personId` ese `date`. La regla FBM es por persona y dia (no por partido):
// delega en calculateDailyTravelCost (mock-data.ts, fuente de la verdad) y
// resta el coste del dia SIN este partido del coste CON el. El resultado es
// 0 cuando el partido no anade nada nuevo (mismo municipio away que otro ya
// contado ese dia, o partido en el municipio propio en un dia que ya sale
// fuera) y puede incluso ser negativo si anadir un desplazamiento sustituye
// un fijo de "dia 100% en casa" por un kilometraje menor.
function calculateMarginalTravelCost(
  assignmentsByPerson: Map<string, Assignment[]>,
  personId: string,
  homeMuniId: string,
  date: string,
  venueMuniId: string,
): number {
  const munisBefore = (assignmentsByPerson.get(personId) ?? [])
    .filter((a) => a.date === date)
    .map((a) => a.venueMuniId)
  const before = calculateDailyTravelCost(homeMuniId, munisBefore).cost
  const after = calculateDailyTravelCost(homeMuniId, [...munisBefore, venueMuniId]).cost
  return Number((after - before).toFixed(2))
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

// ── Preferencia soft de auxiliar titular (modelo fino) ──────────────────────
// En la práctica FBM un partido con modelo fino (p. ej. 1ª Nacional) se cubre
// preferentemente con DOS árbitros "titulares" de esa categoría (nivel con rol
// 'principal' en la matriz de elegibilidad para esa fineCategory); el auxiliar
// de nivel inferior es pareja VÁLIDA pero no la habitual. Esta constante
// expresa esa preferencia como penalización SOFT en el score del candidato NO
// titular del slot AUXILIAR, en EUROS EQUIVALENTES de coste marginal: como
// normalizedCost = marginal/26, sumar costWeight·(W/26) al score equivale
// exactamente a que el candidato costara W€ más ese día. Con peso W, un no
// titular solo gana el slot si el titular alternativo cuesta más de W€ extra
// (a igualdad de carga). NUNCA toca elegibilidad ni cobertura: sin titular
// disponible/asequible se asigna el auxiliar inferior, como antes.
// Calibrado 2026-07-18 con la curva coste/fidelidad de la temporada seed
// (solve por jornada, roster completo, disponibilidad total): peso 0 → 53% de
// partidos de 1ª Nacional con 2 nacionales; la fidelidad satura al 100% en
// peso 7 y de 7 a 25 la solución es idéntica (+302€ = +8,6% de coste de
// temporada). 10 = punto de saturación con margen.
export const AUX_TITULAR_PREFERENCE_WEIGHT = 10

// Options de solve(). El 2º parámetro acepta un number como `seed` (compat
// con los llamadores existentes) o este objeto.
export interface SolveOptions {
  seed?: number
  // Override del peso de la preferencia de auxiliar titular (0 = desactivada).
  // Por defecto AUX_TITULAR_PREFERENCE_WEIGHT.
  auxTitularPreferenceWeight?: number
}

// ── Solver principal ────────────────────────────────────────────────────────

export function solve(input: SolverInput, seedOrOptions?: number | SolveOptions): SolverOutput {
  const startTime = performance.now()
  const options: SolveOptions =
    typeof seedOrOptions === 'number' ? { seed: seedOrOptions } : (seedOrOptions ?? {})
  const seed = options.seed
  const auxTitularPreferenceWeight =
    options.auxTitularPreferenceWeight ?? AUX_TITULAR_PREFERENCE_WEIGHT
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
  // Indices por personId (ver comentario sobre hasScheduleConflict): evitan
  // recorrer arrays completos por cada candidato evaluado.
  const assignmentsByPerson = new Map<string, Assignment[]>()
  const designationsByPerson = buildDesignationIndex(mockDesignations)
  const matchesById = buildOverlapMatchIndex()
  // Índice completo por id (incluye partidos FUERA del scope): necesario para resolver
  // fecha y municipio del venue de designaciones existentes de la persona ese día que
  // caen fuera del rango/categoría solucionados (ver F2 — el coste marginal ve el día
  // completo, no solo el trozo en scope).
  const mockMatchById = new Map(mockMatches.map((m) => [m.id, m]))
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

  // Cargar designaciones existentes como asignaciones ya hechas. UN SOLO
  // recorrido (antes había uno para carga+solapamiento y otro para
  // forceExisting, que podían pisarse/duplicar trabajo): aquí se acumula cada
  // designación en `assignmentsByPerson` (para solapamiento Y para el coste
  // marginal) exactamente una vez, y si forceExisting está activo se reporta
  // en `assignments[]` con su coste marginal calculado contra las OTRAS
  // designaciones de esa persona/día ya acumuladas EN ESE MOMENTO. El orden
  // entre designaciones del mismo día no afecta al total (la suma de
  // marginales telescopa al coste real del conjunto completo, ver
  // metrics.totalCost más abajo).
  const existingByMatch: Record<
    string,
    { personId: string; role: string; position?: DesignationPosition }[]
  > = {}
  for (const d of mockDesignations) {
    if (!existingByMatch[d.matchId]) existingByMatch[d.matchId] = []
    existingByMatch[d.matchId].push({ personId: d.personId, role: d.role, position: d.position })
    if (personLoadCount[d.personId] !== undefined && inScopeMatchIds.has(d.matchId)) {
      personLoadCount[d.personId]++
    }

    // Resolver fecha + municipio del venue de esta designación, ESTÉ O NO en scope.
    // El coste marginal debe ver el día COMPLETO de la persona (F2): un partido ya
    // designado ese día en otra categoría o fuera del rango también "gasta" el
    // trayecto, así que su municipio cuenta como contexto aunque no se solucione aquí.
    const inScopeMatch = matches.find((mm) => mm.id === d.matchId)
    let date: string
    let time: string
    let venueId: string
    let venueMuniId: string
    if (inScopeMatch) {
      date = inScopeMatch.date
      time = inScopeMatch.time
      venueId = inScopeMatch.venueId
      venueMuniId = inScopeMatch.venue?.municipalityId ?? ''
    } else {
      const gm = mockMatchById.get(d.matchId)
      if (!gm) continue
      date = gm.date
      time = gm.time
      venueId = gm.venueId
      venueMuniId = getMockVenue(gm.venueId)?.municipalityId ?? ''
    }

    // forceExisting sólo MANTIENE en la salida las designaciones EN SCOPE; las de
    // fuera pertenecen a otra tanda de designación y aquí solo aportan contexto de coste.
    if (forceExisting && inScopeMatch) {
      const person = persons.find((p) => p.id === d.personId)
      if (person) {
        const travelCost = calculateMarginalTravelCost(
          assignmentsByPerson,
          person.id,
          person.municipalityId,
          date,
          venueMuniId,
        )
        const distanceKm = personVenueKm(person, inScopeMatch.venue, venueMuniId)
        const municipality = getMockMunicipality(person.municipalityId)
        assignments.push({
          matchId: d.matchId,
          personId: person.id,
          personName: person.name,
          role: d.role,
          travelCost,
          distanceKm,
          isNew: false,
          municipalityName: municipality?.name ?? '',
          // Pass-through de la posición real de la designación; a las legacy
          // sin posición nunca se les inventa una (doctrina Tanda 2).
          position: d.position,
        })
        markAssigned(assignedPersonsByMatch, d.matchId, person.id)
      }
    }

    addAssignment(assignmentsByPerson, {
      matchId: d.matchId,
      personId: d.personId,
      role: d.role,
      date,
      time,
      venueId,
      venueMuniId,
    })
  }

  // Ordenar partidos por prioridad:
  // 1. Sin asignaciones primero
  // 2. Mayor prioridad de categoría primero (escasez FINE_PRIORITY con
  //    categoría fina, CATEGORY_RANK legacy sin ella — matchPriorityRank)
  // Con seed: shuffle parcial para generar variacion entre ejecuciones
  const baseSorted = [...matches].sort((a, b) => {
    const aExisting = (existingByMatch[a.id] ?? []).length
    const bExisting = (existingByMatch[b.id] ?? []).length
    if (aExisting !== bExisting) return aExisting - bExisting

    return matchPriorityRank(b) - matchPriorityRank(a)
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
    // Slots NO reclamados del partido: con forceExisting las existentes
    // ocupan las suyas (explícitas primero, legacy rellenan huecos, misma regla
    // que mapDesignationsToSlots); sin forceExisting todos libres en orden.
    const freeRefSlots = getFreeSlots(
      forceExisting ? existing : [],
      'arbitro',
      match.refereesNeeded,
    )

    for (let i = 0; i < refsNeeded; i++) {
      const { slotIndex, position: slotPosition } = freeRefSlots[i]
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
        auxTitularPreferenceWeight,
        assignedPersonsByMatch,
        slotPosition,
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
          position: slotPosition,
        }
        assignments.push(proposed)
        addAssignment(assignmentsByPerson, {
          matchId: match.id,
          personId: candidate.person.id,
          role: 'arbitro',
          date: match.date,
          time: match.time,
          venueId: match.venueId,
          venueMuniId: venueMuni,
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
            slotPosition,
          ),
        })
      }
    }

    // Slots de anotadores
    const existingScorers = existing.filter((e) => e.role === 'anotador')
    const scorersNeeded = match.scorersNeeded - (forceExisting ? existingScorers.length : 0)
    const freeScorerSlots = getFreeSlots(
      forceExisting ? existing : [],
      'anotador',
      match.scorersNeeded,
    )

    for (let i = 0; i < scorersNeeded; i++) {
      const { slotIndex, position: slotPosition } = freeScorerSlots[i]
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
        auxTitularPreferenceWeight,
        assignedPersonsByMatch,
        slotPosition,
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
          position: slotPosition,
        }
        assignments.push(proposed)
        addAssignment(assignmentsByPerson, {
          matchId: match.id,
          personId: candidate.person.id,
          role: 'anotador',
          date: match.date,
          time: match.time,
          venueId: match.venueId,
          venueMuniId: venueMuni,
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
            slotPosition,
          ),
        })
      }
    }
  }

  const endTime = performance.now()
  const newAssignments = assignments.filter((a) => a.isNew)
  const totalSlots = matches.reduce((sum, m) => sum + m.refereesNeeded + m.scorersNeeded, 0)
  const coveredSlots = totalSlots - unassigned.length

  // totalCost = coste INCREMENTAL que la solución en scope añade a la liquidación real
  // de cada persona, contando su día COMPLETO (F2): para cada persona/día,
  //   dia(base ∪ propuesto) − dia(base)
  // donde `propuesto` = municipios de la SALIDA (`assignments`: existentes mantenidas por
  // forceExisting + picks nuevos) y `base` = municipios de designaciones de esa persona
  // ese día FUERA de scope. Propiedades:
  //  - No usa `assignmentsByPerson` (acumulador de solape): con forceExisting=false ese
  //    acumulador conserva las existentes descartadas y contaría el slot dos veces (F1).
  //  - Restar la base evita cobrar dos veces un municipio ya visitado fuera de scope
  //    (coherente con el coste marginal, que ya ve el día completo).
  //  - Sin designaciones fuera de scope (caso por defecto), base=[] y queda el coste
  //    real agrupado de la solución.
  const personMuniById = new Map(persons.map((p) => [p.id, p.municipalityId]))
  const matchInfoById = new Map(
    matches.map((m) => [m.id, { date: m.date, venueMuniId: m.venue?.municipalityId ?? '' }]),
  )

  // Municipios FUERA de scope por persona/día (contexto del día real).
  const outOfScopeByPersonDate = new Map<string, Map<string, string[]>>()
  for (const d of mockDesignations) {
    if (inScopeMatchIds.has(d.matchId)) continue
    if (!personMuniById.has(d.personId)) continue
    const gm = mockMatchById.get(d.matchId)
    if (!gm) continue
    const muni = getMockVenue(gm.venueId)?.municipalityId ?? ''
    let byDate = outOfScopeByPersonDate.get(d.personId)
    if (!byDate) {
      byDate = new Map<string, string[]>()
      outOfScopeByPersonDate.set(d.personId, byDate)
    }
    const list = byDate.get(gm.date)
    if (list) list.push(muni)
    else byDate.set(gm.date, [muni])
  }

  // Municipios PROPUESTOS (solución en scope) por persona/día.
  const proposedByPersonDate = new Map<string, Map<string, string[]>>()
  for (const a of assignments) {
    const info = matchInfoById.get(a.matchId)
    if (!info) continue
    let byDate = proposedByPersonDate.get(a.personId)
    if (!byDate) {
      byDate = new Map<string, string[]>()
      proposedByPersonDate.set(a.personId, byDate)
    }
    const list = byDate.get(info.date)
    if (list) list.push(info.venueMuniId)
    else byDate.set(info.date, [info.venueMuniId])
  }

  let totalCost = 0
  for (const [personId, byDate] of proposedByPersonDate) {
    const home = personMuniById.get(personId)
    if (home === undefined) continue
    const outByDate = outOfScopeByPersonDate.get(personId)
    for (const [date, proposedMunis] of byDate) {
      const base = outByDate?.get(date) ?? []
      const withProposed = calculateDailyTravelCost(home, [...base, ...proposedMunis]).cost
      const baseCost = calculateDailyTravelCost(home, base).cost
      totalCost += withProposed - baseCost
    }
  }

  const metrics: SolverMetrics = {
    totalCost: Number(totalCost.toFixed(2)),
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
  matchesById: Map<string, OverlapMatch>,
  personLoadCount: Record<string, number>,
  maxMatchesPerPerson: number,
  costWeight: number,
  balanceWeight: number,
  auxTitularPreferenceWeight: number,
  assignedPersonsByMatch: Map<string, Set<string>>,
  slotPosition?: DesignationPosition,
  rng: (() => number) | null = null,
): { person: EnrichedPerson; cost: number; km: number } | null {
  const candidates: { person: EnrichedPerson; cost: number; km: number; score: number }[] = []

  // Preferencia soft de titular en el slot AUXILIAR con modelo fino activo
  // (ver AUX_TITULAR_PREFERENCE_WEIGHT). Invariantes del slot, precalculados:
  // categoría fina solo si la preferencia aplica a este slot, y penalización
  // en unidades de score (costWeight·(W€/26) ≡ W€ más de coste marginal).
  const auxPrefFineCategory =
    auxTitularPreferenceWeight > 0 &&
    role === 'arbitro' &&
    toEligibleRole(slotPosition) === 'auxiliar'
      ? (match.competition?.fineCategory ?? null)
      : null
  const auxTitularPenalty = costWeight * (auxTitularPreferenceWeight / 26)

  // Encontrar max carga para normalizar. Bucle plano en vez de
  // Math.max(1, ...Object.values(...)): esto se llama una vez POR SLOT (hasta
  // ~1000 con el roster completo) sobre un Record de hasta 1279 entradas — el
  // spread de argumentos de Math.max es notablemente más lento a este tamaño.
  let maxLoad = 1
  for (const key in personLoadCount) {
    if (personLoadCount[key] > maxLoad) maxLoad = personLoadCount[key]
  }

  // Invariante del slot: se construye una vez, no por candidato
  const candidateMatch = toOverlapMatch(match, venueMuniId)

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
      hasScheduleConflict(
        person.id,
        candidateMatch,
        person.hasCar,
        assignmentsByPerson,
        designationsByPerson,
        matchesById,
      )
    )
      continue

    // Elegibilidad de categoría (solo arbitros): matriz fina de 7 niveles por
    // posición del slot cuando partido y persona llevan datos finos; fallback
    // legacy meetsMinCategory si no (D2/D4, checkSlotEligibility).
    if (role === 'arbitro') {
      if (!checkSlotEligibility(person, match.competition, toEligibleRole(slotPosition))) continue
    }

    // Incompatibilidades
    if (hasIncompatibility(person.id, match.homeTeam, match.awayTeam)) continue

    // Distancia DIRECTA persona↔pabellón (no marginal): decide la restricción
    // de coche y es lo que se reporta como distanceKm (la persona conduce
    // esos km igual, sea o no el primer partido del día). Coords reales si
    // ambos las tienen; fallback muni→muni (personVenueKm).
    const directKm = personVenueKm(person, match.venue, venueMuniId)

    // Hard constraint: sin coche y >30km directos → descartado
    if (!person.hasCar && directKm > 30) continue

    // Coste MARGINAL (no por partido): lo que este partido añade al coste
    // real del día de esta persona, dados los partidos que ya tiene ese día.
    const marginalCost = calculateMarginalTravelCost(
      assignmentsByPerson,
      person.id,
      person.municipalityId,
      match.date,
      venueMuniId,
    )

    // normalizedCost = marginal/26 preserva la escala previa: antes era
    // (0.1·km)/10 = km/100; ahora (0.26·km)/26 = km/100 en el caso típico del
    // primer desplazamiento del día — así el trade-off costWeight/balanceWeight
    // conserva su significado.
    let normalizedCost = marginalCost / 26
    if (!person.hasCar && directKm > 15) {
      // `Math.max(0, ...)` protege un invariante: con las tarifas actuales un trayecto
      // directo >15km siempre añade coste (marginal ≥ 0), pero si en el futuro cambian
      // (constantes en mock-data.ts), un marginal negativo × 2 PREMIARÍA el viaje largo
      // sin coche en vez de penalizarlo. La penalización nunca reduce el score.
      normalizedCost = Math.max(0, normalizedCost) * 2.0
    }
    const normalizedLoad = currentLoad / maxLoad

    let score = costWeight * normalizedCost + balanceWeight * normalizedLoad
    // Candidato NO titular (nivel sin rol 'principal' en esa fineCategory) en
    // el slot auxiliar → penalización soft. Solo reordena candidatos YA
    // elegibles (checkSlotEligibility arriba); las personas sin refereeLevel
    // (fallback legacy) no llevan penalización, igual que el resto del modelo
    // fino (mismo criterio de activación que usesFineModel).
    if (
      auxPrefFineCategory &&
      isRefereeLevel(person.refereeLevel) &&
      !eligibleRoles(person.refereeLevel, auxPrefFineCategory).includes('principal')
    ) {
      score += auxTitularPenalty
    }
    candidates.push({ person, cost: marginalCost, km: directKm, score })
  }

  if (candidates.length === 0) return null

  // Ordenar por score (menor = mejor)
  candidates.sort((a, b) => a.score - b.score)

  // Con rng: seleccionar aleatoriamente entre candidatos dentro de un umbral del 5%.
  // Umbral ADITIVO (`base + 0.05·|base|`), no multiplicativo: el coste marginal puede ser
  // negativo (un día que pasa de "100% en casa" con fijo a "con salida" barata → el fijo
  // desaparece), y entonces `score` puede ser negativo con costWeight alto. Con el viejo
  // `base·1.05` un `base` negativo daba un umbral MÁS negativo que el propio mejor
  // candidato → el filtro quedaba vacío → `topCandidates[0]` undefined → slot sin cubrir
  // por error. La forma aditiva siempre incluye al mejor y a los que están dentro del 5%
  // de su magnitud, para base positivo, negativo o cero.
  if (rng && candidates.length > 1) {
    const base = candidates[0].score
    const threshold = base + 0.05 * Math.abs(base)
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
    const aCat = matchPriorityRank(sorted[i])
    while (j < sorted.length) {
      const bExisting = (existingByMatch[sorted[j].id] ?? []).length
      const bCat = matchPriorityRank(sorted[j])
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
  matchesById: Map<string, OverlapMatch>,
  personLoadCount: Record<string, number>,
  maxMatchesPerPerson: number,
  assignedPersonsByMatch: Map<string, Set<string>>,
  slotPosition?: DesignationPosition,
): string {
  const candidatesOfRole = persons.filter((p) => p.role === role && p.active)
  if (candidatesOfRole.length === 0)
    return `No hay ${role === 'arbitro' ? 'árbitros' : 'anotadores'} activos`

  const venueMuni = match.venue?.municipalityId ?? ''
  // Invariante del slot: se construye una vez, no por candidato
  const candidateMatch = toOverlapMatch(match, venueMuni)

  let noAvailability = 0
  let overlap = 0
  let categoryInsufficient = 0
  let levelNotEligible = 0
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
      hasScheduleConflict(
        person.id,
        candidateMatch,
        person.hasCar,
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
      !checkSlotEligibility(person, match.competition, toEligibleRole(slotPosition))
    ) {
      // "nivel no elegible" cuando el rechazo vino de la matriz fina;
      // "categoría insuficiente" cuando vino del fallback legacy.
      if (usesFineModel(person, match.competition)) levelNotEligible++
      else categoryInsufficient++
      continue
    }
    if (hasIncompatibility(person.id, match.homeTeam, match.awayTeam)) {
      incompatible++
      continue
    }

    // Comprobar hard constraint coche para diagnóstico (distancia directa,
    // misma métrica que findBestCandidate: coords reales o fallback muni→muni)
    const km = personVenueKm(person, match.venue, venueMuni)
    if (!person.hasCar && km > 30) {
      noCarTooFar++
      continue
    }
  }

  const reasons: string[] = []
  if (noAvailability > 0) reasons.push(`${noAvailability} sin disponibilidad`)
  if (overlap > 0) reasons.push(`${overlap} con solapamiento`)
  if (categoryInsufficient > 0) reasons.push(`${categoryInsufficient} categoría insuficiente`)
  if (levelNotEligible > 0) reasons.push(`${levelNotEligible} nivel no elegible`)
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
  const matchesById = buildOverlapMatchIndex()
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
        venueId: m.venueId,
        venueMuniId: m.venue?.municipalityId ?? '',
      })
      if (personLoadCount[d.personId] !== undefined) personLoadCount[d.personId]++
    }
  }

  // Posición libre del slot re-optimizado: las designaciones existentes del
  // partido reclaman las suyas (misma regla de huecos que mapDesignationsToSlots,
  // como en solve con forceExisting). Si el slot `slotIndex` está libre se usa su
  // posición; si no (llamador desincronizado), la primera posición libre.
  const needed = role === 'arbitro' ? match.refereesNeeded : match.scorersNeeded
  const existingOfMatch = mockDesignations.filter((d) => d.matchId === match.id)
  const slots = mapDesignationsToSlots(existingOfMatch, role, needed)
  let slotPosition: DesignationPosition | undefined
  if (slotIndex < needed && slots[slotIndex] === undefined) {
    slotPosition = positionForSlot(role, slotIndex)
  } else {
    for (let i = 0; i < needed; i++) {
      if (slots[i] === undefined) {
        slotPosition = positionForSlot(role, i)
        break
      }
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
    AUX_TITULAR_PREFERENCE_WEIGHT,
    assignedPersonsByMatch,
    slotPosition,
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
          position: slotPosition,
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
          slotPosition,
        ),
      },
    ],
  }
}
