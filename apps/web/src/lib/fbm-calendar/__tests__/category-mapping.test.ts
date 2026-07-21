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
      needsConfirmation: false,
    })
  })

  // Bases p. 25: "Cadete Preferente — 1 árbitro y 1 Of. Mesa". Es la única
  // categoría de club que se pita en solitario junto a infantil y minibasket.
  it('mapea "Cadete Masc. Pref." a Cadete Masculino Preferente (1 árbitro)', () => {
    expect(mapCategory('Cadete Masc. Pref.')).toEqual({
      canonical: 'Cadete Masculino Preferente',
      refereesNeeded: 1,
      scorersNeeded: 1,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: false,
    })
  })

  it('mapea "Sub 22 Masc. PLATA" a Sub-22 Masculina PLATA', () => {
    expect(mapCategory('Sub 22 Masc. PLATA')).toEqual({
      canonical: 'Sub-22 Masculina PLATA',
      refereesNeeded: 2,
      scorersNeeded: 2,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: false,
    })
  })

  it('mapea "2ª Div Aut Masc BRONCE" a 2ª División Autonómica Masculina BRONCE', () => {
    expect(mapCategory('2ª Div Aut Masc BRONCE')).toEqual({
      canonical: '2ª División Autonómica Masculina BRONCE',
      refereesNeeded: 2,
      scorersNeeded: 2,
      minRefCategory: 'autonomico',
      gender: 'masculino',
      needsConfirmation: false,
    })
  })

  it('mapea "2ª Div Aut Fem PLATA" a 2ª División Autonómica Femenina PLATA', () => {
    expect(mapCategory('2ª Div Aut Fem PLATA')).toEqual({
      canonical: '2ª División Autonómica Femenina PLATA',
      refereesNeeded: 2,
      scorersNeeded: 2,
      minRefCategory: 'autonomico',
      gender: 'femenino',
      needsConfirmation: false,
    })
  })

  it('mapea "Junior Masc. ORO" a Junior Masculino ORO con 2 + 3', () => {
    expect(mapCategory('Junior Masc. ORO')).toEqual({
      canonical: 'Junior Masculino ORO',
      refereesNeeded: 2,
      scorersNeeded: 3,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: false,
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
      needsConfirmation: false,
    })
  })

  it('mapea "Liga VIPS Femenina" a 1ª División Nacional Femenina (no la tumba el early-return de género)', () => {
    expect(mapCategory('Liga VIPS Femenina')).toEqual({
      canonical: '1ª División Nacional Femenina',
      refereesNeeded: 2,
      scorersNeeded: 3,
      minRefCategory: 'autonomico',
      gender: 'femenino',
      needsConfirmation: false,
    })
  })

  // Antes se rechazaba (no había familia femenina confirmada). Las Bases (p. 6,
  // B.1.2) sí convocan Junior Femenino ORO y los calendarios lo traen.
  it('mapea "Junior Femenino ORO" con el mismo arbitraje que el masculino', () => {
    expect(mapCategory('Junior Femenino ORO')).toEqual({
      canonical: 'Junior Femenino ORO',
      refereesNeeded: 2,
      scorersNeeded: 3,
      minRefCategory: 'provincial',
      gender: 'femenino',
      needsConfirmation: false,
    })
  })

  it('no confunde el género por la subcadena "MAS" de "AHORRAMAS"', () => {
    expect(inferGender('Cadete Femenino LIGA AHORRAMAS - ORO')).toBe('femenino')
    expect(mapCategory('Cadete Femenino LIGA AHORRAMAS - ORO')?.canonical).toBe(
      'Cadete Femenino ORO',
    )
  })

  it('tolera variantes de espaciado y de forma completa vs abreviada', () => {
    const expected = {
      canonical: 'Sub-22 Masculina PLATA',
      refereesNeeded: 2,
      scorersNeeded: 2,
      minRefCategory: 'provincial',
      gender: 'masculino',
      needsConfirmation: false,
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
