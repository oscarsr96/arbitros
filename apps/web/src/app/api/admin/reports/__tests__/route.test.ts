import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockMatches, mockDesignations, mockPersons, type MockDesignation } from '@/lib/mock-data'
import { getJornadaSaturdayForDate } from '@/lib/matchday-availability'
import { GET } from '../route'

// Antes CURRENT_MATCHDAY era un literal (15): TODAS las designaciones reales
// (temporada entera, 24.508 partidos) se etiquetaban como una única jornada
// "actual" ficticia, así que summary.totalMatches/totalCost reportaban la
// temporada completa como si fuera la jornada de hoy. Estos tests verifican
// que `summary` se resuelve con la jornada FBM real (viernes→jueves) y que
// costByMatchday/monthlyLiquidation SIGUEN agregando por temporada/mes (eso
// es correcto por diseño, ver CLAUDE.md Fase 4: no se acotan).

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

describe('GET /api/admin/reports — fuera de temporada (hoy real, 2026-07-21)', () => {
  it('summary cae a la última jornada con partidos, nunca a la temporada entera', async () => {
    const res = await GET(makeRequest())
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
    const res = await GET(makeRequest())
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
    const res = await GET(makeRequest())
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
      makeDesignation('test-md1', m1!.id, person),
      makeDesignation('test-md2', m2!.id, person),
    )
    try {
      const res = await GET(makeRequest())
      const body = await res.json()
      const matchdaysPresent = body.costByMatchday.map((c: { matchday: number }) => c.matchday)
      expect(matchdaysPresent).toContain(1)
      expect(matchdaysPresent).toContain(2)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backup)
    }
  })
})

describe('GET /api/admin/reports — 4.2.1: loadByPerson/liquidation acotados a la ventana', () => {
  it('una designación fuera de la ventana pedida NO cuenta en loadByPerson ni en liquidation', async () => {
    const person = mockPersons[0]
    const sorted = [...mockMatches].sort((a, b) => a.date.localeCompare(b.date))
    const inside = sorted[0]
    const outside = sorted[sorted.length - 1]
    const insideSaturday = getJornadaSaturdayForDate(inside.date)
    // Confirma que las dos fechas caen en jornadas distintas: si no, el test
    // no probaría nada (ver memoria: la temporada real cubre ~29 jornadas).
    expect(getJornadaSaturdayForDate(outside.date)).not.toBe(insideSaturday)

    const backup = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-inside', inside.id, person),
      makeDesignation('test-outside', outside.id, person),
    )
    try {
      const res = await GET(makeRequest(`?jornada=${insideSaturday}`))
      const body = await res.json()

      const load = body.loadByPerson.find((p: { personId: string }) => p.personId === person.id)
      expect(load.matchesAssigned).toBe(1)

      const liq = body.liquidation.find((p: { personId: string }) => p.personId === person.id)
      expect(liq.matches).toHaveLength(1)
      expect(liq.matches[0].matchId).toBe(inside.id)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backup)
    }
  })
})

describe('GET /api/admin/reports — 4.2.2: selector de ámbito (jornada/mes/temporada)', () => {
  it('?month=YYYY-MM acota summary/loadByPerson/liquidation al mes natural, no a una jornada', async () => {
    const person = mockPersons[0]
    const sorted = [...mockMatches].sort((a, b) => a.date.localeCompare(b.date))
    const match = sorted[0]
    const month = match.date.slice(0, 7)
    const inMonth = mockMatches.filter((m) => m.date.slice(0, 7) === month)

    const backup = [...mockDesignations]
    mockDesignations.push(makeDesignation('test-month', match.id, person))
    try {
      const res = await GET(makeRequest(`?month=${month}`))
      const body = await res.json()

      expect(body.summary.scope).toBe('month')
      expect(body.summary.matchday).toBeNull()
      expect(body.summary.totalMatches).toBe(inMonth.length)

      const load = body.loadByPerson.find((p: { personId: string }) => p.personId === person.id)
      expect(load.matchesAssigned).toBe(1)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backup)
    }
  })

  it('?scope=season incluye TODAS las designaciones de la persona, sin importar la fecha', async () => {
    const person = mockPersons[0]
    const sorted = [...mockMatches].sort((a, b) => a.date.localeCompare(b.date))
    const early = sorted[0]
    const late = sorted[sorted.length - 1]

    const backup = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-season-early', early.id, person),
      makeDesignation('test-season-late', late.id, person),
    )
    try {
      const res = await GET(makeRequest('?scope=season'))
      const body = await res.json()

      expect(body.summary.scope).toBe('season')
      expect(body.summary.totalMatches).toBe(mockMatches.length)

      const load = body.loadByPerson.find((p: { personId: string }) => p.personId === person.id)
      expect(load.matchesAssigned).toBe(2)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backup)
    }
  })

  it('sin parámetros, el ámbito por defecto sigue siendo "jornada" (compatibilidad)', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.summary.scope).toBe('jornada')
    expect(typeof body.summary.matchday).toBe('number')
  })
})

describe('GET /api/admin/reports — 4.2.3: coste por mes natural', () => {
  it('costByMonth agrega por fecha real de partido (date.slice(0,7)), no por matchday', async () => {
    const sorted = [...mockMatches].sort((a, b) => a.date.localeCompare(b.date))
    const early = sorted[0]
    const late = sorted[sorted.length - 1]
    const earlyMonth = early.date.slice(0, 7)
    const lateMonth = late.date.slice(0, 7)
    expect(earlyMonth).not.toBe(lateMonth)
    const person = mockPersons[0]

    const backup = [...mockDesignations]
    mockDesignations.push(
      makeDesignation('test-cbm-early', early.id, person),
      makeDesignation('test-cbm-late', late.id, person),
    )
    try {
      const res = await GET(makeRequest())
      const body = await res.json()
      const months = body.costByMonth.map((c: { month: string }) => c.month)
      expect(months).toContain(earlyMonth)
      expect(months).toContain(lateMonth)
      const totalMatchesInMonths = body.costByMonth.reduce(
        (sum: number, c: { matches: number }) => sum + c.matches,
        0,
      )
      expect(totalMatchesInMonths).toBe(2)
    } finally {
      mockDesignations.length = 0
      mockDesignations.push(...backup)
    }
  })
})

describe('GET /api/admin/reports — 4.2.4: histórico de cobertura por jornada real', () => {
  it('coverageHistory: la suma de cada jornada == nº de partidos de esa jornada, y el total == temporada completa', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(Array.isArray(body.coverageHistory)).toBe(true)
    expect(body.coverageHistory.length).toBeGreaterThan(0)

    const bySaturday = new Map<string, number>()
    for (const m of mockMatches) {
      const s = getJornadaSaturdayForDate(m.date)
      bySaturday.set(s, (bySaturday.get(s) ?? 0) + 1)
    }

    let totalAcrossHistory = 0
    for (const entry of body.coverageHistory as {
      saturday: string
      totalMatches: number
      covered: number
      partial: number
      uncovered: number
    }[]) {
      expect(entry.covered + entry.partial + entry.uncovered).toBe(entry.totalMatches)
      expect(entry.totalMatches).toBe(bySaturday.get(entry.saturday))
      totalAcrossHistory += entry.totalMatches
    }
    expect(totalAcrossHistory).toBe(mockMatches.length)
  })
})

describe('GET /api/admin/reports — rendimiento con temporada completa designada', () => {
  it('sin cuadráticos: handler completo (índices + agregación de toda la temporada) en tiempo acotado', async () => {
    // Volumen real: TODOS los partidos de la temporada designados (no solo
    // una jornada, a diferencia de dashboard/optimize: reports agrega por
    // temporada por diseño). Antes del índice, esto tardaba ~82 s (medido);
    // con el índice baja a ~0,4-0,9 s. Tras sumar costByMonth y
    // coverageHistory (4.2.3/4.2.4, cada uno un recorrido adicional de
    // temporada completa) se mide ~1,4-1,5 s; el umbral sube de 2000 a 3000 ms
    // para mantener margen holgado (~2x lo medido) sin volverse flaky en
    // máquina compartida — sigue siendo ~50x más rápido que sin índice.
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
      const res = await GET(makeRequest())
      const ms = performance.now() - t0
      const body = await res.json()

      console.log(
        `reports GET: ${ms.toFixed(1)} ms, ${mockMatches.length} partidos, ` +
          `${mockDesignations.length} designaciones en memoria`,
      )
      expect(res.status).toBe(200)
      expect(body.liquidation.length).toBeGreaterThan(0)
      expect(ms).toBeLessThan(3000)
    } finally {
      mockDesignations.length = originalLength
    }
  }, 60_000)
})
