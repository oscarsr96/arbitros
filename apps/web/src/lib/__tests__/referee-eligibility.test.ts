import { describe, it, expect } from 'vitest'
import { checkSlotEligibility } from '../referee-eligibility'

describe('checkSlotEligibility', () => {
  it('nacional puede principal en nacional', () => {
    expect(
      checkSlotEligibility(
        { role: 'arbitro', category: 'nacional', refereeLevel: 'nacional' },
        { fineCategory: 'nacional', minRefCategory: 'nacional' },
        'principal',
      ),
    ).toBe(true)
  })

  it('feb NO puede segunda_aut_oro ni nacional (exclusivas de otros niveles)', () => {
    const feb = { role: 'arbitro', category: 'feb', refereeLevel: 'feb' }
    expect(checkSlotEligibility(feb, { fineCategory: 'segunda_aut_oro' })).toBe(false)
    expect(checkSlotEligibility(feb, { fineCategory: 'nacional' })).toBe(false)
  })

  it('escuela en junior_pref: auxiliar sí, principal no (D3: solo pita como auxiliar)', () => {
    const escuela = { role: 'arbitro', category: 'provincial', refereeLevel: 'escuela' }
    expect(checkSlotEligibility(escuela, { fineCategory: 'junior_pref' }, 'auxiliar')).toBe(true)
    expect(checkSlotEligibility(escuela, { fineCategory: 'junior_pref' }, 'principal')).toBe(false)
  })

  it('sub22_oro (categoría nueva, espejo de junior_especial_oro): nacional y feb principal sí, primera_aut solo auxiliar', () => {
    const nacional = { role: 'arbitro', category: 'nacional', refereeLevel: 'nacional' }
    const feb = { role: 'arbitro', category: 'feb', refereeLevel: 'feb' }
    const primeraAut = { role: 'arbitro', category: 'autonomico', refereeLevel: 'primera_aut' }
    expect(checkSlotEligibility(nacional, { fineCategory: 'sub22_oro' }, 'principal')).toBe(true)
    expect(checkSlotEligibility(feb, { fineCategory: 'sub22_oro' }, 'principal')).toBe(true)
    expect(checkSlotEligibility(primeraAut, { fineCategory: 'sub22_oro' }, 'principal')).toBe(false)
    expect(checkSlotEligibility(primeraAut, { fineCategory: 'sub22_oro' }, 'auxiliar')).toBe(true)
  })

  it('fallback legacy (D2): partido sin fineCategory usa meetsMinCategory', () => {
    const primeraAut = { role: 'arbitro', category: 'autonomico', refereeLevel: 'primera_aut' }
    const escuela = { role: 'arbitro', category: 'provincial', refereeLevel: 'escuela' }
    expect(checkSlotEligibility(primeraAut, { minRefCategory: 'autonomico' })).toBe(true)
    expect(checkSlotEligibility(escuela, { minRefCategory: 'autonomico' })).toBe(false)
  })

  it('fallback legacy (D4): persona sin refereeLevel usa meetsMinCategory aunque el partido tenga fina', () => {
    const sinNivel = { role: 'arbitro', category: 'nacional' }
    const sinNivelProvincial = { role: 'arbitro', category: 'provincial' }
    const competition = { fineCategory: 'nacional' as const, minRefCategory: 'nacional' }
    expect(checkSlotEligibility(sinNivel, competition)).toBe(true)
    expect(checkSlotEligibility(sinNivelProvincial, competition)).toBe(false)
  })

  it('fallback sin minRefCategory (ni fina ni legacy exigen nada) → elegible', () => {
    const persona = { role: 'arbitro', category: null }
    expect(checkSlotEligibility(persona, undefined)).toBe(true)
    expect(checkSlotEligibility(persona, {})).toBe(true)
  })

  it('anotador siempre elegible (D5: fuera del modelo de matriz)', () => {
    const anotador = { role: 'anotador', category: 'escuela' }
    expect(
      checkSlotEligibility(
        anotador,
        { fineCategory: 'nacional', minRefCategory: 'nacional' },
        'principal',
      ),
    ).toBe(true)
  })
})
