import { describe, it, expect } from 'vitest'
import { pairOverlap, isSolverConflict, type OverlapMatch } from '../overlap'

// ── Helpers de test ──────────────────────────────────────────────────────────

function match(overrides: Partial<OverlapMatch> & Pick<OverlapMatch, 'startMin'>): OverlapMatch {
  return {
    date: '2026-01-10',
    venueId: 'venue-a',
    municipalityId: 'muni-a',
    ...overrides,
  }
}

// ── isSolverConflict (solver, margen conservador +30) ───────────────────────
// El solver es más estricto que el panel: exige un colchón (CONFLICT_MARGIN_MIN=30) sobre
// el viaje estimado antes de dar un candidato por seguro, salvo mismo pabellón.

describe('isSolverConflict', () => {
  it('margen conservador: distinto pabellón, mismo municipio, con coche (viaje 15), gap 15 (18:00-19:45) → true (antes false)', () => {
    const a = match({ startMin: 18 * 60, venueId: 'venue-a', municipalityId: 'muni-a' })
    const b = match({ startMin: 19 * 60 + 45, venueId: 'venue-b', municipalityId: 'muni-a' })

    const result = pairOverlap(a, b, { hasCar: true, getDistanceKm: () => 0 }) // mismo municipio → 0km

    expect(result.intervalsOverlap).toBe(false)
    expect(result.gapMin).toBe(15)
    expect(result.travelMin).toBe(15) // 0km con coche → 15min (mismo municipio, viaje corto)
    expect(result.sameVenue).toBe(false)
    expect(result.travelKnown).toBe(true)

    // Fórmula antigua (sin margen): intervalsOverlap || gapMin < travelMin → 15 < 15 → false.
    const legacyConflict = result.intervalsOverlap || result.gapMin < result.travelMin
    expect(legacyConflict).toBe(false)

    expect(isSolverConflict(result)).toBe(true)
  })

  it('mismo pabellón, gap 0 (14:00 y 15:30, 90min) → false (encadenable, exento de margen)', () => {
    const a = match({ startMin: 14 * 60, venueId: 'venue-a', municipalityId: 'muni-a' })
    const b = match({ startMin: 15 * 60 + 30, venueId: 'venue-a', municipalityId: 'muni-a' })

    const result = pairOverlap(a, b, { hasCar: true, getDistanceKm: () => 20 })

    expect(result.intervalsOverlap).toBe(false)
    expect(result.gapMin).toBe(0)
    expect(result.sameVenue).toBe(true)
    expect(isSolverConflict(result)).toBe(false)
  })

  it('solape real de intervalos (18:00 y 18:30) → true', () => {
    const a = match({ startMin: 18 * 60, venueId: 'venue-a', municipalityId: 'muni-a' })
    const b = match({ startMin: 18 * 60 + 30, venueId: 'venue-b', municipalityId: 'muni-b' })

    const result = pairOverlap(a, b, { hasCar: true, getDistanceKm: () => 20 })

    expect(result.intervalsOverlap).toBe(true)
    expect(isSolverConflict(result)).toBe(true)
  })

  it('municipio vacío, distinto pabellón, gap pequeño sin solape de intervalos → travelKnown=false → false', () => {
    const a = match({ startMin: 18 * 60, venueId: 'venue-a', municipalityId: '' })
    const b = match({ startMin: 19 * 60 + 45, venueId: 'venue-b', municipalityId: 'muni-b' })

    const result = pairOverlap(a, b, { hasCar: true, getDistanceKm: () => 35 }) // fallback si se llamase

    expect(result.intervalsOverlap).toBe(false)
    expect(result.gapMin).toBe(15)
    expect(result.sameVenue).toBe(false)
    expect(result.travelKnown).toBe(false)
    expect(result.travelMin).toBe(0) // no estimable: no se aplica el chequeo de viaje

    expect(isSolverConflict(result)).toBe(false)
  })

  it('distinto municipio lejano, sin coche, gap < viaje+30 → true', () => {
    // 20km sin coche → ceil(20*3)=60min de viaje. Gap=70min: 70 < 60 (no conflicto legacy)
    // pero 70 < 60+30=90 (conflicto con el margen conservador del solver).
    const a = match({ startMin: 10 * 60, venueId: 'venue-a', municipalityId: 'muni-a' })
    const b = match({ startMin: 12 * 60 + 40, venueId: 'venue-b', municipalityId: 'muni-b' })

    const result = pairOverlap(a, b, { hasCar: false, getDistanceKm: () => 20 })

    expect(result.intervalsOverlap).toBe(false)
    expect(result.gapMin).toBe(70)
    expect(result.travelMin).toBe(60)

    const legacyConflict = result.intervalsOverlap || result.gapMin < result.travelMin
    expect(legacyConflict).toBe(false)

    expect(isSolverConflict(result)).toBe(true)
  })
})

// ── pairOverlap — contrato de sameVenue/travelKnown ─────────────────────────

describe('pairOverlap — sameVenue/travelKnown', () => {
  it('fecha distinta: no-conflicto, sameVenue calculado normal, travelKnown true', () => {
    const a = match({ date: '2026-01-10', startMin: 18 * 60, venueId: 'venue-a' })
    const b = match({ date: '2026-01-11', startMin: 18 * 60, venueId: 'venue-a' })

    const result = pairOverlap(a, b, { hasCar: true, getDistanceKm: () => 20 })

    expect(result.intervalsOverlap).toBe(false)
    expect(result.gapMin).toBe(Infinity)
    expect(result.sameVenue).toBe(true)
    expect(result.travelKnown).toBe(true)
  })

  it('ambos municipios vacíos, mismo pabellón → travelKnown true por sameVenue', () => {
    const a = match({ startMin: 10 * 60, venueId: 'venue-a', municipalityId: '' })
    const b = match({ startMin: 15 * 60, venueId: 'venue-a', municipalityId: '' })

    const result = pairOverlap(a, b, { hasCar: true, getDistanceKm: () => 35 })

    expect(result.sameVenue).toBe(true)
    expect(result.travelKnown).toBe(true)
    expect(result.travelMin).toBe(0)
  })
})
