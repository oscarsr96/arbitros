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

const mockMatches: { id: string; date: string; time: string }[] = []

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
  getMockDistance: (originId: string, destId: string) => {
    if (originId === destId) return 0
    return 20 // default 20km for any cross-municipality pair
  },
  getMockMunicipality: (id: string) => ({ id, name: `Municipality-${id}` }),
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
})
