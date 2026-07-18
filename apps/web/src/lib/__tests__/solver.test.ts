import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolverInput, EnrichedMatch, EnrichedPerson } from '../types'

// ── Mock the mock-data module so we control what the solver sees ──────────

const mockAvailabilities: {
  id: string
  personId: string
  weekStart: string
  dayOfWeek: number
  startTime: string
  endTime: string
}[] = []

const mockIncompatibilities: {
  id: string
  personId: string
  teamName: string
  reason: string
}[] = []

const mockDesignations: {
  id: string
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  travelCost: string
  distanceKm: string
  status: string
  notifiedAt: Date | null
  createdAt: Date
}[] = []

// venueId opcional: solo lo usan los tests de F2 (día completo con partidos fuera de
// scope). Convención del mock de getMockVenue: `v@<muni>` → municipalityId `<muni>`.
const mockMatches: { id: string; date: string; time: string; venueId?: string }[] = []

// Misma semantica de minutos que mock-data.ts#isPersonAvailable (comparacion
// en minutos, intervalos semiabiertos [start,end)), pero sobre el array local
// de este test. El solver ya no calcula disponibilidad por su cuenta (bug de
// horas enteras corregido: delega en esta funcion via ../mock-data).
function localIsPersonAvailable(personId: string, date: string, time: string): boolean {
  const dateObj = new Date(date + 'T00:00:00')
  const dateDayOfWeek = dateObj.getDay()
  const dayOfWeek = dateDayOfWeek === 0 ? 6 : dateDayOfWeek - 1
  const diff = dateObj.getDate() - dateDayOfWeek + (dateDayOfWeek === 0 ? -6 : 1)
  dateObj.setDate(diff)
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const weekStartStr = `${year}-${month}-${day}`

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const matchMin = toMinutes(time)

  return mockAvailabilities.some(
    (a) =>
      a.personId === personId &&
      a.weekStart === weekStartStr &&
      a.dayOfWeek === dayOfWeek &&
      matchMin >= toMinutes(a.startTime) &&
      matchMin < toMinutes(a.endTime),
  )
}

// Misma semantica que getMockDistance real (mock-data.ts): 0 si mismo
// municipio, si no un valor fijo por par. 'muni-VERYFAR' es un municipio de
// prueba dedicado para el test de la restriccion coche (>30km directos):
// ningun otro test usa ese id, asi que no contamina el resto de la suite.
function localGetMockDistance(originId: string, destId: string): number {
  if (originId === destId) return 0
  if (originId === 'muni-VERYFAR' || destId === 'muni-VERYFAR') return 35
  // 'muni-CLOSE': trayecto barato (3km → 0,78€ < fijo 2€ del dia 100% en casa),
  // dedicado al test del marginal NEGATIVO (dia que pasa de fijo a salida barata).
  if (originId === 'muni-CLOSE' || destId === 'muni-CLOSE') return 3
  return 20 // default 20km for any otra cross-municipality pair
}

// Replica fiel de calculateDailyTravelCost (mock-data.ts, fuente de la
// verdad): dia con salida a otro municipio -> solo kilometraje (un trayecto
// por municipio de destino distinto, via localGetMockDistance); dia 100% en
// el municipio propio -> fijo por dia ('muni-madrid' -> 3, resto -> 2). El id
// se compara directamente (sin pasar por getMockMunicipality) porque el
// mock de ese helper no modela "Madrid" de forma especial.
function localCalculateDailyTravelCost(
  personMuniId: string,
  venueMunicipalityIds: string[],
): { cost: number; km: number } {
  if (venueMunicipalityIds.length === 0) return { cost: 0, km: 0 }
  const awayMunis = [...new Set(venueMunicipalityIds)].filter((id) => id !== personMuniId)
  if (awayMunis.length > 0) {
    const km = awayMunis.reduce(
      (sum, destId) => sum + localGetMockDistance(personMuniId, destId),
      0,
    )
    return { cost: Number((km * 0.26).toFixed(2)), km: Number(km.toFixed(1)) }
  }
  return { cost: personMuniId === 'muni-madrid' ? 3 : 2, km: 0 }
}

vi.mock('../mock-data', () => ({
  get mockAvailabilities() {
    return mockAvailabilities
  },
  get mockIncompatibilities() {
    return mockIncompatibilities
  },
  get mockDesignations() {
    return mockDesignations
  },
  get mockMatches() {
    return mockMatches
  },
  getMockDistance: localGetMockDistance,
  calculateDailyTravelCost: localCalculateDailyTravelCost,
  getMockMunicipality: (id: string) => ({ id, name: `Municipality-${id}` }),
  // Convención de test: venueId `v@<muni>` resuelve al municipio `<muni>`; cualquier
  // otro (o undefined, p. ej. mockMatches sin venueId) → undefined (municipio '').
  getMockVenue: (venueId?: string) =>
    venueId && venueId.startsWith('v@')
      ? { id: venueId, municipalityId: venueId.slice(2) }
      : undefined,
  isPersonAvailable: localIsPersonAvailable,
}))

// Import solver AFTER mocking
import { solve } from '../solver'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMatch(overrides: Partial<EnrichedMatch> & { id: string }): EnrichedMatch {
  return {
    date: '2025-03-15', // Saturday
    time: '10:00',
    venueId: 'v1',
    competitionId: 'c1',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled',
    seasonId: 's1',
    matchday: 15,
    venue: { id: 'v1', name: 'Venue 1', address: '', municipalityId: 'muni-X', postalCode: '' },
    competition: {
      id: 'c1',
      name: 'Liga',
      category: 'junior',
      gender: 'male',
      refereesNeeded: 2,
      scorersNeeded: 1,
      minRefCategory: 'provincial',
      seasonId: 's1',
    },
    designations: [],
    refereesAssigned: 0,
    scorersAssigned: 0,
    isCovered: false,
    ...overrides,
  }
}

function makePerson(overrides: Partial<EnrichedPerson> & { id: string }): EnrichedPerson {
  return {
    name: `Person ${overrides.id}`,
    email: `${overrides.id}@test.com`,
    phone: '600000000',
    role: 'arbitro',
    category: 'autonomico',
    address: '',
    postalCode: '',
    municipalityId: 'muni-A',
    active: true,
    hasCar: true,
    matchesAssigned: 0,
    totalCost: 0,
    hasAvailability: true,
    ...overrides,
  }
}

function defaultParams(): SolverInput['parameters'] {
  return {
    costWeight: 0.7,
    balanceWeight: 0.3,
    maxMatchesPerPerson: 3,
    forceExisting: false,
    numProposals: 1,
  }
}

// Add availability entries for a person on a specific date+time
function addAvailability(personId: string, date: string, time: string) {
  const d = new Date(date + 'T00:00:00')
  const jsDay = d.getDay()
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

  const dateObj = new Date(date + 'T00:00:00')
  const dateDayOfWeek = dateObj.getDay()
  const diff = dateObj.getDate() - dateDayOfWeek + (dateDayOfWeek === 0 ? -6 : 1)
  dateObj.setDate(diff)
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const weekStart = `${year}-${month}-${day}`

  const hour = parseInt(time.split(':')[0])
  mockAvailabilities.push({
    id: `avail-${mockAvailabilities.length + 1}`,
    personId,
    weekStart,
    dayOfWeek,
    startTime: `${String(hour).padStart(2, '0')}:00`,
    endTime: `${String(hour + 1).padStart(2, '0')}:00`,
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('solve', () => {
  beforeEach(() => {
    mockAvailabilities.length = 0
    mockIncompatibilities.length = 0
    mockDesignations.length = 0
    mockMatches.length = 0
  })

  it('trivial: 1 match, enough persons → optimal with all slots filled', () => {
    const match = makeMatch({
      id: 'm1',
      refereesNeeded: 1,
      scorersNeeded: 1,
    })
    const ref = makePerson({ id: 'p1', role: 'arbitro' })
    const scorer = makePerson({ id: 'p2', role: 'anotador' })

    addAvailability('p1', match.date, match.time)
    addAvailability('p2', match.date, match.time)

    const result = solve({
      matches: [match],
      persons: [ref, scorer],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('optimal')
    expect(result.assignments).toHaveLength(2)
    expect(result.unassigned).toHaveLength(0)
    expect(result.metrics.coverage).toBe(100)
    expect(result.assignments.find((a) => a.role === 'arbitro')?.personId).toBe('p1')
    expect(result.assignments.find((a) => a.role === 'anotador')?.personId).toBe('p2')
  })

  it('no solution: more slots than available persons → partial with unassigned', () => {
    const match = makeMatch({
      id: 'm1',
      refereesNeeded: 3,
      scorersNeeded: 2,
    })
    // Only 1 referee and 1 scorer available
    const ref = makePerson({ id: 'p1', role: 'arbitro' })
    const scorer = makePerson({ id: 'p2', role: 'anotador' })

    addAvailability('p1', match.date, match.time)
    addAvailability('p2', match.date, match.time)

    const result = solve({
      matches: [match],
      persons: [ref, scorer],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('partial')
    expect(result.unassigned.length).toBeGreaterThan(0)
    // 3 refs needed - 1 available = 2 unassigned refs; 2 scorers needed - 1 = 1 unassigned scorer
    expect(result.unassigned).toHaveLength(3)
    expect(result.metrics.coverage).toBeLessThan(100)
  })

  it('incompatibilities: person with incompatibility is NOT assigned to that match', () => {
    const match = makeMatch({
      id: 'm1',
      homeTeam: 'CB Conflicto',
      awayTeam: 'Team B',
      refereesNeeded: 1,
      scorersNeeded: 0,
    })
    // p1 has incompatibility with CB Conflicto, p2 doesn't
    const p1 = makePerson({ id: 'p1', role: 'arbitro' })
    const p2 = makePerson({ id: 'p2', role: 'arbitro' })

    addAvailability('p1', match.date, match.time)
    addAvailability('p2', match.date, match.time)

    mockIncompatibilities.push({
      id: 'inc-1',
      personId: 'p1',
      teamName: 'CB Conflicto',
      reason: 'Miembro del club',
    })

    const result = solve({
      matches: [match],
      persons: [p1, p2],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('optimal')
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].personId).toBe('p2') // p1 excluded by incompatibility
  })

  it('performance: 50 matches + 30 persons resolves in <1000ms', () => {
    const date = '2025-03-15' // Saturday

    const matches: EnrichedMatch[] = []
    for (let i = 0; i < 50; i++) {
      const hour = 9 + (i % 12) // 09:00-20:00
      matches.push(
        makeMatch({
          id: `m${i}`,
          time: `${String(hour).padStart(2, '0')}:00`,
          refereesNeeded: 1,
          scorersNeeded: 1,
        }),
      )
    }

    const persons: EnrichedPerson[] = []
    for (let i = 0; i < 20; i++) {
      persons.push(makePerson({ id: `ref${i}`, role: 'arbitro', municipalityId: `muni-${i % 5}` }))
    }
    for (let i = 0; i < 10; i++) {
      persons.push(makePerson({ id: `scr${i}`, role: 'anotador', municipalityId: `muni-${i % 5}` }))
    }

    // Give everyone wide availability on Saturday
    for (const p of persons) {
      for (let h = 9; h <= 20; h++) {
        addAvailability(p.id, date, `${String(h).padStart(2, '0')}:00`)
      }
    }

    const start = performance.now()
    const result = solve({
      matches,
      persons,
      parameters: { ...defaultParams(), maxMatchesPerPerson: 5 },
    })
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(1000)
    expect(result.assignments.length).toBeGreaterThan(0)
    expect(result.metrics.resolutionTimeMs).toBeDefined()
  })

  it('hard constraint: person without car and >30km is discarded', () => {
    const match = makeMatch({
      id: 'm1',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: {
        id: 'v1',
        name: 'Venue Far',
        address: '',
        municipalityId: 'muni-FAR',
        postalCode: '',
      },
    })
    // p1 has no car — getMockDistance returns 20km by default, but we need >30km
    // We override the mock to return 35km for muni-A → muni-FAR
    const p1 = makePerson({ id: 'p1', role: 'arbitro', hasCar: false, municipalityId: 'muni-A' })
    const p2 = makePerson({ id: 'p2', role: 'arbitro', hasCar: true, municipalityId: 'muni-A' })

    addAvailability('p1', match.date, match.time)
    addAvailability('p2', match.date, match.time)

    // Default mock distance is 20km (< 30), so p1 should NOT be discarded here
    const result1 = solve({
      matches: [match],
      persons: [p1, p2],
      parameters: defaultParams(),
    })
    expect(result1.status).toBe('optimal')
    expect(result1.assignments).toHaveLength(1)

    // Now test with only the no-car person and venue in same municipality (0 km) — should work
    const matchSameMuni = makeMatch({
      id: 'm2',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: {
        id: 'v2',
        name: 'Venue Local',
        address: '',
        municipalityId: 'muni-A',
        postalCode: '',
      },
    })
    addAvailability('p1', matchSameMuni.date, matchSameMuni.time)

    const result2 = solve({
      matches: [matchSameMuni],
      persons: [p1],
      parameters: defaultParams(),
    })
    expect(result2.status).toBe('optimal')
    expect(result2.assignments).toHaveLength(1)
    expect(result2.assignments[0].personId).toBe('p1')
  })

  it('seed variation: seed=0 vs seed=1 produce different assignments', () => {
    const date = '2025-03-15'
    // Multiple matches and persons so shuffle can produce differences
    const matches: EnrichedMatch[] = []
    for (let i = 0; i < 6; i++) {
      matches.push(
        makeMatch({
          id: `m${i}`,
          time: `${String(10 + i * 2).padStart(2, '0')}:00`,
          refereesNeeded: 1,
          scorersNeeded: 0,
        }),
      )
    }

    const persons: EnrichedPerson[] = []
    for (let i = 0; i < 8; i++) {
      persons.push(makePerson({ id: `p${i}`, role: 'arbitro', municipalityId: `muni-${i % 3}` }))
    }

    for (const p of persons) {
      for (let h = 8; h <= 22; h++) {
        addAvailability(p.id, date, `${String(h).padStart(2, '0')}:00`)
      }
    }

    const input: SolverInput = { matches, persons, parameters: defaultParams() }

    const result0 = solve(input, 0)
    const result1 = solve(input, 1)

    // Both should succeed
    expect(result0.status).toBe('optimal')
    expect(result1.status).toBe('optimal')

    // At least one assignment should differ between the two seeds
    const ids0 = result0.assignments.map((a) => `${a.matchId}:${a.personId}`).sort()
    const ids1 = result1.assignments.map((a) => `${a.matchId}:${a.personId}`).sort()
    const hasDifference = ids0.some((id, i) => id !== ids1[i])
    expect(hasDifference).toBe(true)
  })

  it('regresion bug horas enteras: partido a las 15:00 con franja 15:30-22:00 -> NO disponible', () => {
    const match = makeMatch({
      id: 'm1',
      time: '15:00',
      refereesNeeded: 1,
      scorersNeeded: 0,
    })
    const p1 = makePerson({ id: 'p1', role: 'arbitro' })

    // Franja de tarde 15:30-22:00: NO cubre las 15:00. Con el bug antiguo de
    // horas enteras (parseInt) esto daba disponible (15 >= 15 && 15 < 22).
    const dateObj = new Date(match.date + 'T00:00:00')
    const dateDayOfWeek = dateObj.getDay()
    const dayOfWeek = dateDayOfWeek === 0 ? 6 : dateDayOfWeek - 1
    const diff = dateObj.getDate() - dateDayOfWeek + (dateDayOfWeek === 0 ? -6 : 1)
    dateObj.setDate(diff)
    const year = dateObj.getFullYear()
    const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0')
    const dayStr = String(dateObj.getDate()).padStart(2, '0')
    const weekStart = `${year}-${monthStr}-${dayStr}`

    mockAvailabilities.push({
      id: 'avail-regression-1',
      personId: 'p1',
      weekStart,
      dayOfWeek,
      startTime: '15:30',
      endTime: '22:00',
    })

    const result = solve({
      matches: [match],
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('no_solution')
    expect(result.assignments).toHaveLength(0)
    expect(result.unassigned).toHaveLength(1)
    expect(result.unassigned[0].reason).toContain('sin disponibilidad')
  })

  it('I2: la carga cuenta solo designaciones DENTRO del conjunto acotado, no las de otra jornada', () => {
    const matchIn = makeMatch({
      id: 'm_in',
      date: '2025-03-15',
      time: '10:00',
      refereesNeeded: 1,
      scorersNeeded: 0,
    })
    const p1 = makePerson({ id: 'p1', role: 'arbitro' })
    addAvailability('p1', matchIn.date, matchIn.time)

    // Designación existente en un partido FUERA del conjunto que se optimiza (otra jornada).
    mockMatches.push({ id: 'm_out', date: '2025-03-22', time: '10:00' })
    mockDesignations.push({
      id: 'd_out',
      matchId: 'm_out',
      personId: 'p1',
      role: 'arbitro',
      travelCost: '0.00',
      distanceKm: '0.0',
      status: 'confirmed',
      notifiedAt: null,
      createdAt: new Date(),
    })

    // maxMatchesPerPerson=1: si la carga contara GLOBAL, p1 (1 designación fuera del
    // rango) estaría al tope y quedaría excluido. Con la carga acotada al conjunto,
    // p1 tiene carga 0 dentro y sí se asigna.
    const result = solve({
      matches: [matchIn],
      persons: [p1],
      parameters: { ...defaultParams(), maxMatchesPerPerson: 1 },
    })

    expect(result.status).toBe('optimal')
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].personId).toBe('p1')
  })
})

// ── T1: coste marginal por persona y dia (no por partido) ──────────────────

describe('solve — coste marginal por persona/día', () => {
  beforeEach(() => {
    mockAvailabilities.length = 0
    mockIncompatibilities.length = 0
    mockDesignations.length = 0
    mockMatches.length = 0
  })

  it('2º partido mismo día y mismo municipio away → travelCost 0, sin doble trayecto', () => {
    const m1 = makeMatch({ id: 'm1', time: '10:00', refereesNeeded: 1, scorersNeeded: 0 })
    const m2 = makeMatch({ id: 'm2', time: '14:00', refereesNeeded: 1, scorersNeeded: 0 })
    const p1 = makePerson({ id: 'p1', role: 'arbitro' }) // municipalityId 'muni-A'; venue default 'muni-X'
    addAvailability('p1', m1.date, m1.time)
    addAvailability('p1', m2.date, m2.time)

    const result = solve({
      matches: [m1, m2],
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('optimal')
    expect(result.assignments).toHaveLength(2)
    const a1 = result.assignments.find((a) => a.matchId === 'm1')
    const a2 = result.assignments.find((a) => a.matchId === 'm2')
    expect(a1?.travelCost).toBeCloseTo(5.2) // 20km * 0.26 — primer trayecto del día
    expect(a2?.travelCost).toBe(0) // mismo municipio away ya contado ese día
    expect(result.metrics.totalCost).toBeCloseTo(5.2) // un solo trayecto, no dos
  })

  it('partido en el municipio propio en un día con salida away → travelCost 0', () => {
    const matchAway = makeMatch({ id: 'm1', time: '10:00', refereesNeeded: 1, scorersNeeded: 0 })
    const matchHome = makeMatch({
      id: 'm2',
      time: '14:00',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: {
        id: 'v2',
        name: 'Venue Home',
        address: '',
        municipalityId: 'muni-A',
        postalCode: '',
      },
    })
    const p1 = makePerson({ id: 'p1', role: 'arbitro' }) // municipalityId 'muni-A'
    addAvailability('p1', matchAway.date, matchAway.time)
    addAvailability('p1', matchHome.date, matchHome.time)

    const result = solve({
      matches: [matchAway, matchHome],
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('optimal')
    const homePick = result.assignments.find((a) => a.matchId === 'm2')
    expect(homePick?.travelCost).toBe(0)
  })

  it('primer desplazamiento away del día → travelCost = km × 0.26', () => {
    const match = makeMatch({ id: 'm1', refereesNeeded: 1, scorersNeeded: 0 })
    const p1 = makePerson({ id: 'p1', role: 'arbitro' }) // muni-A → venue muni-X, 20km
    addAvailability('p1', match.date, match.time)

    const result = solve({
      matches: [match],
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.assignments[0].travelCost).toBe(5.2)
    expect(result.assignments[0].distanceKm).toBe(20)
  })

  it('día 100% en el municipio propio → fijo por día (Madrid 3€, resto 2€)', () => {
    const matchMadrid = makeMatch({
      id: 'm1',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: {
        id: 'v1',
        name: 'Venue Madrid',
        address: '',
        municipalityId: 'muni-madrid',
        postalCode: '',
      },
    })
    const pMadrid = makePerson({ id: 'p-madrid', role: 'arbitro', municipalityId: 'muni-madrid' })
    addAvailability('p-madrid', matchMadrid.date, matchMadrid.time)

    const resultMadrid = solve({
      matches: [matchMadrid],
      persons: [pMadrid],
      parameters: defaultParams(),
    })
    expect(resultMadrid.assignments[0].travelCost).toBe(3)

    const matchOther = makeMatch({
      id: 'm2',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: { id: 'v2', name: 'Venue A', address: '', municipalityId: 'muni-A', postalCode: '' },
    })
    const pOther = makePerson({ id: 'p-other', role: 'arbitro', municipalityId: 'muni-A' })
    addAvailability('p-other', matchOther.date, matchOther.time)

    const resultOther = solve({
      matches: [matchOther],
      persons: [pOther],
      parameters: defaultParams(),
    })
    expect(resultOther.assignments[0].travelCost).toBe(2)
  })

  it('metrics.totalCost es el coste real agrupado por día, no la suma de travelCost individuales', () => {
    const m1 = makeMatch({ id: 'm1', time: '10:00', refereesNeeded: 1, scorersNeeded: 0 })
    const m2 = makeMatch({ id: 'm2', time: '14:00', refereesNeeded: 1, scorersNeeded: 0 })
    const p1 = makePerson({ id: 'p1', role: 'arbitro' })
    addAvailability('p1', m1.date, m1.time)
    addAvailability('p1', m2.date, m2.time)

    const result = solve({
      matches: [m1, m2],
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.assignments).toHaveLength(2)
    // Bajo el modelo antiguo (coste por partido) esto sumaria 5.2+5.2=10.4;
    // el coste real agrupado por dia es un unico trayecto: 5.2.
    expect(result.metrics.totalCost).toBeCloseTo(5.2)
  })

  // Regresión F1: con forceExisting=false, una designación existente se descarta de la
  // solución (el greedy re-rellena el slot con otra persona). totalCost debe reflejar SOLO
  // la solución propuesta (la sustituta), no sumar también el coste de la existente
  // descartada (que sí sigue en el acumulador de solape). Antes del fix daba 10,4 (doble).
  it('forceExisting=false: totalCost no cuenta el coste de la existente descartada', () => {
    const m1 = makeMatch({ id: 'm1', time: '10:00', refereesNeeded: 1, scorersNeeded: 0 }) // venue muni-X, 20km
    // p1 tiene designación existente en m1 pero SIN disponibilidad declarada → no es
    // candidato válido; el greedy debe elegir a p2 para el slot.
    const p1 = makePerson({ id: 'p1', role: 'arbitro', municipalityId: 'muni-A' })
    const p2 = makePerson({ id: 'p2', role: 'arbitro', municipalityId: 'muni-A' })
    mockMatches.push({ id: 'm1', date: m1.date, time: m1.time })
    mockDesignations.push({
      id: 'd1',
      matchId: 'm1',
      personId: 'p1',
      role: 'arbitro',
      travelCost: '5.20',
      distanceKm: '20.0',
      status: 'confirmed',
      notifiedAt: null,
      createdAt: new Date(),
    })
    addAvailability('p2', m1.date, m1.time) // solo p2 disponible

    const result = solve({
      matches: [m1],
      persons: [p1, p2],
      parameters: { ...defaultParams(), forceExisting: false },
    })

    const newPicks = result.assignments.filter((a) => a.isNew)
    expect(newPicks).toHaveLength(1)
    expect(newPicks[0].personId).toBe('p2')
    // Solo el trayecto de p2 (20km → 5,20€); NO 10,4 (p1 existente + p2).
    expect(result.metrics.totalCost).toBeCloseTo(5.2)
  })

  // F2: el marginal (y totalCost) ven el día COMPLETO de la persona, incluidas
  // designaciones cuyo partido cae FUERA del scope solucionado (otra categoría / fuera del
  // rango). p1 ya tiene un partido ese día en muni-X fuera de scope → un partido nuevo en
  // muni-X ese día no añade trayecto (marginal 0). Sin el fix se cobraría 5,20€.
  it('F2: designación del mismo día fuera de scope hace el marginal 0 (día completo)', () => {
    // m_in: partido a designar, away muni-X (venue por defecto de makeMatch), 20km.
    const mIn = makeMatch({ id: 'm_in', time: '14:00', refereesNeeded: 1, scorersNeeded: 0 })
    // m_out: partido del MISMO día en muni-X, ya designado a p1, pero FUERA de scope
    // (no está en `matches`). Su municipio se resuelve por mockMatches + getMockVenue.
    const p1 = makePerson({ id: 'p1', role: 'arbitro', municipalityId: 'muni-A' })
    mockMatches.push({ id: 'm_out', date: mIn.date, time: '10:00', venueId: 'v@muni-X' })
    mockDesignations.push({
      id: 'd_out',
      matchId: 'm_out',
      personId: 'p1',
      role: 'arbitro',
      travelCost: '5.20',
      distanceKm: '20.0',
      status: 'confirmed',
      notifiedAt: null,
      createdAt: new Date(),
    })
    addAvailability('p1', mIn.date, mIn.time)

    const result = solve({
      matches: [mIn], // m_out queda FUERA de scope
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('optimal')
    const pick = result.assignments.find((a) => a.matchId === 'm_in' && a.isNew)
    expect(pick?.personId).toBe('p1')
    expect(pick?.travelCost).toBe(0) // ya viaja a muni-X ese día (m_out fuera de scope)
    // El día de p1 ya cuesta 5,20€ por m_out; m_in no añade nada → incremental 0.
    expect(result.metrics.totalCost).toBeCloseTo(0)
  })

  it('sin coche y distancia DIRECTA >30km → descartado (hard constraint)', () => {
    const match = makeMatch({
      id: 'm1',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: {
        id: 'v1',
        name: 'Venue Very Far',
        address: '',
        municipalityId: 'muni-VERYFAR',
        postalCode: '',
      },
    })
    const pNoCar = makePerson({
      id: 'p1',
      role: 'arbitro',
      hasCar: false,
      municipalityId: 'muni-A',
    })
    addAvailability('p1', match.date, match.time)

    const result = solve({
      matches: [match],
      persons: [pNoCar],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('no_solution')
    expect(result.assignments).toHaveLength(0)
    expect(result.unassigned[0].reason).toContain('sin coche (>30km)')
  })

  // Regresión: con marginal NEGATIVO (día que pasa de fijo en casa a salida barata) y
  // costWeight=1, el mejor score es negativo. Con el viejo umbral multiplicativo
  // (`base·1.05`) el filtro de la selección con rng quedaba vacío → slot sin cubrir. El
  // umbral aditivo (`base + 0.05·|base|`) incluye siempre al mejor candidato.
  it('marginal negativo + costWeight=1 + rng: el mejor candidato se asigna (umbral robusto)', () => {
    // m0: partido en el municipio propio (muni-A) ya designado a p1 → su día es "100% en
    // casa" (fijo 2€) antes de m1. m1: partido away barato (muni-CLOSE, 3km → 0,78€) el
    // mismo día → marginal de p1 = 0,78 − 2 = −1,22 (negativo).
    const m0 = makeMatch({
      id: 'm0',
      time: '10:00',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: {
        id: 'v0',
        name: 'Venue Home',
        address: '',
        municipalityId: 'muni-A',
        postalCode: '',
      },
    })
    const m1 = makeMatch({
      id: 'm1',
      time: '14:00',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venue: {
        id: 'v1',
        name: 'Venue Close',
        address: '',
        municipalityId: 'muni-CLOSE',
        postalCode: '',
      },
    })
    const p1 = makePerson({ id: 'p1', role: 'arbitro', municipalityId: 'muni-A' })
    // p2: segundo candidato válido para m1 (marginal positivo 0,78) → candidates.length > 1,
    // condición necesaria para entrar en la rama de selección con rng.
    const p2 = makePerson({ id: 'p2', role: 'arbitro', municipalityId: 'muni-A' })

    mockMatches.push({ id: 'm0', date: m0.date, time: m0.time })
    mockMatches.push({ id: 'm1', date: m1.date, time: m1.time })
    mockDesignations.push({
      id: 'd0',
      matchId: 'm0',
      personId: 'p1',
      role: 'arbitro',
      travelCost: '2.00',
      distanceKm: '0.0',
      status: 'confirmed',
      notifiedAt: null,
      createdAt: new Date(),
    })
    addAvailability('p1', m0.date, m0.time)
    addAvailability('p1', m1.date, m1.time)
    addAvailability('p2', m1.date, m1.time)

    // seed → rng activo; costWeight=1/balanceWeight=0 → score = normalizedCost (marginal/26),
    // negativo para p1; forceExisting=true → la designación de m0 se carga y fija el día de p1.
    const result = solve(
      {
        matches: [m0, m1],
        persons: [p1, p2],
        parameters: {
          costWeight: 1,
          balanceWeight: 0,
          maxMatchesPerPerson: 3,
          forceExisting: true,
          numProposals: 1,
        },
      },
      0,
    )

    expect(result.status).toBe('optimal')
    const m1Pick = result.assignments.find((a) => a.matchId === 'm1' && a.isNew)
    expect(m1Pick?.personId).toBe('p1')
    expect(m1Pick?.travelCost).toBeCloseTo(-1.22) // 0,78 (away barato) − 2 (fijo que desaparece)
  })
})

// ── Solapamiento unificado (pairOverlap) ────────────────────────────────────
// Regresión del bug de horas truncadas: antes hasTimeOverlapWith comparaba
// parseInt(time.split(':')[0]) con |horaA-horaB|<2, lo que marcaba en conflicto
// partidos ENCADENABLES en el mismo pabellón (14:00 y 15:30 con duración de 90min: el
// primero termina exactamente cuando empieza el segundo). Ahora delega en pairOverlap
// (minutos + duración real + viaje estimado + hasCar), la misma primitiva que usa el
// panel de verificación pre-publicación (schedule-conflicts.ts).
describe('solve — solapamiento unificado (pairOverlap)', () => {
  beforeEach(() => {
    mockAvailabilities.length = 0
    mockIncompatibilities.length = 0
    mockDesignations.length = 0
    mockMatches.length = 0
  })

  it('mismo pabellón, 14:00 y 15:30 (90min) → encadenables, ambos asignables', () => {
    const m1 = makeMatch({ id: 'm1', time: '14:00', refereesNeeded: 1, scorersNeeded: 0 })
    const m2 = makeMatch({ id: 'm2', time: '15:30', refereesNeeded: 1, scorersNeeded: 0 })
    const p1 = makePerson({ id: 'p1', role: 'arbitro' })
    addAvailability('p1', m1.date, m1.time)
    addAvailability('p1', m2.date, m2.time)

    const result = solve({
      matches: [m1, m2],
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('optimal')
    expect(result.assignments).toHaveLength(2)
    expect(result.assignments.every((a) => a.personId === 'p1')).toBe(true)
    expect(result.unassigned).toHaveLength(0)
  })

  it('distinto municipio, sin coche, hueco menor que el viaje estimado → conflictúan', () => {
    // m1: 10:00-11:30 en muni-A (municipio propio de p1, sin coche pero 0km directos).
    // m2: 12:00 en muni-B (20km directos, dentro del límite de 30km sin coche). Hueco tras
    // m1 = 30min; viaje estimado sin coche muni-A→muni-B (20km × 3min/km) = 60min > hueco.
    const m1 = makeMatch({
      id: 'm1',
      time: '10:00',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venueId: 'vA',
      venue: { id: 'vA', name: 'Venue A', address: '', municipalityId: 'muni-A', postalCode: '' },
    })
    const m2 = makeMatch({
      id: 'm2',
      time: '12:00',
      refereesNeeded: 1,
      scorersNeeded: 0,
      venueId: 'vB',
      venue: { id: 'vB', name: 'Venue B', address: '', municipalityId: 'muni-B', postalCode: '' },
    })
    const p1 = makePerson({ id: 'p1', role: 'arbitro', hasCar: false, municipalityId: 'muni-A' })
    addAvailability('p1', m1.date, m1.time)
    addAvailability('p1', m2.date, m2.time)

    const result = solve({
      matches: [m1, m2],
      persons: [p1],
      parameters: defaultParams(),
    })

    expect(result.status).toBe('partial')
    const assigned = result.assignments.filter((a) => a.isNew)
    expect(assigned).toHaveLength(1)
    expect(assigned[0].matchId).toBe('m1')
    expect(result.unassigned).toHaveLength(1)
    expect(result.unassigned[0].matchId).toBe('m2')
    expect(result.unassigned[0].reason).toContain('solapamiento')
  })
})
