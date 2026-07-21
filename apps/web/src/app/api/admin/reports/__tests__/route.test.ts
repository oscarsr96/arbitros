import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  mockHistoricalMatchdays,
  type MockDesignation,
} from '@/lib/mock-data'
import { GET } from '../route'

// Antes CURRENT_MATCHDAY era un literal (15): TODAS las designaciones reales
// (temporada entera, 24.508 partidos) se etiquetaban como una única jornada
// "actual" ficticia, así que summary.totalMatches/totalCost reportaban la
// temporada completa como si fuera la jornada de hoy. Estos tests verifican
// que `summary` se resuelve con la jornada FBM real (viernes→jueves) y que
// costByMatchday/monthlyLiquidation SIGUEN agregando por temporada/mes (eso
// es correcto por diseño, ver CLAUDE.md Fase 4: no se acotan).

describe('GET /api/admin/reports — fuera de temporada (hoy real, 2026-07-21)', () => {
  it('summary cae a la última jornada con partidos, nunca a la temporada entera', async () => {
    const res = await GET()
    const body = await res.json()

    // La temporada real termina el 2026-05-10: "hoy" (2026-07-21) cae fuera
    // por el final, así que el valor por defecto es la ÚLTIMA jornada jugada.
    const inWindow = mockMatches.filter((m) => m.date >= '2026-05-08' && m.date <= '2026-05-14')
    expect(inWindow.length).toBeGreaterThan(0)
    expect(body.summary.totalMatches).toBe(inWindow.length)
    expect(body.summary.totalMatches).toBeLessThan(mockMatches.length)
    expect(body.summary.matchday).toBe(inWindow[0].matchday)
  })

  it('invariante: cubiertos + parciales + sin cubrir = total', async () => {
    const res = await GET()
    const { summary } = await res.json()
    expect(summary.covered + summary.partial + summary.uncovered).toBe(summary.totalMatches)
  })
})

describe('GET /api/admin/reports — dentro de temporada', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-29T10:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('summary usa la jornada de HOY cuando tiene partidos', async () => {
    const res = await GET()
    const body = await res.json()
    const inWindow = mockMatches.filter((m) => m.date >= '2025-09-26' && m.date <= '2025-10-02')
    expect(inWindow.length).toBeGreaterThan(0)
    expect(body.summary.totalMatches).toBe(inWindow.length)
    expect(body.summary.matchday).toBe(inWindow[0].matchday)
  })
})

describe('GET /api/admin/reports — agregación de temporada/mes (NO se acota)', () => {
  it('costByMatchday y monthlyLiquidation cubren más de una jornada cuando hay designaciones en varias', async () => {
    // Dos designaciones sintéticas en jornadas reales distintas (matchday 1 y
    // matchday 2, según el seed): si costByMatchday se hubiese acotado a la
    // jornada actual (como dashboard/optimize) solo aparecería una.
    const m1 = mockMatches.find((m) => m.matchday === 1)
    const m2 = mockMatches.find((m) => m.matchday === 2)
    expect(m1).toBeDefined()
    expect(m2).toBeDefined()
    const person = mockPersons[0]

    const backup = [...mockDesignations]
    mockDesignations.push(
      {
        id: 'test-md1',
        matchId: m1!.id,
        personId: person.id,
        role: person.role,
        travelCost: '0',
        distanceKm: '0',
        status: 'notified',
        notifiedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'test-md2',
        matchId: m2!.id,
        personId: person.id,
        role: person.role,
        travelCost: '0',
        distanceKm: '0',
        status: 'notified',
        notifiedAt: null,
        createdAt: new Date(),
      },
    )
    try {
      const res = await GET()
      const body = await res.json()
      const matchdaysPresent = body.costByMatchday.map((c: { matchday: number }) => c.matchday)
      expect(matchdaysPresent).toContain(1)
      expect(matchdaysPresent).toContain(2)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backup)
    }
  })

  it('mockHistoricalMatchdays (jornadas demo 13/14) no se mezcla con los matchday reales 13/14', async () => {
    // La temporada real ya cubre matchday 1-26, incluidos 13 y 14: son los
    // mismos números que usa el fixture legacy mockHistoricalMatchdays. Sin
    // designaciones reales, costByMatchday debe quedar vacío (ninguna
    // designación real + histórico descartado por colisión), no las 2
    // entradas fantasma de mockHistoricalMatchdays.
    expect(mockHistoricalMatchdays.some((h) => h.matchday === 13)).toBe(true)
    expect(mockMatches.some((m) => m.matchday === 13)).toBe(true)

    const backup = [...mockDesignations]
    mockDesignations.length = 0
    try {
      const res = await GET()
      const body = await res.json()
      expect(body.costByMatchday).toEqual([])
      expect(body.monthlyLiquidation).toEqual([])
    } finally {
      mockDesignations.push(...backup)
    }
  })
})

describe('GET /api/admin/reports — rendimiento con temporada completa designada', () => {
  it('sin cuadráticos: handler completo (índices + agregación de toda la temporada) en tiempo acotado', async () => {
    // Volumen real: TODOS los partidos de la temporada designados (no solo
    // una jornada, a diferencia de dashboard/optimize: reports agrega por
    // temporada por diseño). Antes del índice, esto tardaba ~82 s (medido);
    // con el índice baja a ~0,4-0,9 s. El umbral se deja holgado (bien por
    // encima de lo medido) para no volverse flaky en máquina compartida:
    // sigue siendo ~100x más rápido que sin índice, aunque no llega al
    // objetivo de <200 ms del plan (ver informe de la tarea R2 — el resto
    // es trabajo real de serialización de la temporada completa, no un
    // cuadrático oculto).
    const originalLength = mockDesignations.length
    const referees = mockPersons.filter((p) => p.role === 'arbitro')
    const scorers = mockPersons.filter((p) => p.role === 'anotador')
    let ri = 0
    let si = 0
    const synthetic: MockDesignation[] = []
    for (const m of mockMatches) {
      for (let i = 0; i < m.refereesNeeded; i++) {
        const p = referees[ri++ % referees.length]
        synthetic.push({
          id: `perf-r-${synthetic.length}`,
          matchId: m.id,
          personId: p.id,
          role: 'arbitro',
          travelCost: '0',
          distanceKm: '0',
          status: 'notified',
          notifiedAt: null,
          createdAt: new Date(),
        })
      }
      for (let i = 0; i < m.scorersNeeded; i++) {
        const p = scorers[si++ % scorers.length]
        synthetic.push({
          id: `perf-s-${synthetic.length}`,
          matchId: m.id,
          personId: p.id,
          role: 'anotador',
          travelCost: '0',
          distanceKm: '0',
          status: 'notified',
          notifiedAt: null,
          createdAt: new Date(),
        })
      }
    }
    mockDesignations.push(...synthetic)

    try {
      const t0 = performance.now()
      const res = await GET()
      const ms = performance.now() - t0
      const body = await res.json()

      console.log(
        `reports GET: ${ms.toFixed(1)} ms, ${mockMatches.length} partidos, ` +
          `${mockDesignations.length} designaciones en memoria`,
      )
      expect(res.status).toBe(200)
      expect(body.liquidation.length).toBeGreaterThan(0)
      expect(ms).toBeLessThan(2000)
    } finally {
      mockDesignations.length = originalLength
    }
  }, 60_000)
})
