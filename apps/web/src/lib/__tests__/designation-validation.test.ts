import { describe, it, expect } from 'vitest'
import { checkDesignationConflict } from '../designation-validation'

const match = { id: 'm1', refereesNeeded: 2, scorersNeeded: 1 }

describe('checkDesignationConflict', () => {
  it('slot libre → ok', () => {
    const r = checkDesignationConflict([], match, 'p1', 'arbitro')
    expect(r.ok).toBe(true)
  })

  it('persona ya designada en el partido (mismo rol) → conflicto', () => {
    const existing = [{ matchId: 'm1', personId: 'p1', role: 'arbitro' }]
    const r = checkDesignationConflict(existing, match, 'p1', 'arbitro')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('ya está designada')
  })

  it('persona ya designada en el partido en OTRO rol → conflicto (un papel por partido)', () => {
    const existing = [{ matchId: 'm1', personId: 'p1', role: 'anotador' }]
    const r = checkDesignationConflict(existing, match, 'p1', 'arbitro')
    expect(r.ok).toBe(false)
  })

  it('rol de árbitro completo (2/2) → conflicto de sobre-cobertura', () => {
    const existing = [
      { matchId: 'm1', personId: 'p1', role: 'arbitro' },
      { matchId: 'm1', personId: 'p2', role: 'arbitro' },
    ]
    const r = checkDesignationConflict(existing, match, 'p3', 'arbitro')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('árbitros')
  })

  it('árbitros a medias (1/2) → ok para añadir el segundo', () => {
    const existing = [{ matchId: 'm1', personId: 'p1', role: 'arbitro' }]
    const r = checkDesignationConflict(existing, match, 'p2', 'arbitro')
    expect(r.ok).toBe(true)
  })

  it('roles se cuentan por separado: árbitros llenos no bloquean un anotador', () => {
    const existing = [
      { matchId: 'm1', personId: 'p1', role: 'arbitro' },
      { matchId: 'm1', personId: 'p2', role: 'arbitro' },
    ]
    const r = checkDesignationConflict(existing, match, 'p3', 'anotador')
    expect(r.ok).toBe(true)
  })

  it('anotador completo (1/1) → conflicto', () => {
    const existing = [{ matchId: 'm1', personId: 'p9', role: 'anotador' }]
    const r = checkDesignationConflict(existing, match, 'p3', 'anotador')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('anotadores')
  })

  it('designaciones de OTROS partidos no cuentan', () => {
    const existing = [
      { matchId: 'm2', personId: 'p1', role: 'arbitro' },
      { matchId: 'm2', personId: 'p2', role: 'arbitro' },
    ]
    const r = checkDesignationConflict(existing, match, 'p1', 'arbitro')
    expect(r.ok).toBe(true)
  })
})
