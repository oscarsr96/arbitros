import { describe, it, expect } from 'vitest'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  getMockDesignationsForPerson,
  getPersonTravelCost,
  DEMO_PERSON_ID,
  type MockDesignation,
} from '@/lib/mock-data'
import { GET } from '../route'

// 4.4.1: historial de temporada del árbitro/anotador logueado (DEMO_PERSON_ID)
// en /api/persons/me. Fixture con 2 designaciones en 2 FECHAS DISTINTAS (para
// probar `byDay`) y 2 COMPETICIONES DISTINTAS (comp-001 resuelve honorario,
// comp-003 no tiene fila en la Tabla C — mismo patrón que
// admin/reports/__tests__/route.fees.test.ts) para cubrir `unresolvedFees`.
//
// Fechas de fixture (2031) fuera de la temporada real (2025-08 a 2026-05) para
// no chocar con designaciones reales de person-001 ya persistidas: al ser las
// más futuras, quedan siempre primeras en el historial (orden "más reciente
// primero"). Las aserciones de fees/unresolvedFees comparan ANTES/DESPUÉS de
// añadir el fixture (delta), no un valor absoluto, porque si hay datos reales
// de temporada ya cargados person-001 puede tener otras designaciones propias.

const HIST_DATE_1 = '2031-06-06'
const HIST_DATE_2 = '2031-06-13'

const person = mockPersons.find((p) => p.id === DEMO_PERSON_ID)!

const matchResolved = {
  ...mockMatches[0],
  id: 'test-hist-match-resolved',
  date: HIST_DATE_1,
  time: '10:00',
  venueId: 'venue-001', // Madrid, mismo municipio que person-001 → fijo, sin km
  competitionId: 'comp-001', // resuelve honorario (principal = 111,60 €)
  homeTeam: 'Equipo Local Hist',
  awayTeam: 'Equipo Visit Hist',
}
const matchUnresolved = {
  ...mockMatches[0],
  id: 'test-hist-match-unresolved',
  date: HIST_DATE_2,
  time: '11:00',
  venueId: 'venue-001',
  competitionId: 'comp-003', // sin fila en la Tabla C → unresolvedFees
  homeTeam: 'Equipo Local Hist 2',
  awayTeam: 'Equipo Visit Hist 2',
}

function makeDesignation(id: string, matchId: string): MockDesignation {
  return {
    id,
    matchId,
    personId: DEMO_PERSON_ID,
    role: person.role,
    travelCost: '0',
    distanceKm: '0',
    status: 'notified',
    notifiedAt: null,
    createdAt: new Date(),
  }
}

describe('GET /api/persons/me — 4.4.1: historial de temporada', () => {
  it('expone designations/byDay/totales y no rompe stats existentes', async () => {
    const before = await (await GET()).json()

    mockMatches.push(matchResolved, matchUnresolved)
    const backupDesignations = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-hist-resolved', matchResolved.id),
      makeDesignation('test-hist-unresolved', matchUnresolved.id),
    )

    try {
      const res = await GET()
      const body = await res.json()

      // `stats` (agregados existentes) sigue presente y sin romperse.
      expect(body.stats).toBeDefined()
      expect(typeof body.stats.totalEarned).toBe('string')

      // Lista de designaciones: incluye las 2 del fixture, más reciente primero
      // (nuestras fechas 2031 son las más futuras de todo el dataset).
      const ids = body.history.designations.map((d: { id: string }) => d.id)
      expect(ids[0]).toBe('test-hist-unresolved') // HIST_DATE_2, más reciente
      expect(ids[1]).toBe('test-hist-resolved') // HIST_DATE_1

      const resolvedRow = body.history.designations.find(
        (d: { id: string }) => d.id === 'test-hist-resolved',
      )
      expect(resolvedRow.date).toBe(HIST_DATE_1)
      expect(resolvedRow.homeTeam).toBe('Equipo Local Hist')
      expect(resolvedRow.venue).toBe('BARAJAS, PDVO.')
      expect(resolvedRow.municipality).toBe('Madrid')
      expect(resolvedRow.status).toBe('notified')

      // byDay: 2 días nuevos, cada uno con fijo Madrid (persona y pabellón en
      // el mismo municipio) — sin kilometraje.
      const day1 = body.history.byDay.find((d: { date: string }) => d.date === HIST_DATE_1)
      const day2 = body.history.byDay.find((d: { date: string }) => d.date === HIST_DATE_2)
      expect(day1).toMatchObject({ cost: 3, km: 0 })
      expect(day2).toMatchObject({ cost: 3, km: 0 })

      // Invariante (4.4.1): travelCost del historial == getPersonTravelCost
      // para TODAS las designaciones actuales de la persona (fuente única).
      const allDesignations = getMockDesignationsForPerson(DEMO_PERSON_ID)
      const expected = getPersonTravelCost(DEMO_PERSON_ID, allDesignations)
      expect(body.history.travelCost).toBeCloseTo(expected.totalCost, 2)
      expect(body.history.totalKm).toBeCloseTo(expected.totalKm, 2)

      // Honorarios: delta frente a "before" aísla el fixture de cualquier dato
      // real de temporada que ya tuviera person-001. Solo comp-001 resuelve.
      expect(body.history.fees - before.history.fees).toBeCloseTo(111.6, 2)
      expect(body.history.unresolvedFees - before.history.unresolvedFees).toBe(1)
      expect(body.history.total).toBeCloseTo(
        Number((body.history.travelCost + body.history.fees).toFixed(2)),
        2,
      )
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backupDesignations)
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === matchResolved.id),
        1,
      )
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === matchUnresolved.id),
        1,
      )
    }
  })
})
