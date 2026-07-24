import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { mockMatches, mockDesignations, mockPersons, type MockDesignation } from '@/lib/mock-data'
import { getJornadaSaturdayForDate } from '@/lib/matchday-availability'
import { ensureDesignationsHydrated } from '@/lib/designation-persistence'
import { GET } from '../route'

// Honorarios en la API de reportes (tarea 4.1.4): concepto SEPARADO del
// desplazamiento (ver designation-fees.ts). Dos cosas se prueban aquí:
//   1. `fees`/`total`/`unresolvedFees` en loadByPerson y liquidation, con un
//      fixture de 2 designaciones de categorías DISTINTAS: una resuelve a la
//      Tabla C de las Bases, la otra no tiene fila (unresolvedFees, nunca
//      0 € silencioso).
//   2. Invariante de no-regresión: el desplazamiento reportado (mismo
//      summary.totalCost que route.real-data.test.ts, fix P6) para la
//      ventana real 2025-10-25 sigue siendo EXACTAMENTE 6.076,70 € tras
//      añadir honorarios: el desplazamiento no cambia ni un céntimo.

ensureDesignationsHydrated()
const hasRealData = mockDesignations.length > 0

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

// Fecha de fixture propia, fuera de la temporada real (2025-08 a 2026-05, ver
// route.test.ts) para no mezclarse con partidos/designaciones reales de la
// ventana elegida.
const FEE_TEST_DATE = '2030-06-07'
const FEE_TEST_SATURDAY = getJornadaSaturdayForDate(FEE_TEST_DATE)

// comp-001 y comp-003 son competiciones DEMO (`demoCompetitions` en
// mock-data.ts), siempre presentes en `mockCompetitions` junto a las reales
// del calendario FBM importado, así que su resolución de honorarios es
// determinista sin importar qué temporada esté cargada:
//   - comp-001 'Liga VIPS Masculina' → basesCategory 'primera_nac_masc';
//     honorario de árbitro legacy (sin `position`) = fees.principal = 111,60 €.
//   - comp-003 'Sub-22 Masculina' (sin nivel ORO/PLATA/BRONCE ni en el nombre
//     ni en `category: 'sub22'`) → ninguna regla de category-mapping.ts
//     resuelve fila de Bases → `fee: null`, cuenta en unresolvedFees.
const feeMatchResolved = {
  ...mockMatches[0],
  id: 'test-fee-match-resolved',
  date: FEE_TEST_DATE,
  competitionId: 'comp-001',
}
const feeMatchUnresolved = {
  ...mockMatches[0],
  id: 'test-fee-match-unresolved',
  date: FEE_TEST_DATE,
  competitionId: 'comp-003',
}

describe('GET /api/admin/reports — 4.1.4: honorarios (fees), concepto separado del desplazamiento', () => {
  it('loadByPerson y liquidation exponen fees/total/unresolvedFees con 2 designaciones de categorías distintas', async () => {
    const person = mockPersons.find((p) => p.role === 'arbitro')!
    mockMatches.push(feeMatchResolved, feeMatchUnresolved)
    const backupDesignations = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-fee-resolved', feeMatchResolved.id, person),
      makeDesignation('test-fee-unresolved', feeMatchUnresolved.id, person),
    )
    try {
      const res = await GET(makeRequest(`?jornada=${FEE_TEST_SATURDAY}`))
      const body = await res.json()

      const load = body.loadByPerson.find((p: { personId: string }) => p.personId === person.id)
      expect(load).toBeDefined()
      // Solo la designación de comp-001 resuelve; la de comp-003 no.
      expect(load.fees).toBeCloseTo(111.6, 2)
      expect(load.unresolvedFees).toBe(1)
      expect(load.total).toBeCloseTo(Number((load.totalCost + load.fees).toFixed(2)), 2)

      const liq = body.liquidation.find((p: { personId: string }) => p.personId === person.id)
      expect(liq).toBeDefined()
      expect(liq.fees).toBeCloseTo(111.6, 2)
      expect(liq.unresolvedFees).toBe(1)
      expect(liq.total).toBeCloseTo(Number((liq.totalCost + liq.fees).toFixed(2)), 2)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backupDesignations)
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === feeMatchResolved.id),
        1,
      )
      mockMatches.splice(
        mockMatches.findIndex((m) => m.id === feeMatchUnresolved.id),
        1,
      )
    }
  })
})

describe.skipIf(!hasRealData)(
  'GET /api/admin/reports — 4.1.4: invariante de no-regresión de desplazamiento',
  () => {
    it('summary.totalCost de la ventana real 2025-10-25 sigue siendo 6.076,70 € tras añadir honorarios', async () => {
      const res = await GET(makeRequest('?jornada=2025-10-25'))
      const body = await res.json()
      expect(body.summary.totalCost).toBeCloseTo(6076.7, 2)
    })
  },
)
