import { describe, it, expect } from 'vitest'
import { resolveDesignationFee, sumDesignationFees, feeBasesCategoryOf } from '../designation-fees'
import { FEES_BY_BASES_CATEGORY } from '../fbm-calendar/bases-fbm'
import { allCanonicalCategories, basesCategoryOf } from '../fbm-calendar/category-mapping'

// Réplica local de slugUpper de materialize-import.ts (no exportado): así los
// `category` de los casos son EXACTAMENTE los slugs que materializa el import.
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

// Forma real de una competición materializada: name = canónica,
// category = slug del literal CSV (materialize-import.ts).
const PRIMERA_NAC_MASC = {
  name: '1ª División Nacional Masculina',
  category: slug('Liga VIPS Masculina'),
}
const MINIBASKET = {
  name: 'Alevín Masculino 1er año',
  category: slug('Alv Mas 1ºaño LIGA MARCO ALDANY'),
}

describe('resolveDesignationFee: importe por posición (Tabla C, p. 25)', () => {
  it('1ª Div. Nac. Masculina: principal 111,60 €', () => {
    const r = resolveDesignationFee({ role: 'arbitro', position: 'principal' }, PRIMERA_NAC_MASC)
    expect(r).toEqual({ fee: 111.6, basesCategory: 'primera_nac_masc' })
  })

  it('1ª Div. Nac. Masculina: auxiliar 111,60 €', () => {
    const r = resolveDesignationFee({ role: 'arbitro', position: 'auxiliar' }, PRIMERA_NAC_MASC)
    expect(r).toEqual({ fee: 111.6, basesCategory: 'primera_nac_masc' })
  })

  it('1ª Div. Nac. Masculina: anotador 31,80 €, cronometrador y 24" 30,80 €', () => {
    const anotador = resolveDesignationFee(
      { role: 'anotador', position: 'anotador' },
      PRIMERA_NAC_MASC,
    )
    const crono = resolveDesignationFee(
      { role: 'anotador', position: 'cronometrador' },
      PRIMERA_NAC_MASC,
    )
    const veinticuatro = resolveDesignationFee(
      { role: 'anotador', position: 'veinticuatro' },
      PRIMERA_NAC_MASC,
    )
    expect(anotador.fee).toBe(31.8)
    expect(crono.fee).toBe(30.8)
    expect(veinticuatro.fee).toBe(30.8)
  })

  it('Minibasket: auxiliar da 0 € REAL de la tabla (no null), anotador 16,00 €', () => {
    const auxiliar = resolveDesignationFee({ role: 'arbitro', position: 'auxiliar' }, MINIBASKET)
    expect(auxiliar).toEqual({ fee: 0, basesCategory: 'minibasket' })
    const anotador = resolveDesignationFee({ role: 'anotador', position: 'anotador' }, MINIBASKET)
    expect(anotador.fee).toBe(16.0)
  })
})

describe('resolveDesignationFee: casos irresolubles → fee null + reason', () => {
  it('competición sin fila en las Bases → null con reason, nunca 0', () => {
    const r = resolveDesignationFee(
      { role: 'arbitro', position: 'principal' },
      { name: 'Torneo de Primavera', category: slug('Torneo de Primavera') },
    )
    expect(r.fee).toBeNull()
    expect(r.basesCategory).toBeNull()
    expect(r.reason).toContain('Torneo de Primavera')
  })

  it('partido sin competición resuelta → null con reason', () => {
    const r = resolveDesignationFee({ role: 'arbitro', position: 'principal' }, undefined)
    expect(r.fee).toBeNull()
    expect(r.reason).toBeDefined()
  })

  it('posición que no corresponde al rol → null con reason', () => {
    const r = resolveDesignationFee({ role: 'arbitro', position: 'anotador' }, PRIMERA_NAC_MASC)
    expect(r.fee).toBeNull()
    expect(r.basesCategory).toBe('primera_nac_masc')
    expect(r.reason).toContain('inválida')
  })
})

describe('resolveDesignationFee: designaciones legacy sin posición', () => {
  it('árbitro sin posición → honorario de principal (inequívoco, ver invariante)', () => {
    const r = resolveDesignationFee({ role: 'arbitro' }, PRIMERA_NAC_MASC)
    expect(r).toEqual({ fee: 111.6, basesCategory: 'primera_nac_masc' })
  })

  it('mesa sin posición → null con reason (anotador/crono/24" cobran distinto)', () => {
    const r = resolveDesignationFee({ role: 'anotador' }, PRIMERA_NAC_MASC)
    expect(r.fee).toBeNull()
    expect(r.basesCategory).toBe('primera_nac_masc')
    expect(r.reason).toContain('sin posición')
  })

  it('invariante que sostiene el fallback: toda fila cumple principal === auxiliar o auxiliar === 0', () => {
    for (const [key, fees] of Object.entries(FEES_BY_BASES_CATEGORY)) {
      expect(fees.principal === fees.auxiliar || fees.auxiliar === 0, key).toBe(true)
    }
  })
})

describe('sumDesignationFees: agregación para reportes (4.1.4)', () => {
  it('suma exacta a céntimo y cuenta resueltas/no resueltas', () => {
    const summary = sumDesignationFees([
      { designation: { role: 'arbitro', position: 'principal' }, competition: PRIMERA_NAC_MASC },
      { designation: { role: 'anotador', position: 'anotador' }, competition: PRIMERA_NAC_MASC },
      // Irresoluble: competición desconocida.
      {
        designation: { role: 'arbitro', position: 'principal' },
        competition: { name: 'Torneo de Primavera' },
      },
      // Irresoluble: mesa legacy sin posición.
      { designation: { role: 'anotador' }, competition: PRIMERA_NAC_MASC },
      // Irresoluble: partido sin competición.
      { designation: { role: 'arbitro', position: 'principal' }, competition: undefined },
    ])
    expect(summary).toEqual({ totalFees: 143.4, resolved: 2, unresolved: 3 })
  })

  it('un fee 0 real (auxiliar minibasket) cuenta como resuelto, no como unresolved', () => {
    const summary = sumDesignationFees([
      { designation: { role: 'arbitro', position: 'auxiliar' }, competition: MINIBASKET },
    ])
    expect(summary).toEqual({ totalFees: 0, resolved: 1, unresolved: 0 })
  })

  it('lista vacía → todo a cero', () => {
    expect(sumDesignationFees([])).toEqual({ totalFees: 0, resolved: 0, unresolved: 0 })
  })
})

// ── Métrica de cobertura (criterio de aceptación 4.1.3) ─────────────────────
//
// Las canónicas que `basesCategoryOf` NO resuelve por nombre: sus reglas
// tokenizan literales CSV ('VIPS', 'GINOS', 'DIV'/'AUT', 'PREF', 'ALV',
// 'BENJ') que no aparecen en el nombre canónico. Para todas ellas la
// resolución real pasa por `competition.category` (slug del literal CSV), que
// `feeBasesCategoryOf` usa como fallback. Literal representativo por canónica
// tomado de los calendarios reales (category-coverage.test.ts); la única sin
// calendario esta temporada (2ª Aut Fem BRONCE) usa el literal previsto por
// la propia regla de mapeo.
const CANONICAL_ONLY_VIA_CATEGORY_SLUG: Record<string, string> = {
  '1ª División Nacional Masculina': 'Liga VIPS Masculina',
  '1ª División Nacional Femenina': 'Liga VIPS Femenina',
  '1ª División Autonómica Masculina ORO': 'Liga Ginos Masculina ORO',
  '1ª División Autonómica Masculina PLATA': 'Liga Ginos Masculina PLATA',
  '1ª División Autonómica Femenina': 'Liga Ginos Femenina',
  '2ª División Autonómica Masculina ORO': '2ª Div Aut Masc ORO',
  '2ª División Autonómica Masculina PLATA': '2ª Div Aut Masc PLATA',
  '2ª División Autonómica Masculina BRONCE': '2ª Div Aut Masc BRONCE',
  '2ª División Autonómica Femenina ORO': '2ª Div Aut Fem ORO',
  '2ª División Autonómica Femenina PLATA': '2ª Div Aut Fem PLATA',
  '2ª División Autonómica Femenina BRONCE': '2ª Div Aut Fem BRONCE',
  'Junior Masculino Preferente': 'Junior Masc. Pref.',
  'Junior Femenino Preferente': 'Junior Fem. Pref.',
  'Cadete Masculino Preferente': 'Cadete Masc. Pref.',
  'Cadete Femenino Preferente': 'Cadete Fem. Pref.',
  'Infantil Masculino Preferente': 'Infantil Masc. Pref.',
  'Infantil Femenino Preferente': 'Infantil Fem. Pref.',
  'Alevín Masculino 1er año': 'Alv Mas 1ºaño LIGA MARCO ALDANY',
  'Alevín Femenino 1er año': 'Alv Fem 1ºaño LIGA MARCO ALDANY',
  'Alevín Masculino 2º año ORO': 'Alv Mas 2ºaño LIGA MARCO ALDANY - ORO',
  'Alevín Femenino 2º año ORO': 'Alv Fem 2ºaño LIGA MARCO ALDANY - ORO',
  'Alevín Masculino 2º año PLATA': 'Alv Mas 2ºaño LIGA MARCO ALDANY - PLATA',
  'Alevín Femenino 2º año PLATA': 'Alv Fem 2ºaño LIGA MARCO ALDANY - PLATA',
  'Benjamín Masculino 1er año': 'Benj Mas 1ºaño LIGA MARCO ALDANY',
  'Benjamín Femenino 1er año': 'Benj F.1ºaño LIGA MARCO ALDANY',
  'Benjamín Masculino 2º año': 'Benj Mas 2ºaño LIGA MARCO ALDANY',
  'Benjamín Femenino 2º año': 'Benj F.2ºaño LIGA MARCO ALDANY',
}

describe('cobertura de las canónicas de los calendarios reales', () => {
  const canonicals = allCanonicalCategories()

  it('cobertura por NOMBRE canónico: 22/49 (44,9%), medida, y el resto es exactamente la lista de fallback', () => {
    const unresolvedByName = canonicals.filter((c) => basesCategoryOf(c) === null)
    const resolvedByName = canonicals.length - unresolvedByName.length

    // Número MEDIDO (no asumido): 22 de las 49 canónicas resuelven por nombre.
    expect(canonicals).toHaveLength(49)
    expect(resolvedByName).toBe(22)
    expect((resolvedByName / canonicals.length) * 100).toBeGreaterThanOrEqual(44.8)

    // Las 27 restantes son EXACTAMENTE las familias documentadas arriba.
    expect(unresolvedByName.sort()).toEqual(Object.keys(CANONICAL_ONLY_VIA_CATEGORY_SLUG).sort())
  })

  it('cobertura por la cadena REAL (name + fallback category slug): 49/49 (100%)', () => {
    for (const canonical of canonicals) {
      const literal = CANONICAL_ONLY_VIA_CATEGORY_SLUG[canonical]
      const competition = { name: canonical, category: literal ? slug(literal) : undefined }
      expect(feeBasesCategoryOf(competition), canonical).not.toBeNull()
    }
  })

  it('toda canónica resuelta tiene su fila de honorarios con principal > 0', () => {
    for (const canonical of canonicals) {
      const literal = CANONICAL_ONLY_VIA_CATEGORY_SLUG[canonical]
      const bases = feeBasesCategoryOf({
        name: canonical,
        category: literal ? slug(literal) : undefined,
      })
      expect(bases, canonical).not.toBeNull()
      expect(FEES_BY_BASES_CATEGORY[bases!].principal, canonical).toBeGreaterThan(0)
    }
  })
})
