import { describe, it, expect } from 'vitest'
import {
  generateSeasonAvailability,
  ROSTER_MORNING,
  ROSTER_AFTERNOON,
  ROSTER_WEEKDAY_HIGH,
} from '../availability-roster'
import {
  MATCHDAY_MORNING,
  MATCHDAY_AFTERNOON,
  MATCHDAY_WEEKDAY_HIGH,
} from '../matchday-availability'
import { mockPersons, mockMatches, isPersonAvailable } from '../mock-data'
import fbmSeed from '../fbm-calendar/fbm-seed.json'

// ── Fixture pequeño y reproducible para los tests unitarios del generador ───

const SYNTHETIC_PERSONS = Array.from({ length: 200 }, (_, i) => ({
  id: `synthetic-${String(i).padStart(4, '0')}`,
}))

// Fechas reales del calendario FBM (324 partidos, sáb/dom, 2025-09-21 → 2026-03-22)
const REAL_MATCH_DATES = (fbmSeed.matches as { date: string }[]).map((m) => m.date)

describe('generateSeasonAvailability - determinismo', () => {
  it('dos invocaciones con los mismos argumentos devuelven un resultado identico (deep equal)', () => {
    const a = generateSeasonAvailability(SYNTHETIC_PERSONS, REAL_MATCH_DATES)
    const b = generateSeasonAvailability(SYNTHETIC_PERSONS, REAL_MATCH_DATES)
    expect(a).toEqual(b)
  })

  it('no usa Math.random ni Date.now (verificado por reproducibilidad exacta de timestamps)', () => {
    const a = generateSeasonAvailability(SYNTHETIC_PERSONS, REAL_MATCH_DATES)
    const b = generateSeasonAvailability(SYNTHETIC_PERSONS, REAL_MATCH_DATES)
    expect(a.matchdayRecords.map((r) => r.updatedAt)).toEqual(
      b.matchdayRecords.map((r) => r.updatedAt),
    )
  })
})

describe('generateSeasonAvailability - presupuesto de volumen (roster completo real)', () => {
  const result = generateSeasonAvailability(
    mockPersons,
    mockMatches.map((m) => m.date),
  )

  it('mockAvailabilities generado esta dentro del presupuesto 12000-55000', () => {
    expect(result.slots.length).toBeGreaterThanOrEqual(12000)
    expect(result.slots.length).toBeLessThanOrEqual(55000)
  })

  it('toda persona tiene al menos 1 slot en la temporada', () => {
    const personIds = new Set(mockPersons.map((p) => p.id))
    const withSlots = new Set(result.slots.map((s) => s.personId))
    for (const id of personIds) {
      expect(withSlots.has(id)).toBe(true)
    }
  })

  it('ids de slot unicos', () => {
    const ids = result.slots.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('~40 registros matchday de muestra', () => {
    expect(result.matchdayRecords.length).toBeGreaterThan(0)
    expect(result.matchdayRecords.length).toBeLessThanOrEqual(40)
    expect(result.matchdayRecords.length).toBeGreaterThanOrEqual(30)
  })

  it('los 12 arquetipos estan representados, pesos +-3 pts sobre 1279 personas', () => {
    const total = mockPersons.length
    const weights: Record<number, number> = {
      1: 10,
      2: 18,
      3: 10,
      4: 8,
      5: 12,
      6: 8,
      7: 6,
      8: 8,
      9: 6,
      10: 8,
      11: 4,
      12: 2,
    }
    for (let id = 1; id <= 12; id++) {
      expect(result.archetypeCounts[id]).toBeGreaterThan(0)
      const actualPct = ((result.archetypeCounts[id] ?? 0) / total) * 100
      expect(Math.abs(actualPct - weights[id])).toBeLessThanOrEqual(3)
    }
  })

  it('matchday seeds coherentes con los slots del mismo par persona/jornada', () => {
    for (const record of result.matchdayRecords) {
      const expectedFlags: { dayOfWeek: number; startTime: string }[] = []
      if (record.saturdayMorning)
        expectedFlags.push({ dayOfWeek: 5, startTime: ROSTER_MORNING.startTime })
      if (record.saturdayAfternoon)
        expectedFlags.push({ dayOfWeek: 5, startTime: ROSTER_AFTERNOON.startTime })
      if (record.sundayMorning)
        expectedFlags.push({ dayOfWeek: 6, startTime: ROSTER_MORNING.startTime })
      if (record.sundayAfternoon)
        expectedFlags.push({ dayOfWeek: 6, startTime: ROSTER_AFTERNOON.startTime })
      for (const wd of record.weekdayDays) {
        expectedFlags.push({ dayOfWeek: wd, startTime: ROSTER_WEEKDAY_HIGH.startTime })
      }

      const personSlots = result.slots.filter((s) => s.personId === record.personId)
      for (const flag of expectedFlags) {
        const found = personSlots.some(
          (s) => s.dayOfWeek === flag.dayOfWeek && s.startTime === flag.startTime,
        )
        expect(found).toBe(true)
      }
    }
  })
})

describe('generateSeasonAvailability - franjas anti-drift', () => {
  it('las franjas locales del modulo hoja == constantes MATCHDAY_* de matchday-availability.ts', () => {
    expect(ROSTER_MORNING).toEqual(MATCHDAY_MORNING)
    expect(ROSTER_AFTERNOON).toEqual(MATCHDAY_AFTERNOON)
    expect(ROSTER_WEEKDAY_HIGH).toEqual(MATCHDAY_WEEKDAY_HIGH)
  })
})

describe('generateSeasonAvailability - cobertura de candidatos (integracion con mock-data)', () => {
  // Partidos reales de tarde (18:00-20:00), sabado y domingo
  const afternoonMatches = mockMatches
    .filter((m) => {
      const hour = parseInt(m.time.split(':')[0], 10)
      const d = new Date(m.date + 'T00:00:00')
      const dow = d.getDay()
      return hour >= 18 && hour < 20 && (dow === 6 || dow === 0)
    })
    .slice(0, 25)

  it('hay al menos 20 partidos de tarde de muestra', () => {
    expect(afternoonMatches.length).toBeGreaterThanOrEqual(20)
  })

  it('cada partido de tarde de la muestra tiene >=50 arbitros y >=30 anotadores disponibles', () => {
    const referees = mockPersons.filter((p) => p.role === 'arbitro')
    const scorers = mockPersons.filter((p) => p.role === 'anotador')

    for (const match of afternoonMatches) {
      const availableRefs = referees.filter((p) => isPersonAvailable(p.id, match.date, match.time))
      const availableScorers = scorers.filter((p) =>
        isPersonAvailable(p.id, match.date, match.time),
      )
      expect(availableRefs.length).toBeGreaterThanOrEqual(50)
      expect(availableScorers.length).toBeGreaterThanOrEqual(30)
    }
  })

  it('partidos de las 13:00 tienen al menos 10 candidatos disponibles', () => {
    const noonMatches = mockMatches.filter((m) => m.time === '13:00')
    expect(noonMatches.length).toBeGreaterThan(0)

    for (const match of noonMatches) {
      const candidates = mockPersons.filter((p) => isPersonAvailable(p.id, match.date, match.time))
      expect(candidates.length).toBeGreaterThanOrEqual(10)
    }
  })
})
