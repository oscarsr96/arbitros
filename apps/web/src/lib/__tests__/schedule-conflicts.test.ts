import { describe, it, expect } from 'vitest'
import {
  detectDayConflicts,
  getPublishConflicts,
  MATCH_DURATION_MIN,
  CONFLICT_MARGIN_MIN,
  type DayConflictEntry,
  type PublishConflictDesignation,
  type PublishConflictHelpers,
} from '../schedule-conflicts'

// ── Helpers de test ──────────────────────────────────────────────────────────

function entry(
  overrides: Partial<DayConflictEntry> & Pick<DayConflictEntry, 'matchId' | 'startMin'>,
): DayConflictEntry {
  return {
    personId: 'person-1',
    date: '2026-01-10',
    venueId: 'venue-a',
    municipalityId: 'muni-a',
    hasCar: true,
    ...overrides,
  }
}

// Distancia fija de 20km entre muni-a y muni-b (usada por la mayoría de los tests):
// coche → ceil(20*1.5)=30min de viaje; sin coche → ceil(20*3)=60min.
const getDistance20km = () => 20

describe('detectDayConflicts', () => {
  it('marca error de solape cuando dos partidos se solapan en el tiempo', () => {
    const entries = [
      entry({ matchId: 'm-a', startMin: 600, venueId: 'venue-a', municipalityId: 'muni-a' }), // 10:00-11:30
      entry({ matchId: 'm-b', startMin: 650, venueId: 'venue-b', municipalityId: 'muni-b' }), // 10:50, solapa
    ]

    const conflicts = detectDayConflicts(entries, getDistance20km)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      severity: 'error',
      reason: 'overlap',
      matchAId: 'm-a',
      matchBId: 'm-b',
    })
  })

  it('marca error de solape incluso en el mismo pabellón (nadie pita dos pistas a la vez)', () => {
    const entries = [
      entry({ matchId: 'm-a', startMin: 600, venueId: 'venue-a', municipalityId: 'muni-a' }),
      entry({ matchId: 'm-b', startMin: 640, venueId: 'venue-a', municipalityId: 'muni-a' }), // solapa, mismo pabellón
    ]

    const conflicts = detectDayConflicts(entries, getDistance20km)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].severity).toBe('error')
    expect(conflicts[0].reason).toBe('overlap')
  })

  it('marca error cuando el hueco entre partidos consecutivos es menor que el viaje necesario', () => {
    // A: 600-690 (10:00-11:30). B empieza a los 700 → hueco de 10min.
    // Viaje estimado (20km, coche) = ceil(20*1.5) = 30min > hueco.
    const entries = [
      entry({ matchId: 'm-a', startMin: 600, venueId: 'venue-a', municipalityId: 'muni-a' }),
      entry({ matchId: 'm-b', startMin: 700, venueId: 'venue-b', municipalityId: 'muni-b' }),
    ]

    const conflicts = detectDayConflicts(entries, getDistance20km)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      severity: 'error',
      reason: 'insufficient-gap',
      matchAId: 'm-a',
      matchBId: 'm-b',
      gapMin: 10,
      travelMin: 30,
    })
  })

  it('marca aviso cuando el hueco es justo (>= viaje pero < viaje + margen)', () => {
    // A termina en 690. Viaje = 30min. Hueco = 35min → dentro de [30, 60).
    const entries = [
      entry({ matchId: 'm-a', startMin: 600, venueId: 'venue-a', municipalityId: 'muni-a' }),
      entry({ matchId: 'm-b', startMin: 725, venueId: 'venue-b', municipalityId: 'muni-b' }),
    ]

    const conflicts = detectDayConflicts(entries, getDistance20km)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      severity: 'warning',
      reason: 'tight-gap',
      gapMin: 35,
      travelMin: 30,
    })
  })

  it('no marca conflicto cuando el hueco es amplio', () => {
    // A termina en 690. Viaje = 30min. Hueco = 100min >= 30+30.
    const entries = [
      entry({ matchId: 'm-a', startMin: 600, venueId: 'venue-a', municipalityId: 'muni-a' }),
      entry({ matchId: 'm-b', startMin: 790, venueId: 'venue-b', municipalityId: 'muni-b' }),
    ]

    const conflicts = detectDayConflicts(entries, getDistance20km)

    expect(conflicts).toHaveLength(0)
  })

  it('exime del aviso de hueco corto cuando es el mismo pabellón (encadenar es deseable)', () => {
    // Mismo venueId → viaje=0. Hueco de 5min sería aviso (5 < 0+30) si no estuviera exento.
    const entries = [
      entry({ matchId: 'm-a', startMin: 600, venueId: 'venue-a', municipalityId: 'muni-a' }),
      entry({ matchId: 'm-b', startMin: 695, venueId: 'venue-a', municipalityId: 'muni-a' }),
    ]

    const conflicts = detectDayConflicts(entries, getDistance20km)

    expect(conflicts).toHaveLength(0)
  })

  it('sin coche el mismo hueco pasa de aviso a error (viaje más lento)', () => {
    // Hueco fijo de 35min. Con coche (30min viaje) es aviso; sin coche (60min viaje) es error.
    const withCar = [
      entry({
        matchId: 'm-a',
        startMin: 600,
        venueId: 'venue-a',
        municipalityId: 'muni-a',
        hasCar: true,
      }),
      entry({
        matchId: 'm-b',
        startMin: 725,
        venueId: 'venue-b',
        municipalityId: 'muni-b',
        hasCar: true,
      }),
    ]
    const withoutCar = [
      entry({
        matchId: 'm-a',
        startMin: 600,
        venueId: 'venue-a',
        municipalityId: 'muni-a',
        hasCar: false,
      }),
      entry({
        matchId: 'm-b',
        startMin: 725,
        venueId: 'venue-b',
        municipalityId: 'muni-b',
        hasCar: false,
      }),
    ]

    const carConflicts = detectDayConflicts(withCar, getDistance20km)
    const noCarConflicts = detectDayConflicts(withoutCar, getDistance20km)

    expect(carConflicts[0]).toMatchObject({
      severity: 'warning',
      reason: 'tight-gap',
      travelMin: 30,
    })
    expect(noCarConflicts[0]).toMatchObject({
      severity: 'error',
      reason: 'insufficient-gap',
      travelMin: 60,
    })
  })

  it('no genera conflictos con menos de dos partidos', () => {
    expect(detectDayConflicts([], getDistance20km)).toEqual([])
    expect(detectDayConflicts([entry({ matchId: 'm-a', startMin: 600 })], getDistance20km)).toEqual(
      [],
    )
  })

  it('usa las constantes documentadas', () => {
    expect(MATCH_DURATION_MIN).toBe(90)
    expect(CONFLICT_MARGIN_MIN).toBe(30)
  })
})

// ── getPublishConflicts (wrapper) ────────────────────────────────────────────

describe('getPublishConflicts', () => {
  const matches: Record<string, { date: string; time: string; venueId: string }> = {
    'match-1': { date: '2026-01-10', time: '10:00', venueId: 'venue-a' }, // person1, día 1
    'match-2': { date: '2026-01-10', time: '11:20', venueId: 'venue-b' }, // person1, día 1, solapa con match-1
    'match-3': { date: '2026-01-11', time: '09:00', venueId: 'venue-a' }, // person1, día 2 (sin cruce)
    'match-4': { date: '2026-01-10', time: '10:00', venueId: 'venue-a' }, // person2, día 1 (sin cruce)
    'match-5': { date: '2026-01-10', time: '10:15', venueId: 'venue-c' }, // person1, día 1, solaparía si no estuviera rechazada
  }

  const venueMunicipality: Record<string, string> = {
    'venue-a': 'muni-a',
    'venue-b': 'muni-b',
    'venue-c': 'muni-c',
  }

  const persons: Record<
    string,
    { name?: string; nick?: string | null; hasCar: boolean; municipalityId: string }
  > = {
    'person-1': { name: 'Ana', nick: 'ANA', hasCar: true, municipalityId: 'muni-a' },
    'person-2': { name: 'Bea', nick: null, hasCar: true, municipalityId: 'muni-a' },
  }

  const helpers: PublishConflictHelpers = {
    getMatch: (matchId) => matches[matchId],
    getVenueMunicipality: (venueId) => venueMunicipality[venueId],
    getPerson: (personId) => persons[personId],
    getDistanceKm: () => 20,
  }

  it('agrupa por persona/fecha sin cruces y detecta el solape real', () => {
    const designations: PublishConflictDesignation[] = [
      { matchId: 'match-1', personId: 'person-1', status: 'pending' },
      { matchId: 'match-2', personId: 'person-1', status: 'pending' },
      { matchId: 'match-3', personId: 'person-1', status: 'pending' },
      { matchId: 'match-4', personId: 'person-2', status: 'pending' },
    ]

    const conflicts = getPublishConflicts(designations, helpers)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      personId: 'person-1',
      personName: 'Ana',
      personNick: 'ANA',
      date: '2026-01-10',
      matchAId: 'match-1',
      matchBId: 'match-2',
      severity: 'error',
      reason: 'overlap',
    })
  })

  it('ignora las designaciones con status "rejected"', () => {
    const designations: PublishConflictDesignation[] = [
      { matchId: 'match-1', personId: 'person-1', status: 'pending' },
      { matchId: 'match-5', personId: 'person-1', status: 'rejected' },
    ]

    const conflicts = getPublishConflicts(designations, helpers)

    expect(conflicts).toEqual([])
  })
})
