import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockMatches, mockDesignations, mockPersons, type MockDesignation } from '@/lib/mock-data'
import { GET } from '../route'

// Antes esta ruta agregaba sobre mockMatches ENTERO (24.508 partidos de la
// temporada real) en vez de la jornada que el designador va a trabajar. Estos
// tests verifican, contra el seed real (no un fixture pequeño), que la
// respuesta queda acotada a una jornada y que el handler es rápido incluso
// con la temporada completa designada.

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/dashboard${query}`)
}

describe('GET /api/admin/dashboard', () => {
  it('sin parámetros, nunca devuelve la temporada completa', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.totalMatches).toBeGreaterThan(0)
    expect(body.stats.totalMatches).toBeLessThan(mockMatches.length)
    // La temporada real termina el 2026-05-10: hoy (fuera de esa suite de
    // tests, "hoy" real es 2026-07-21) cae fuera por el final, así que el
    // valor por defecto es la ÚLTIMA jornada jugada.
    expect(body.jornada.saturday).toBe('2026-05-09')
  })

  it('respeta ?jornada= explícito y acota TODAS las métricas a esa ventana', async () => {
    const res = await GET(makeRequest('?jornada=2025-09-27'))
    const body = await res.json()
    expect(body.jornada).toEqual({ saturday: '2025-09-27', from: '2025-09-26', to: '2025-10-02' })

    const inWindow = mockMatches.filter((m) => m.date >= '2025-09-26' && m.date <= '2025-10-02')
    expect(body.stats.totalMatches).toBe(inWindow.length)
  })

  it('invariante: cubiertos + parciales + sin cubrir = total', async () => {
    const res = await GET(makeRequest('?jornada=2025-09-27'))
    const { stats } = await res.json()
    expect(stats.coveredMatches + stats.partiallyCovered + stats.uncoveredMatches).toBe(
      stats.totalMatches,
    )
  })

  it('handler < 200 ms sobre la jornada punta con la temporada completa designada', async () => {
    // Jornada pico real (~1.309 partidos, ver CLAUDE.md). Se satura de
    // designaciones TODA la temporada (no solo esta jornada) para reproducir
    // el peor caso: el índice por designación se construye sobre
    // mockDesignations ENTERO en cada request, tenga o no partidos la ventana.
    const peakSaturday = '2026-03-07'
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
      const res = await GET(makeRequest(`?jornada=${peakSaturday}`))
      const ms = performance.now() - t0
      const body = await res.json()

      console.log(
        `dashboard GET ?jornada=${peakSaturday}: ${ms.toFixed(1)} ms, ` +
          `${body.stats.totalMatches} partidos, ${mockDesignations.length} designaciones en memoria`,
      )
      expect(res.status).toBe(200)
      expect(ms).toBeLessThan(200)
    } finally {
      mockDesignations.length = originalLength
    }
  })
})

describe('GET /api/admin/dashboard — hoy dentro de temporada', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-29T10:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sin parámetros, usa la jornada de HOY cuando tiene partidos', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.jornada.saturday).toBe('2025-09-27')
  })
})
