import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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
      const res = await GET()
      const body = await res.json()

      expect(body.summary.totalMatches).toBeGreaterThan(0)
      expect(body.costByMatchday.length).toBeGreaterThan(0)
      expect(body.liquidation.length).toBeGreaterThan(0)
    })

    it('invariante de cobertura: covered + partial + uncovered == totalMatches', async () => {
      const res = await GET()
      const { summary } = await res.json()

      expect(summary.covered + summary.partial + summary.uncovered).toBe(summary.totalMatches)
    })

    it('aritmética de summary.totalCost: coincide con calculateDailyTravelCost/calculatePersonTravelCost para el subconjunto que el route realmente suma', async () => {
      // El route calcula `currentMatchday` como `windowMatches[0]?.matchday` y
      // filtra `totalCost` por ESE número de matchday (route.ts:39, 136-138),
      // NO por la ventana de fechas completa (ver el siguiente test, que
      // documenta que esto es un bug con datos reales). Este test valida que,
      // DADO ese filtro (el que el route realmente aplica), la suma coincide
      // con la fuente de la verdad de coste (`calculatePersonTravelCost` →
      // `calculateDailyTravelCost`) — es decir, que no hay un segundo bug de
      // aritmética/redondeo por encima del bug de ventana.
      const res = await GET()
      const body = await res.json()

      const matchesById = new Map(mockMatches.map((m) => [m.id, m] as const))
      const venuesById = new Map(mockVenues.map((v) => [v.id, v] as const))
      const personsById = new Map(mockPersons.map((p) => [p.id, p] as const))
      const sameMatchdayIds = new Set(
        mockMatches.filter((m) => m.matchday === body.summary.matchday).map((m) => m.id),
      )

      const itemsByPerson = new Map<string, { date: string; venueMunicipalityId: string }[]>()
      for (const d of mockDesignations as MockDesignation[]) {
        if (!sameMatchdayIds.has(d.matchId)) continue
        const match = matchesById.get(d.matchId)
        if (!match) continue
        const venue = venuesById.get(match.venueId)
        const list = itemsByPerson.get(d.personId) ?? []
        list.push({ date: match.date, venueMunicipalityId: venue?.municipalityId ?? '' })
        itemsByPerson.set(d.personId, list)
      }

      let expectedTotal = 0
      for (const [personId, items] of itemsByPerson) {
        const person = personsById.get(personId)
        expectedTotal += calculatePersonTravelCost(person?.municipalityId ?? '', items).totalCost
      }
      expectedTotal = Number(expectedTotal.toFixed(2))

      expect(body.summary.totalCost).toBe(expectedTotal)
    })

    // BLOQUEANTE (hallazgo de este smoke, no se ha tocado route.ts): `summary`
    // documenta ser "coste/cobertura de la jornada que el designador está
    // trabajando ahora mismo" (route.ts:24-28) y `totalMatches`/`covered`/
    // `partial`/`uncovered` SÍ están correctamente acotados a toda la ventana
    // viernes→jueves (windowMatches, 1.309 partidos para esta jornada). Pero
    // `totalCost` filtra por `matchday === currentMatchday`, un ÚNICO número de
    // matchday (route.ts:39, 136-138) bajo el supuesto "todos sus partidos
    // comparten matchday" (comentario en route.ts:36-38).
    //
    // Ese supuesto es FALSO con los datos reales: `matchday` es un contador
    // POR COMPETICIÓN (cada una lleva su propia numeración de jornada), no un
    // índice global de calendario. La ventana 2025-10-24→2025-10-30 contiene
    // 1.309 partidos de 48 competiciones distintas repartidos en matchday
    // {1,2,3,4,5,6} (verificado con el calendario real). El route se queda solo
    // con el primer valor que encuentra (matchday=2, 539 partidos) e ignora el
    // coste de los otros 5 grupos.
    //
    // Con la jornada 2025-10-25 real: summary.totalCost = 1.975,54 € pero el
    // coste real de TODA la ventana (mismas designaciones reales, misma
    // `calculatePersonTravelCost`) es 6.076,70 € — un infracálculo de ~4.101 €
    // (~67%). No es un caso límite: desde la importación de temporada completa
    // (24.508 partidos, ver memoria `import-temporada-completa`) es el caso
    // NORMAL, porque cualquier jornada real mezcla decenas de competiciones.
    //
    // Se deja como `it.fails`: documenta el bug sin tumbar la suite ni el
    // route; si algún día se corrige la ventana de `totalCost`, este test
    // empezará a pasar inesperadamente y vitest lo señalará para que se
    // actualice/borre.
    it.fails(
      'BUG: summary.totalCost NO reconcilia con el coste real de toda la ventana viernes→jueves (solo suma un matchday de N)',
      async () => {
        const res = await GET()
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
          dateWindowTotal += calculatePersonTravelCost(
            person?.municipalityId ?? '',
            items,
          ).totalCost
        }
        dateWindowTotal = Number(dateWindowTotal.toFixed(2))

        expect(body.summary.totalCost).toBe(dateWindowTotal)
      },
    )
  },
)
