import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  mockVenues,
  calculateDailyTravelCost,
  type MockDesignation,
} from '@/lib/mock-data'
import { GET } from '../route'

// Liquidación mensual (4.3.1): MES NATURAL con desglose por día, honorarios
// incluidos, sin doble-conteo. Sustituye la vieja agregación por bloque de
// jornadas (Nº de matchday). Fechas de fixture LEJOS de la temporada real
// (2032/2031) para no mezclarse con partidos/designaciones reales de la
// temporada importada (mismo patrón que route.fees.test.ts).

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/reports${query}`)
}

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

type MonthlyPerson = {
  personId: string
  days: { date: string; matches: unknown[]; travelCost: number; km: number }[]
  travelCost: number
  fees: number
  total: number
  unresolvedFees: number
}
type MonthlyLiquidation = {
  month: string
  people: MonthlyPerson[]
  totalTravelCost: number
  totalFees: number
  total: number
}

describe('GET /api/admin/reports — 4.3.1: liquidación mensual (mes natural)', () => {
  it('días[].travelCost suma al travelCost de la persona; total = travelCost+fees; Σ personas = total del mes', async () => {
    // comp-001 (demoCompetitions) resuelve a la Tabla C (primera_nac_masc,
    // principal 111,60 €); comp-003 no tiene fila → unresolvedFees.
    const venue = mockVenues[0]
    const person = mockPersons.find(
      (p) => p.role === 'arbitro' && p.municipalityId !== venue.municipalityId,
    )!
    const date = '2032-03-05'
    const matchA = {
      ...mockMatches[0],
      id: 'test-mlq-a',
      date,
      venueId: venue.id,
      competitionId: 'comp-001',
    }
    const matchB = {
      ...mockMatches[0],
      id: 'test-mlq-b',
      date,
      venueId: venue.id,
      competitionId: 'comp-003',
    }
    mockMatches.push(matchA, matchB)
    const backupDesignations = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-mlq-desig-a', matchA.id, person),
      makeDesignation('test-mlq-desig-b', matchB.id, person),
    )
    try {
      const res = await GET(makeRequest('?month=2032-03'))
      const body: { monthlyLiquidation: MonthlyLiquidation } = await res.json()
      const { monthlyLiquidation } = body

      expect(monthlyLiquidation.month).toBe('2032-03')
      const p = monthlyLiquidation.people.find((x) => x.personId === person.id)!
      expect(p).toBeDefined()

      const daysSum = Number(p.days.reduce((s, d) => s + d.travelCost, 0).toFixed(2))
      expect(daysSum).toBeCloseTo(p.travelCost, 2)
      expect(p.total).toBeCloseTo(Number((p.travelCost + p.fees).toFixed(2)), 2)
      expect(p.fees).toBeCloseTo(111.6, 2) // solo comp-001 resuelve
      expect(p.unresolvedFees).toBe(1) // comp-003 no resuelve

      const peopleTotal = Number(
        monthlyLiquidation.people.reduce((s, x) => s + x.total, 0).toFixed(2),
      )
      expect(monthlyLiquidation.total).toBeCloseTo(peopleTotal, 2)
      expect(monthlyLiquidation.totalTravelCost).toBeCloseTo(
        Number(monthlyLiquidation.people.reduce((s, x) => s + x.travelCost, 0).toFixed(2)),
        2,
      )
      expect(monthlyLiquidation.totalFees).toBeCloseTo(
        Number(monthlyLiquidation.people.reduce((s, x) => s + x.fees, 0).toFixed(2)),
        2,
      )
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

  it('doble-conteo: 2 partidos de competiciones DISTINTAS el mismo día → UN solo fijo diario (agrupa por fecha, no por matchday)', async () => {
    const venue = mockVenues[0]
    // Mismo municipio que el pabellón → día "100% en casa": fijo único
    // (Madrid 3€, resto 2€), nunca kilometraje.
    const person = mockPersons.find(
      (p) => p.role === 'arbitro' && p.municipalityId === venue.municipalityId,
    )!
    expect(person).toBeDefined()
    const date = '2032-04-10'
    // Dos competiciones distintas (matchday propio de cada una, aquí
    // deliberadamente iguales entre sí para no depender de él): el bug del
    // cabo 4 agrupaba por (persona, matchday, fecha) y contaba 2 fijos.
    const matchA = {
      ...mockMatches[0],
      id: 'test-mlq-dup-a',
      date,
      venueId: venue.id,
      competitionId: 'comp-001',
    }
    const matchB = {
      ...mockMatches[0],
      id: 'test-mlq-dup-b',
      date,
      venueId: venue.id,
      competitionId: 'comp-003',
    }
    mockMatches.push(matchA, matchB)
    const backupDesignations = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-mlq-dup-desig-a', matchA.id, person),
      makeDesignation('test-mlq-dup-desig-b', matchB.id, person),
    )
    try {
      const res = await GET(makeRequest('?month=2032-04'))
      const body: { monthlyLiquidation: MonthlyLiquidation } = await res.json()
      const p = body.monthlyLiquidation.people.find((x) => x.personId === person.id)!
      expect(p).toBeDefined()

      const dayEntries = p.days.filter((d) => d.date === date)
      expect(dayEntries).toHaveLength(1) // un solo día, no dos grupos
      expect(dayEntries[0].matches).toHaveLength(2) // ambos partidos sí cuentan

      const expectedFlat = calculateDailyTravelCost(person.municipalityId, [
        venue.municipalityId,
        venue.municipalityId,
      ]).cost
      expect(dayEntries[0].travelCost).toBeCloseTo(expectedFlat, 2)
      expect(p.travelCost).toBeCloseTo(expectedFlat, 2) // NO el doble
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

  it('mes que cruza jornada: partido de viernes 31 va a un mes y el de sábado 1 al siguiente', async () => {
    // 2031-01-31 (viernes) y 2031-02-01 (sábado) son el MISMO fin de semana
    // (misma jornada FBM viernes→jueves) pero meses naturales distintos.
    const venue = mockVenues[0]
    const person = mockPersons.find((p) => p.role === 'arbitro')!
    const matchFriday = {
      ...mockMatches[0],
      id: 'test-mlq-cross-fri',
      date: '2031-01-31',
      venueId: venue.id,
      competitionId: 'comp-001',
    }
    const matchSaturday = {
      ...mockMatches[0],
      id: 'test-mlq-cross-sat',
      date: '2031-02-01',
      venueId: venue.id,
      competitionId: 'comp-001',
    }
    mockMatches.push(matchFriday, matchSaturday)
    const backupDesignations = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-mlq-cross-desig-fri', matchFriday.id, person),
      makeDesignation('test-mlq-cross-desig-sat', matchSaturday.id, person),
    )
    try {
      const resJan = await GET(makeRequest('?month=2031-01'))
      const bodyJan: { monthlyLiquidation: MonthlyLiquidation } = await resJan.json()
      const pJan = bodyJan.monthlyLiquidation.people.find((x) => x.personId === person.id)!
      expect(pJan.days.map((d) => d.date)).toEqual(['2031-01-31'])

      const resFeb = await GET(makeRequest('?month=2031-02'))
      const bodyFeb: { monthlyLiquidation: MonthlyLiquidation } = await resFeb.json()
      const pFeb = bodyFeb.monthlyLiquidation.people.find((x) => x.personId === person.id)!
      expect(pFeb.days.map((d) => d.date)).toEqual(['2031-02-01'])
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backupDesignations)
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === matchFriday.id),
        1,
      )
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === matchSaturday.id),
        1,
      )
    }
  })
})
