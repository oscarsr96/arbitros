import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  mockDesignations,
  mockMatches,
  mockPersons,
  mockVenues,
  calculatePersonTravelCost,
  type MockDesignation,
} from '@/lib/mock-data'
import { ensureDesignationsHydrated } from '@/lib/designation-persistence'
import { GET } from '../route'

// Smoke E2E con datos REALES persistidos en disco (tarea 4.0.2 del plan Fase 4).
//
// A diferencia de route.test.ts (que arranca con `mockDesignations` vacío y
// empuja fixtures sintéticos por test), este fichero hidrata desde
// `apps/web/.fbm-data/designations.json` por el MISMO camino que usa el
// servidor real (`ensureDesignationsHydrated`, disparado en producción desde
// `instrumentation.ts`). NO se fija `FBM_DATA_DIR`: con
// `pnpm --filter @fbm/web test`, cwd = apps/web, así que el default
// `<cwd>/.fbm-data` de designation-persistence.ts resuelve al fichero real
// (2.576 designaciones tras la regeneración de la tarea 4.0.1), no a un
// fixture ni a un directorio temporal.
// Hidratar en carga de módulo (idempotente) para decidir si ESTA máquina tiene
// datos reales. `.fbm-data/` está gitignoreado: en un checkout limpio o en CI
// no existe, así que sin este guard la suite se pondría roja en cualquier
// máquina que no sea el piloto. Con datos → corre; sin datos → skip limpio.
ensureDesignationsHydrated()
const hasRealData = mockDesignations.length > 0

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/reports${query}`)
}

describe.skipIf(!hasRealData)(
  'GET /api/admin/reports — smoke con designaciones reales (4.0.2)',
  () => {
    beforeAll(() => {
      vi.useFakeTimers()
      // Lunes dentro de la ventana viernes→jueves de la jornada designada
      // 2025-10-25 (ventana 2025-10-24 → 2025-10-30, status 'completed' según 4.0.1).
      vi.setSystemTime(new Date('2025-10-27T12:00:00'))
    })

    afterAll(() => {
      vi.useRealTimers()
    })

    it('hidrata designaciones reales del piloto desde disco (no un fixture ni sesión demo)', () => {
      // Exacto hoy: 2.576 (regeneración 4.0.1). Se comprueba >0 en vez del número
      // exacto para no acoplar el test a una regeneración futura de `.fbm-data`.
      expect(mockDesignations.length).toBeGreaterThan(0)
    })

    it('summary, costByMatchday y liquidation no están vacíos', async () => {
      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.summary.totalMatches).toBeGreaterThan(0)
      expect(body.costByMatchday.length).toBeGreaterThan(0)
      expect(body.liquidation.length).toBeGreaterThan(0)
    })

    it('invariante de cobertura: covered + partial + uncovered == totalMatches', async () => {
      const res = await GET(makeRequest())
      const { summary } = await res.json()

      expect(summary.covered + summary.partial + summary.uncovered).toBe(summary.totalMatches)
    })

    // FIX P6 (2026-07-24): antes `summary.totalCost` filtraba por
    // `matchday === currentMatchday`, un ÚNICO número de matchday, asumiendo
    // "ventana viernes→jueves = 1 matchday". Ese supuesto es FALSO con datos
    // reales: `matchday` es un contador POR COMPETICIÓN, no un índice global
    // de calendario. La ventana 2025-10-24→2025-10-30 contiene 1.309 partidos
    // de 48 competiciones distintas repartidos en matchday {1,2,3,4,5,6}; el
    // route se quedaba solo con el primer valor que encontraba (matchday=2,
    // 539 partidos) e ignoraba el coste de los otros 5 grupos —
    // infracálculo de ~4.101 € (~67%) medido en esta misma jornada.
    //
    // Ahora `summary.totalCost` se deriva de `loadByPerson` (suma de
    // `calculatePersonTravelCost` por persona, acotado por FECHA REAL de la
    // ventana, nunca por número de matchday), así que reconcilia exactamente
    // con el coste real de TODA la ventana viernes→jueves.
    it('summary.totalCost reconcilia con el coste real de TODA la ventana viernes→jueves (fix P6)', async () => {
      const res = await GET(makeRequest())
      const body = await res.json()

      const dateWindowMatches = mockMatches.filter(
        (m) => m.date >= '2025-10-24' && m.date <= '2025-10-30',
      )
      const matchesById = new Map(mockMatches.map((m) => [m.id, m] as const))
      const venuesById = new Map(mockVenues.map((v) => [v.id, v] as const))
      const personsById = new Map(mockPersons.map((p) => [p.id, p] as const))
      const dateWindowIds = new Set(dateWindowMatches.map((m) => m.id))

      const itemsByPerson = new Map<string, { date: string; venueMunicipalityId: string }[]>()
      for (const d of mockDesignations as MockDesignation[]) {
        if (!dateWindowIds.has(d.matchId)) continue
        const match = matchesById.get(d.matchId)
        if (!match) continue
        const venue = venuesById.get(match.venueId)
        const list = itemsByPerson.get(d.personId) ?? []
        list.push({ date: match.date, venueMunicipalityId: venue?.municipalityId ?? '' })
        itemsByPerson.set(d.personId, list)
      }

      let dateWindowTotal = 0
      for (const [personId, items] of itemsByPerson) {
        const person = personsById.get(personId)
        dateWindowTotal += calculatePersonTravelCost(person?.municipalityId ?? '', items).totalCost
      }
      dateWindowTotal = Number(dateWindowTotal.toFixed(2))

      expect(body.summary.totalCost).toBe(dateWindowTotal)
      // Cifra de referencia medida en 4.0.2/P6 para esta jornada (2025-10-25):
      // 6.076,70 €, MUY por encima del 1.975,54 € que devolvía el route con el
      // bug (solo sumaba un matchday de los 6 mezclados en la ventana).
      expect(body.summary.totalCost).toBeCloseTo(6076.7, 2)
    })
  },
)
