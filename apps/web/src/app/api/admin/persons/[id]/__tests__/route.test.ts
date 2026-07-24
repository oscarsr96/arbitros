import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  mockVenues,
  type MockDesignation,
} from '@/lib/mock-data'
import { GET } from '../route'
import { GET as reportsGET } from '../../../reports/route'

// Sheet admin de persona (4.4.2): desglose por día + honorarios de temporada,
// además del desplazamiento que ya se mostraba. Fechas de fixture LEJOS de la
// temporada real (mismo patrón que route.fees.test.ts / route.monthly-
// liquidation.test.ts) para no depender de si hay datos reales hidratados.

function makeDesignation(
  id: string,
  matchId: string,
  person: (typeof mockPersons)[number],
): MockDesignation {
  return {
    id,
    matchId,
    personId: person.id,
    role: person.role,
    travelCost: '0',
    distanceKm: '0',
    status: 'notified',
    notifiedAt: null,
    createdAt: new Date(),
  }
}

interface PersonDetailBody {
  byDay: { date: string; travelCost: number; km: number }[]
  totalTravelCost: number
  totalFees: number
  unresolvedFees: number
  totalCost: number
}

interface LoadByPersonEntry {
  personId: string
  totalCost: number
  fees: number
  total: number
}

describe('GET /api/admin/persons/[id]', () => {
  it('byDay suma al total de desplazamiento, honorarios separados, unresolvedFees marcado, y reconcilia con reports (scope=season)', async () => {
    // comp-001 (demoCompetitions) resuelve a la Tabla C (primera_nac_masc,
    // honorario legacy de árbitro = fees.principal = 111,60 €); comp-003 no
    // tiene fila en la Tabla C → unresolvedFees.
    const venue = mockVenues[0]
    const person = mockPersons.find(
      (p) => p.role === 'arbitro' && p.municipalityId !== venue.municipalityId,
    )!
    expect(person).toBeDefined()

    const matchA = {
      ...mockMatches[0],
      id: 'test-pd-match-a',
      date: '2033-04-01',
      venueId: venue.id,
      competitionId: 'comp-001',
    }
    const matchB = {
      ...mockMatches[0],
      id: 'test-pd-match-b',
      date: '2033-04-02',
      venueId: venue.id,
      competitionId: 'comp-003',
    }
    mockMatches.push(matchA, matchB)
    const backupDesignations = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-pd-desig-a', matchA.id, person),
      makeDesignation('test-pd-desig-b', matchB.id, person),
    )

    try {
      const res = await GET(new Request(`http://localhost/api/admin/persons/${person.id}`), {
        params: { id: person.id },
      })
      const data: PersonDetailBody = await res.json()

      // Los 2 partidos son de días distintos → 2 entradas en el desglose.
      const dayA = data.byDay.find((d) => d.date === matchA.date)
      const dayB = data.byDay.find((d) => d.date === matchB.date)
      expect(dayA).toBeDefined()
      expect(dayB).toBeDefined()

      // byDay suma exactamente al total de desplazamiento (mismo agregado que
      // reports: Σ calculateDailyTravelCost por día == totalCost).
      const sumByDay = Number(data.byDay.reduce((s, d) => s + d.travelCost, 0).toFixed(2))
      expect(sumByDay).toBe(data.totalTravelCost)

      // Honorarios: solo comp-001 resuelve.
      expect(data.totalFees).toBeCloseTo(111.6, 2)
      expect(data.unresolvedFees).toBeGreaterThanOrEqual(1)

      // Total de temporada = desplazamiento + honorarios (nunca mezclados en
      // otra parte del cálculo).
      expect(data.totalCost).toBe(Number((data.totalTravelCost + data.totalFees).toFixed(2)))

      // Invariante de reconciliación: reports con scope=season no filtra por
      // fecha (filterMatchesByRange con range vacío devuelve todo), así que
      // agrega exactamente el mismo universo de designaciones de esta persona
      // que el sheet. Los totales deben coincidir persona a persona.
      const reportsRes = await reportsGET(
        new NextRequest('http://localhost/api/admin/reports?scope=season'),
      )
      const reportsBody: { loadByPerson: LoadByPersonEntry[] } = await reportsRes.json()
      const load = reportsBody.loadByPerson.find((p) => p.personId === person.id)
      expect(load).toBeDefined()
      expect(load!.totalCost).toBe(data.totalTravelCost)
      expect(load!.fees).toBeCloseTo(data.totalFees, 2)
      expect(load!.total).toBe(data.totalCost)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backupDesignations)
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === matchA.id),
        1,
      )
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === matchB.id),
        1,
      )
    }
  })

  it('404 si la persona no existe', async () => {
    const res = await GET(new Request('http://localhost/api/admin/persons/no-existe'), {
      params: { id: 'no-existe' },
    })
    expect(res.status).toBe(404)
  })
})
