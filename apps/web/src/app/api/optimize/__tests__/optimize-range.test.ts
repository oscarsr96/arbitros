import { describe, it, expect } from 'vitest'
import { POST } from '../route'
import { validateDateRange, filterMatchesByRange } from '@/lib/optimize-range'
import { mockMatches, mockPersons, mockDesignations } from '@/lib/mock-data'
import { getJornadaSaturdayForDate } from '@/lib/matchday-availability'

// Suma un día a una fecha YYYY-MM-DD en LOCAL (evita el desfase de toISOString con UTC).
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── validateDateRange (función pura) ────────────────────────────────────────

describe('validateDateRange', () => {
  it('acepta ausencia total de rango', () => {
    expect(validateDateRange(undefined, undefined)).toBeNull()
  })

  it('acepta dateFrom === dateTo', () => {
    expect(validateDateRange('2025-09-20', '2025-09-20')).toBeNull()
  })

  it('acepta dateFrom < dateTo', () => {
    expect(validateDateRange('2025-09-20', '2025-09-21')).toBeNull()
  })

  it('rechaza formato inválido en dateFrom', () => {
    expect(validateDateRange('2025/09/20', undefined)).not.toBeNull()
  })

  it('rechaza formato inválido en dateTo', () => {
    expect(validateDateRange(undefined, '20-09-2025')).not.toBeNull()
  })

  it('rechaza dateFrom > dateTo', () => {
    expect(validateDateRange('2025-09-25', '2025-09-20')).not.toBeNull()
  })
})

// ── filterMatchesByRange (función pura) ─────────────────────────────────────

describe('filterMatchesByRange', () => {
  const fixture = [
    { id: 'm1', date: '2025-09-20' },
    { id: 'm2', date: '2025-09-21' },
    { id: 'm3', date: '2025-09-27' },
  ]

  it('sin rango devuelve la lista completa', () => {
    expect(filterMatchesByRange(fixture)).toEqual(fixture)
  })

  it('filtra por dateFrom (sin límite superior)', () => {
    expect(filterMatchesByRange(fixture, '2025-09-21').map((m) => m.id)).toEqual(['m2', 'm3'])
  })

  it('filtra por dateTo (sin límite inferior)', () => {
    expect(filterMatchesByRange(fixture, undefined, '2025-09-21').map((m) => m.id)).toEqual([
      'm1',
      'm2',
    ])
  })

  it('filtra por rango cerrado [dateFrom, dateTo]', () => {
    expect(filterMatchesByRange(fixture, '2025-09-20', '2025-09-21').map((m) => m.id)).toEqual([
      'm1',
      'm2',
    ])
  })
})

// ── POST /api/optimize — rango de fechas y re-optimización parcial ─────────

describe('POST /api/optimize — rango y partial', () => {
  it('rango con formato de fecha inválido → 400', async () => {
    const res = await POST(makeRequest({ dateFrom: '2025/09/20' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })

  it('dateFrom > dateTo → 400', async () => {
    const res = await POST(makeRequest({ dateFrom: '2025-10-01', dateTo: '2025-09-01' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })

  // Nota: sin rango, la ruta resuelve la temporada COMPLETA (324 partidos × ~1279
  // personas), un solve greedy que en local ronda los ~25s; de ahí el timeout amplio.
  // El caso barato equivalente (helper puro sin rango → lista completa) está cubierto
  // arriba en `filterMatchesByRange`.
  it('sin rango, el comportamiento actual queda intacto (todos los partidos)', async () => {
    const res = await POST(makeRequest({ numProposals: 1 }))
    expect(res.status).toBe(200)
    const data = await res.json()
    const totalSlotsExpected = mockMatches.reduce(
      (sum, m) => sum + m.refereesNeeded + m.scorersNeeded,
      0,
    )
    expect(data.proposals[0].metrics.totalSlots).toBe(totalSlotsExpected)
  }, 90000)

  it('con rango de 1 jornada, todas las assignments/unassigned pertenecen a esa jornada', async () => {
    const minDate = mockMatches.reduce(
      (min, m) => (m.date < min ? m.date : min),
      mockMatches[0].date,
    )
    const saturday = getJornadaSaturdayForDate(minDate)
    const sunday = addOneDay(saturday)

    const jornadaMatchIds = new Set(
      mockMatches.filter((m) => m.date >= saturday && m.date <= sunday).map((m) => m.id),
    )
    // Sanity check del fixture real: la jornada es un subconjunto propio de los 324.
    expect(jornadaMatchIds.size).toBeGreaterThan(0)
    expect(jornadaMatchIds.size).toBeLessThan(mockMatches.length)

    const res = await POST(makeRequest({ dateFrom: saturday, dateTo: sunday, numProposals: 1 }))
    expect(res.status).toBe(200)
    const data = await res.json()
    const proposal = data.proposals[0]

    const totalSlotsExpected = mockMatches
      .filter((m) => jornadaMatchIds.has(m.id))
      .reduce((sum, m) => sum + m.refereesNeeded + m.scorersNeeded, 0)
    expect(proposal.metrics.totalSlots).toBe(totalSlotsExpected)

    for (const a of proposal.assignments) {
      expect(jornadaMatchIds.has(a.matchId)).toBe(true)
    }
    for (const u of proposal.unassigned) {
      expect(jornadaMatchIds.has(u.matchId)).toBe(true)
    }
  }, 20000)

  it('con partial, todas las assignments/unassigned pertenecen a ese matchId+role, ignorando dateFrom/dateTo', async () => {
    const target = mockMatches.find((m) => m.refereesNeeded > 0) ?? mockMatches[0]
    // Rango deliberadamente ajeno a la fecha del partido objetivo: si la ruta lo
    // aplicara (bug pre-T7b), el partido quedaría fuera y no habría solución.
    const res = await POST(
      makeRequest({
        dateFrom: '1900-01-01',
        dateTo: '1900-01-02',
        numProposals: 1,
        partial: { matchId: target.id, role: 'arbitro' },
      }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    const proposal = data.proposals[0]

    expect(proposal.metrics.totalSlots).toBe(target.refereesNeeded + target.scorersNeeded)
    for (const a of proposal.assignments) {
      expect(a.matchId).toBe(target.id)
      expect(a.role).toBe('arbitro')
    }
    for (const u of proposal.unassigned) {
      expect(u.matchId).toBe(target.id)
      expect(u.role).toBe('arbitro')
    }
  }, 20000)

  it('B1: en partial NO devuelve la designación existente (isNew:false), evitando duplicados', async () => {
    const target = mockMatches.find((m) => m.refereesNeeded >= 2) ?? mockMatches[0]
    const existingPersonId = mockPersons.find((p) => p.role === 'arbitro')!.id
    const desigId = 'test-desig-b1'
    mockDesignations.push({
      id: desigId,
      matchId: target.id,
      personId: existingPersonId,
      role: 'arbitro',
      travelCost: '0.00',
      distanceKm: '0.0',
      status: 'notified',
      notifiedAt: null,
      createdAt: new Date(),
    })
    try {
      const res = await POST(
        makeRequest({ numProposals: 1, partial: { matchId: target.id, role: 'arbitro' } }),
      )
      expect(res.status).toBe(200)
      const proposal = (await res.json()).proposals[0]
      // Antes del fix, la designación existente (isNew:false, existingPersonId) se colaba
      // en assignments y el cliente la re-asignaba → duplicado.
      for (const a of proposal.assignments) {
        expect(a.isNew).toBe(true)
        expect(a.personId).not.toBe(existingPersonId)
      }
    } finally {
      const idx = mockDesignations.findIndex((d) => d.id === desigId)
      if (idx >= 0) mockDesignations.splice(idx, 1)
    }
  }, 20000)
})
