import { describe, it, expect } from 'vitest'
import { mapCategory, inferGender } from '../category-mapping'

describe('mapCategory', () => {
  it('mapea "Junior Masc. Pref." a Junior Masculino Preferente', () => {
    expect(mapCategory('Junior Masc. Pref.')).toEqual({
      canonical: 'Junior Masculino Preferente',
      refereesNeeded: 2,
      scorersNeeded: 1,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: true,
    })
  })

  it('mapea "Cadete Masc. Pref." a Cadete Masculino Preferente', () => {
    expect(mapCategory('Cadete Masc. Pref.')).toEqual({
      canonical: 'Cadete Masculino Preferente',
      refereesNeeded: 2,
      scorersNeeded: 1,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: true,
    })
  })

  it('mapea "Sub 22 Masc. PLATA" a Sub-22 Masculina PLATA', () => {
    expect(mapCategory('Sub 22 Masc. PLATA')).toEqual({
      canonical: 'Sub-22 Masculina PLATA',
      refereesNeeded: 2,
      scorersNeeded: 1,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: true,
    })
  })

  it('mapea "2ª Div Aut Masc BRONCE" a 2ª División Autonómica Masculina BRONCE', () => {
    expect(mapCategory('2ª Div Aut Masc BRONCE')).toEqual({
      canonical: '2ª División Autonómica Masculina BRONCE',
      refereesNeeded: 2,
      scorersNeeded: 1,
      minRefCategory: 'autonomico',
      gender: 'masculino',
      needsConfirmation: true,
    })
  })

  it('mapea "2ª Div Aut Fem PLATA" a 2ª División Autonómica Femenina PLATA', () => {
    expect(mapCategory('2ª Div Aut Fem PLATA')).toEqual({
      canonical: '2ª División Autonómica Femenina PLATA',
      refereesNeeded: 2,
      scorersNeeded: 1,
      minRefCategory: 'autonomico',
      gender: 'femenino',
      needsConfirmation: true,
    })
  })

  it('mapea "Junior Masc. ORO" a Junior Masculino ORO con 2 + 3', () => {
    expect(mapCategory('Junior Masc. ORO')).toEqual({
      canonical: 'Junior Masculino ORO',
      refereesNeeded: 2,
      scorersNeeded: 3,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: true,
    })
    // Nombre comercial completo del CSV
    expect(mapCategory('Junior Masculino LIGA AHORRAMAS - ORO')?.canonical).toBe(
      'Junior Masculino ORO',
    )
    // No colisiona con la familia Preferente
    expect(mapCategory('Junior Masc. Pref.')?.canonical).toBe('Junior Masculino Preferente')
  })

  it('mapea "Liga VIPS Masculina" a 1ª División Nacional Masculina con 2 + 3', () => {
    expect(mapCategory('Liga VIPS Masculina')).toEqual({
      canonical: '1ª División Nacional Masculina',
      refereesNeeded: 2,
      scorersNeeded: 3,
      minRefCategory: 'autonomico',
      gender: 'masculino',
      needsConfirmation: true,
    })
  })

  it('mapea "Liga VIPS Femenina" a 1ª División Nacional Femenina (no la tumba el early-return de género)', () => {
    expect(mapCategory('Liga VIPS Femenina')).toEqual({
      canonical: '1ª División Nacional Femenina',
      refereesNeeded: 2,
      scorersNeeded: 3,
      minRefCategory: 'autonomico',
      gender: 'femenino',
      needsConfirmation: true,
    })
  })

  it('rechaza "Junior Femenino ORO" (no hay entrada femenina confirmada)', () => {
    expect(mapCategory('Junior Femenino ORO')).toBeNull()
  })

  it('tolera variantes de espaciado y de forma completa vs abreviada', () => {
    const expected = {
      canonical: 'Sub-22 Masculina PLATA',
      refereesNeeded: 2,
      scorersNeeded: 1,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: true,
    }
    expect(mapCategory('Sub22 Masculino PLATA')).toEqual(expected)
    expect(mapCategory('  sub   22   masc   plata  ')).toEqual(expected)
  })

  it('devuelve null para una categoria desconocida', () => {
    expect(mapCategory('Senior Masc. Autonomica')).toBeNull()
  })

  it('devuelve null si el genero del nombre no coincide con la familia confirmada', () => {
    // No hay entrada confirmada para "Sub-22 Femenina PLATA"
    expect(mapCategory('Sub 22 Fem. PLATA')).toBeNull()
  })

  it('M2: un ordinal distinto de 2ª NO mapea a la canónica 2ª (rechaza + informa)', () => {
    expect(mapCategory('1ª Div Aut Masc BRONCE')).toBeNull()
    expect(mapCategory('3ª Div Aut Fem PLATA')).toBeNull()
    // La 2ª sí sigue mapeando
    expect(mapCategory('2ª Div Aut Masc BRONCE')?.canonical).toBe(
      '2ª División Autonómica Masculina BRONCE',
    )
  })
})

describe('inferGender', () => {
  it('infiere masculino con la abreviatura "Masc."', () => {
    expect(inferGender('Junior Masc. Pref.')).toBe('masculino')
  })

  it('infiere femenino con la abreviatura "Fem."', () => {
    expect(inferGender('2ª Div Aut Fem PLATA')).toBe('femenino')
  })

  it('devuelve null cuando el nombre no indica genero', () => {
    expect(inferGender('Copa X')).toBeNull()
  })
})
