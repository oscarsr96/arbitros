import { describe, it, expect } from 'vitest'
import { getAvailabilityDeadline, AVAILABILITY_DEADLINE_DAYS } from '../availability-deadline'

// Sabado de referencia (mismo usado en solver.test.ts)
const SATURDAY = '2025-03-15'

describe('getAvailabilityDeadline', () => {
  it('provincial: sabado - 7 dias, fin de dia', () => {
    const deadline = getAvailabilityDeadline('provincial', SATURDAY)
    expect(deadline).toEqual(new Date(2025, 2, 8, 23, 59, 59, 999))
  })

  it('autonomico: sabado - 8 dias, fin de dia', () => {
    const deadline = getAvailabilityDeadline('autonomico', SATURDAY)
    expect(deadline).toEqual(new Date(2025, 2, 7, 23, 59, 59, 999))
  })

  it('nacional: sabado - 10 dias, fin de dia', () => {
    const deadline = getAvailabilityDeadline('nacional', SATURDAY)
    expect(deadline).toEqual(new Date(2025, 2, 5, 23, 59, 59, 999))
  })

  it('feb: sabado - 12 dias, fin de dia', () => {
    const deadline = getAvailabilityDeadline('feb', SATURDAY)
    expect(deadline).toEqual(new Date(2025, 2, 3, 23, 59, 59, 999))
  })

  it('categoria null → usa el default mas restrictivo (feb, 12 dias)', () => {
    const deadline = getAvailabilityDeadline(null, SATURDAY)
    expect(deadline).toEqual(new Date(2025, 2, 3, 23, 59, 59, 999))
  })

  it('categoria desconocida → usa el default mas restrictivo (feb, 12 dias)', () => {
    const deadline = getAvailabilityDeadline('inexistente', SATURDAY)
    expect(deadline).toEqual(new Date(2025, 2, 3, 23, 59, 59, 999))
  })

  it('AVAILABILITY_DEADLINE_DAYS expone los defaults confirmados', () => {
    expect(AVAILABILITY_DEADLINE_DAYS).toEqual({
      provincial: 7,
      autonomico: 8,
      nacional: 10,
      feb: 12,
    })
  })

  it('limite exacto: declarar el mismo dia del deadline esta permitido', () => {
    const deadline = getAvailabilityDeadline('provincial', SATURDAY)
    const declaredSameDay = new Date(2025, 2, 8, 20, 0, 0, 0) // mismo dia, por la tarde
    expect(declaredSameDay.getTime()).toBeLessThanOrEqual(deadline.getTime())
  })

  it('limite exacto: declarar el dia siguiente al deadline esta bloqueado', () => {
    const deadline = getAvailabilityDeadline('provincial', SATURDAY)
    const declaredNextDay = new Date(2025, 2, 9, 0, 0, 0, 0) // dia siguiente, recien empezado
    expect(declaredNextDay.getTime()).toBeGreaterThan(deadline.getTime())
  })
})
