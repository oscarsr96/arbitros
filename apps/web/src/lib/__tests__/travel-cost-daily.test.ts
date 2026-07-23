import { describe, it, expect } from 'vitest'
import {
  calculateDailyTravelCost,
  calculatePersonTravelCost,
  calculateMockTravelCost,
  getMockDistance,
  getPersonTravelCost,
  mockPersons,
  mockMatches,
  getMockVenue,
} from '../mock-data'

// Regla FBM 2026-07-11: coste por persona y día.
// muni-001 = Madrid, muni-008 = Torrejón de Ardoz, muni-007 = Alcalá de Henares.
const MADRID = 'muni-001'
const TORREJON = 'muni-008'
const ALCALA = 'muni-007'
const R = 0.26

const round2 = (n: number) => Number(n.toFixed(2))

describe('calculateDailyTravelCost (regla por día)', () => {
  it('Madrid: día 100% en su municipio → fijo 3€', () => {
    expect(calculateDailyTravelCost(MADRID, [MADRID])).toEqual({ cost: 3, km: 0 })
    // Varios partidos en Madrid el mismo día → sigue siendo 3€ (por día, no por partido)
    expect(calculateDailyTravelCost(MADRID, [MADRID, MADRID])).toEqual({ cost: 3, km: 0 })
  })

  it('Otro municipio (Torrejón): día en su municipio → fijo 2€', () => {
    expect(calculateDailyTravelCost(TORREJON, [TORREJON])).toEqual({ cost: 2, km: 0 })
    expect(calculateDailyTravelCost(TORREJON, [TORREJON, TORREJON])).toEqual({ cost: 2, km: 0 })
  })

  it('Salida a otro municipio → solo kilometraje (sin fijo)', () => {
    const km = getMockDistance(MADRID, TORREJON)
    expect(calculateDailyTravelCost(MADRID, [TORREJON])).toEqual({
      cost: round2(km * R),
      km: Number(km.toFixed(1)),
    })
  })

  it('Día mixto (propio + salida) → SOLO kilometraje de la salida', () => {
    const km = getMockDistance(MADRID, TORREJON)
    // Madrid + Torrejón el mismo día: no se añade el fijo, solo el km a Torrejón
    expect(calculateDailyTravelCost(MADRID, [MADRID, TORREJON])).toEqual({
      cost: round2(km * R),
      km: Number(km.toFixed(1)),
    })
  })

  it('2 partidos en el MISMO municipio de destino → un solo trayecto', () => {
    const km = getMockDistance(MADRID, TORREJON)
    expect(calculateDailyTravelCost(MADRID, [TORREJON, TORREJON])).toEqual({
      cost: round2(km * R),
      km: Number(km.toFixed(1)),
    })
  })

  it('2 municipios de destino distintos → dos trayectos (suma)', () => {
    const km = getMockDistance(MADRID, TORREJON) + getMockDistance(MADRID, ALCALA)
    expect(calculateDailyTravelCost(MADRID, [TORREJON, ALCALA])).toEqual({
      cost: round2(km * R),
      km: Number(km.toFixed(1)),
    })
  })

  it('sin partidos → 0', () => {
    expect(calculateDailyTravelCost(MADRID, [])).toEqual({ cost: 0, km: 0 })
  })
})

describe('calculatePersonTravelCost (agrupa por día)', () => {
  it('suma el coste real de cada día por separado', () => {
    // Día 1: 2 partidos en Madrid (fijo 3). Día 2: salida a Torrejón (km).
    const res = calculatePersonTravelCost(MADRID, [
      { date: '2025-09-27', venueMunicipalityId: MADRID },
      { date: '2025-09-27', venueMunicipalityId: MADRID },
      { date: '2025-09-28', venueMunicipalityId: TORREJON },
    ])
    const kmTorrejon = getMockDistance(MADRID, TORREJON)
    expect(res.byDay).toHaveLength(2)
    expect(res.byDay[0]).toEqual({ date: '2025-09-27', cost: 3, km: 0 })
    expect(res.byDay[1].cost).toBe(round2(kmTorrejon * R))
    expect(res.totalCost).toBe(round2(3 + kmTorrejon * R))
  })
})

describe('coste invariante ante coordenadas reales (distancias reales, tasks/todo.md 2026-07-23)', () => {
  it('dos personas del mismo municipio con distinta coordenada exacta liquidan igual', () => {
    // El coste FBM es SIEMPRE muni→muni (calculateDailyTravelCost solo recibe
    // IDs de municipio); las coordenadas reales persona/pabellón (geo-distance.ts)
    // solo alimentan la feasibility del coche en el solver, nunca la liquidación.
    // Blindaje: busca en el dataset real dos personas del mismo municipio con
    // coordenadas exactas distintas y comprueba que liquidan igual el mismo partido.
    const byMuni = new Map<string, typeof mockPersons>()
    for (const p of mockPersons) {
      if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue
      const list = byMuni.get(p.municipalityId) ?? []
      list.push(p)
      byMuni.set(p.municipalityId, list)
    }
    let personA: (typeof mockPersons)[number] | undefined
    let personB: (typeof mockPersons)[number] | undefined
    for (const list of byMuni.values()) {
      const a = list[0]
      const b = list.find((p) => p.latitude !== a.latitude || p.longitude !== a.longitude)
      if (b) {
        personA = a
        personB = b
        break
      }
    }
    expect(
      personA,
      'el dataset necesita 2 personas del mismo municipio con coords distintas',
    ).toBeDefined()
    expect(personB).toBeDefined()
    expect(personA!.latitude).not.toBe(personB!.latitude)
    expect(personA!.municipalityId).toBe(personB!.municipalityId)

    const match = mockMatches.find((m) => {
      const venue = getMockVenue(m.venueId)
      return venue && venue.municipalityId !== personA!.municipalityId
    })
    expect(match, 'el dataset necesita un partido fuera del municipio de la persona').toBeDefined()

    const costA = getPersonTravelCost(personA!.id, [{ matchId: match!.id }])
    const costB = getPersonTravelCost(personB!.id, [{ matchId: match!.id }])
    expect(costB).toEqual(costA)
  })
})

describe('calculateMockTravelCost (estimación por partido)', () => {
  it('mismo municipio → fijo del municipio (Madrid 3 / resto 2)', () => {
    expect(calculateMockTravelCost(MADRID, MADRID).cost).toBe(3)
    expect(calculateMockTravelCost(TORREJON, TORREJON).cost).toBe(2)
  })
  it('distinto municipio → km × 0,26', () => {
    const km = getMockDistance(MADRID, TORREJON)
    expect(calculateMockTravelCost(MADRID, TORREJON).cost).toBe(round2(km * R))
  })
})
