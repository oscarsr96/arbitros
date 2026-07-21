import { describe, it, expect } from 'vitest'
import { mapCategory, allCanonicalCategories } from '../category-mapping'
import { ARBITRATION_BY_BASES_CATEGORY, SCHEDULE_BY_BASES_CATEGORY } from '../bases-fbm'
import {
  resolveFineCategory,
  CANONICALS_WITHOUT_FINE_CATEGORY,
} from '@/lib/competition-fine-category'

// Las 48 categorías REALES que aparecen en los calendarios de la temporada,
// con el resultado esperado del mapeo. Los conteos (árbitros + oficiales de
// mesa) son los de la tabla oficial de arbitraje de las Bases Generales
// (p. 25), no estimaciones.
type Expectation = {
  literal: string
  canonical: string
  gender: 'masculino' | 'femenino'
  referees: number
  scorers: number
}

const CATEGORIES_48: Expectation[] = [
  // ── 2ª División Autonómica (Bases: 2 árbitros + 2 mesa, ambos géneros) ────
  {
    literal: '2ª Div Aut Fem ORO',
    canonical: '2ª División Autonómica Femenina ORO',
    gender: 'femenino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: '2ª Div Aut Fem PLATA',
    canonical: '2ª División Autonómica Femenina PLATA',
    gender: 'femenino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: '2ª Div Aut Masc BRONCE',
    canonical: '2ª División Autonómica Masculina BRONCE',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: '2ª Div Aut Masc ORO',
    canonical: '2ª División Autonómica Masculina ORO',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: '2ª Div Aut Masc PLATA',
    canonical: '2ª División Autonómica Masculina PLATA',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },

  // ── Minibasket / Liga Marco Aldany (Bases: 1 árbitro + 1 mesa) ────────────
  {
    literal: 'Alv Fem 1ºaño LIGA MARCO ALDANY',
    canonical: 'Alevín Femenino 1er año',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Alv Fem 2ºaño LIGA MARCO ALDANY - ORO',
    canonical: 'Alevín Femenino 2º año ORO',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Alv Fem 2ºaño LIGA MARCO ALDANY - PLATA',
    canonical: 'Alevín Femenino 2º año PLATA',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Alv Mas 1ºaño LIGA MARCO ALDANY',
    canonical: 'Alevín Masculino 1er año',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Alv Mas 2ºaño LIGA MARCO ALDANY - ORO',
    canonical: 'Alevín Masculino 2º año ORO',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Alv Mas 2ºaño LIGA MARCO ALDANY - PLATA',
    canonical: 'Alevín Masculino 2º año PLATA',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Benj F.1ºaño LIGA MARCO ALDANY',
    canonical: 'Benjamín Femenino 1er año',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Benj F.2ºaño LIGA MARCO ALDANY',
    canonical: 'Benjamín Femenino 2º año',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Benj Mas 1ºaño LIGA MARCO ALDANY',
    canonical: 'Benjamín Masculino 1er año',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Benj Mas 2ºaño LIGA MARCO ALDANY',
    canonical: 'Benjamín Masculino 2º año',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },

  // ── Cadete ───────────────────────────────────────────────────────────────
  {
    literal: 'Cadete Fem. 1ºaño',
    canonical: 'Cadete Femenino 1er año',
    gender: 'femenino',
    referees: 2,
    scorers: 1,
  },
  {
    literal: 'Cadete Fem. Pref.',
    canonical: 'Cadete Femenino Preferente',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Cadete Femenino LIGA AHORRAMAS - ORO',
    canonical: 'Cadete Femenino ORO',
    gender: 'femenino',
    referees: 2,
    scorers: 3,
  },
  {
    literal: 'Cadete Femenino LIGA AHORRAMAS - PLATA/BRONCE',
    canonical: 'Cadete Femenino PLATA/BRONCE',
    gender: 'femenino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Cadete Masc. 1ºaño',
    canonical: 'Cadete Masculino 1er año',
    gender: 'masculino',
    referees: 2,
    scorers: 1,
  },
  {
    literal: 'Cadete Masc. Pref.',
    canonical: 'Cadete Masculino Preferente',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Cadete Masculino LIGA AHORRAMAS - ORO',
    canonical: 'Cadete Masculino ORO',
    gender: 'masculino',
    referees: 2,
    scorers: 3,
  },
  {
    literal: 'Cadete Masculino LIGA AHORRAMAS - PLATA/BRONCE',
    canonical: 'Cadete Masculino PLATA/BRONCE',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },

  // ── Infantil ─────────────────────────────────────────────────────────────
  {
    literal: 'Infantil Fem. 1ºaño',
    canonical: 'Infantil Femenino 1er año',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Infantil Fem. Pref.',
    canonical: 'Infantil Femenino Preferente',
    gender: 'femenino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Infantil Femenino LIGA AHORRAMAS - ORO',
    canonical: 'Infantil Femenino ORO',
    gender: 'femenino',
    referees: 2,
    scorers: 3,
  },
  {
    literal: 'Infantil Femenino LIGA AHORRAMAS - PLATA/BRONCE',
    canonical: 'Infantil Femenino PLATA/BRONCE',
    gender: 'femenino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Infantil Masc. 1ºaño',
    canonical: 'Infantil Masculino 1er año',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Infantil Masc. Pref.',
    canonical: 'Infantil Masculino Preferente',
    gender: 'masculino',
    referees: 1,
    scorers: 1,
  },
  {
    literal: 'Infantil Masculino LIGA AHORRAMAS - ORO',
    canonical: 'Infantil Masculino ORO',
    gender: 'masculino',
    referees: 2,
    scorers: 3,
  },
  {
    literal: 'Infantil Masculino LIGA AHORRAMAS - PLATA/BRONCE',
    canonical: 'Infantil Masculino PLATA/BRONCE',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },

  // ── Junior ───────────────────────────────────────────────────────────────
  {
    literal: 'Junior Fem. 1ºaño',
    canonical: 'Junior Femenino 1er año',
    gender: 'femenino',
    referees: 2,
    scorers: 1,
  },
  {
    literal: 'Junior Fem. Pref.',
    canonical: 'Junior Femenino Preferente',
    gender: 'femenino',
    referees: 2,
    scorers: 1,
  },
  {
    literal: 'Junior Femenino LIGA AHORRAMAS - ORO',
    canonical: 'Junior Femenino ORO',
    gender: 'femenino',
    referees: 2,
    scorers: 3,
  },
  {
    literal: 'Junior Femenino LIGA AHORRAMAS - PLATA/BRONCE',
    canonical: 'Junior Femenino PLATA/BRONCE',
    gender: 'femenino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Junior Masc. 1ºaño',
    canonical: 'Junior Masculino 1er año',
    gender: 'masculino',
    referees: 2,
    scorers: 1,
  },
  {
    literal: 'Junior Masc. Pref.',
    canonical: 'Junior Masculino Preferente',
    gender: 'masculino',
    referees: 2,
    scorers: 1,
  },
  {
    literal: 'Junior Masculino LIGA AHORRAMAS - ORO',
    canonical: 'Junior Masculino ORO',
    gender: 'masculino',
    referees: 2,
    scorers: 3,
  },
  {
    literal: 'Junior Masculino LIGA AHORRAMAS - PLATA/BRONCE',
    canonical: 'Junior Masculino PLATA/BRONCE',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },

  // ── Senior: 1ª Autonómica (Ginos) y 1ª Nacional (VIPS) ───────────────────
  {
    literal: 'Liga Ginos Femenina',
    canonical: '1ª División Autonómica Femenina',
    gender: 'femenino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Liga Ginos Masculina ORO',
    canonical: '1ª División Autonómica Masculina ORO',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Liga Ginos Masculina PLATA',
    canonical: '1ª División Autonómica Masculina PLATA',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Liga VIPS Femenina',
    canonical: '1ª División Nacional Femenina',
    gender: 'femenino',
    referees: 2,
    scorers: 3,
  },
  {
    literal: 'Liga VIPS Masculina',
    canonical: '1ª División Nacional Masculina',
    gender: 'masculino',
    referees: 2,
    scorers: 3,
  },

  // ── Sub-22 ───────────────────────────────────────────────────────────────
  {
    literal: 'Sub 22 Femenina',
    canonical: 'Sub-22 Femenina',
    gender: 'femenino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Sub 22 Masc. BRONCE',
    canonical: 'Sub-22 Masculina BRONCE',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Sub 22 Masc. ORO',
    canonical: 'Sub-22 Masculina ORO',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },
  {
    literal: 'Sub 22 Masc. PLATA',
    canonical: 'Sub-22 Masculina PLATA',
    gender: 'masculino',
    referees: 2,
    scorers: 2,
  },
]

describe('cobertura de las 48 categorías reales de los calendarios', () => {
  it('la tabla del test tiene exactamente 48 literales distintos', () => {
    expect(new Set(CATEGORIES_48.map((c) => c.literal)).size).toBe(48)
  })

  it.each(CATEGORIES_48)(
    '"$literal" → $canonical ($referees árbitros + $scorers mesa)',
    ({ literal, canonical, gender, referees, scorers }) => {
      const mapping = mapCategory(literal)
      expect(mapping).not.toBeNull()
      expect(mapping).toEqual({
        canonical,
        gender,
        refereesNeeded: referees,
        scorersNeeded: scorers,
        // Fallback lineal: solo se consulta si la competición no resuelve
        // categoría fina. No se fija aquí, se comprueba que sea uno de los dos
        // valores que admite el importador.
        minRefCategory: expect.stringMatching(/^(provincial|autonomico)$/),
        // Los conteos ya son oficiales (Bases p. 25): nada que confirmar.
        needsConfirmation: false,
      })
    },
  )

  it('ninguna de las 48 queda con needsConfirmation (los conteos son oficiales)', () => {
    for (const { literal } of CATEGORIES_48) {
      expect(mapCategory(literal)?.needsConfirmation).toBe(false)
    }
  })
})

// Muestra verificada a mano contra la columna "TIPO DE ARBITRAJE" de la p. 25.
describe('conteos contra la tabla de arbitraje de las Bases (p. 25)', () => {
  it('una Preferente: Cadete Preferente = 1 árbitro + 1 oficial de mesa', () => {
    const m = mapCategory('Cadete Masc. Pref.')
    expect([m?.refereesNeeded, m?.scorersNeeded]).toEqual([1, 1])
  })

  it('una ORO: Junior ORO = 2 árbitros + 3 oficiales de mesa', () => {
    const m = mapCategory('Junior Masculino LIGA AHORRAMAS - ORO')
    expect([m?.refereesNeeded, m?.scorersNeeded]).toEqual([2, 3])
  })

  it('una minibasket: Alevín = 1 árbitro + 1 oficial de mesa', () => {
    const m = mapCategory('Alv Mas 2ºaño LIGA MARCO ALDANY - ORO')
    expect([m?.refereesNeeded, m?.scorersNeeded]).toEqual([1, 1])
  })

  it('una nacional: 1ª Div. Nac. Masculina = 2 árbitros + 3 oficiales de mesa', () => {
    const m = mapCategory('Liga VIPS Masculina')
    expect([m?.refereesNeeded, m?.scorersNeeded]).toEqual([2, 3])
  })

  it('Junior Preferente (2+1) y Cadete Preferente (1+1) NO comparten arbitraje', () => {
    expect(mapCategory('Junior Masc. Pref.')?.refereesNeeded).toBe(2)
    expect(mapCategory('Cadete Masc. Pref.')?.refereesNeeded).toBe(1)
  })
})

describe('bases-fbm: las dos tablas oficiales', () => {
  it('la Tabla A tiene las 22 filas de la p. 25', () => {
    expect(Object.keys(ARBITRATION_BY_BASES_CATEGORY)).toHaveLength(22)
  })

  it('todas las filas tienen 1 o 2 árbitros y entre 1 y 3 oficiales de mesa', () => {
    for (const [key, row] of Object.entries(ARBITRATION_BY_BASES_CATEGORY)) {
      expect(row.refereesNeeded, key).toBeGreaterThanOrEqual(1)
      expect(row.refereesNeeded, key).toBeLessThanOrEqual(2)
      expect(row.scorersNeeded, key).toBeGreaterThanOrEqual(1)
      expect(row.scorersNeeded, key).toBeLessThanOrEqual(3)
    }
  })

  it('la Tabla B cubre las mismas claves; solo Liga Universitaria queda sin horario', () => {
    expect(Object.keys(SCHEDULE_BY_BASES_CATEGORY).sort()).toEqual(
      Object.keys(ARBITRATION_BY_BASES_CATEGORY).sort(),
    )
    const sinHorario = Object.entries(SCHEDULE_BY_BASES_CATEGORY)
      .filter(([, v]) => v === null)
      .map(([k]) => k)
    expect(sinHorario).toEqual(['liga_universitaria'])
  })

  it('minibasket es el único bloque que cierra a las 18:30 (resto 20:30)', () => {
    expect(SCHEDULE_BY_BASES_CATEGORY.minibasket).toMatchObject({
      day: 'sabado',
      startTime: '09:00',
      endTime: '18:30',
    })
    const otros = Object.entries(SCHEDULE_BY_BASES_CATEGORY).filter(
      ([k, v]) => v !== null && k !== 'minibasket',
    )
    for (const [key, window] of otros) {
      expect(window?.endTime, key).toBe('20:30')
      expect(window?.startTime, key).toBe('09:00')
    }
  })
})

describe('categoría fina (matriz de 7 niveles) para cada canónica', () => {
  it('toda canónica resuelve fineCategory o está en la lista de excepciones', () => {
    const sinTag = allCanonicalCategories().filter(
      (canonical) => resolveFineCategory({ name: canonical, category: '' }) === null,
    )
    expect(sinTag.sort()).toEqual([...CANONICALS_WITHOUT_FINE_CATEGORY].sort())
  })

  it('las excepciones son solo Junior y Cadete de 1er año (fila propia en las Bases)', () => {
    expect(CANONICALS_WITHOUT_FINE_CATEGORY).toHaveLength(4)
    for (const canonical of CANONICALS_WITHOUT_FINE_CATEGORY) {
      expect(canonical).toMatch(/^(Junior|Cadete) (Masculino|Femenino) 1er año$/)
    }
  })

  it('mapea los tres niveles de 1ª Autonómica (Liga Ginos) a sus tags exactos', () => {
    const tag = (name: string) => resolveFineCategory({ name, category: '' })
    expect(tag('1ª División Autonómica Masculina ORO')).toBe('primera_aut_oro')
    expect(tag('1ª División Autonómica Masculina PLATA')).toBe('primera_aut_plata')
    expect(tag('1ª División Autonómica Femenina')).toBe('primera_aut_fem')
  })

  it('todo el minibasket comparte el tag "minibasket"', () => {
    const minibasketLiterals = CATEGORIES_48.filter(
      (c) => c.canonical.startsWith('Alevín') || c.canonical.startsWith('Benjamín'),
    )
    expect(minibasketLiterals).toHaveLength(10)
    for (const { canonical } of minibasketLiterals) {
      expect(resolveFineCategory({ name: canonical, category: '' }), canonical).toBe('minibasket')
    }
  })
})
