// Mapeo de categoria comercial FBM (columna CATEGORIA del CSV de calendario) a
// categoria canonica del sistema, con los requisitos de arbitraje que aplican.
//
// Los conteos refereesNeeded/scorersNeeded YA NO son provisionales: salen de la
// tabla oficial de arbitraje de las Bases Generales (p. 25), codificada en
// `bases-fbm.ts`. Cada regla declara su `basesCategory` (fila de esa tabla) y
// los conteos se derivan de ahi, nunca se escriben a mano aqui. Por eso
// `needsConfirmation` es ahora `false` en todas las entradas.
//
// Lo que SIGUE siendo juicio del planner es `minRefCategory`, el minimo del
// modelo lineal legacy de 4 niveles. Es solo un FALLBACK: cuando la competicion
// resuelve `fineCategory` (ver `competition-fine-category.ts`), la elegibilidad
// la decide la matriz de 7 niveles y `minRefCategory` no se consulta.
//
// Nombres comerciales de los calendarios y su equivalencia oficial, confirmada
// en las Bases (p. 5-6, apartado "COMPETICIONES"):
//   - Liga VIPS          -> 1ª Division Nacional (Masculina / Femenina)
//   - Liga Ginos         -> 1ª Division Autonomica (Masculina ORO/PLATA, Femenina)
//   - Liga Ahorramas     -> Junior / Cadete / Infantil ORO, PLATA y BRONCE
//   - Liga Marco Aldany  -> Minibasket (Alevin y Benjamin, ambos años)

import type { RefereeCategory } from '../availability-deadline'
import { ARBITRATION_BY_BASES_CATEGORY, type BasesCategory } from './bases-fbm'

export type CategoryMapping = {
  canonical: string
  refereesNeeded: number
  scorersNeeded: number
  minRefCategory: RefereeCategory
  gender: 'masculino' | 'femenino' | null
  needsConfirmation: boolean
}

// Normaliza para matching robusto: mayusculas, sin tildes, sin puntuacion,
// espacios colapsados. Cubre variantes de espaciado ("Sub 22" / "Sub22"),
// abreviaturas con punto ("Masc.", "Pref.") y ordinales ("1ºaño" -> "1 ANO"),
// porque tanto el punto como la "º" se convierten en espacio.
// La frontera letra/digito se separa ademas explicitamente para que "Sub22" y
// "Sub 22" produzcan los mismos tokens: el matching es por token completo.
function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensOf(input: string): Set<string> {
  const normalized = normalizeText(input)
  return new Set(normalized.length > 0 ? normalized.split(' ') : [])
}

const MALE_TOKENS = ['MASC', 'MAS', 'MASCULINO', 'MASCULINA']
const FEMALE_TOKENS = ['FEM', 'F', 'FEMENINO', 'FEMENINA']

// Inferencia de genero por TOKEN COMPLETO, no por subcadena. Es deliberado:
// "Cadete Femenino LIGA AHORRAMAS - ORO" contiene la subcadena "MAS" dentro de
// "AHORRAMAS", asi que un `includes('MAS')` lo clasificaria como masculino.
export function inferGender(webName: string): 'masculino' | 'femenino' | null {
  const tokens = tokensOf(webName)
  if (MALE_TOKENS.some((t) => tokens.has(t))) return 'masculino'
  if (FEMALE_TOKENS.some((t) => tokens.has(t))) return 'femenino'
  return null
}

type CategoryRule = {
  // Todos estos tokens deben aparecer (como token completo, en cualquier orden).
  tokens: string[]
  // Ninguno de estos puede aparecer. Sirve para que una regla "sin nivel"
  // (p. ej. "Sub 22 Femenina") no capture las variantes con nivel.
  notTokens?: string[]
  gender: 'masculino' | 'femenino'
  canonical: string
  // Fila de la Tabla A de las Bases: de aqui salen los conteos de arbitraje.
  basesCategory: BasesCategory
  minRefCategory: RefereeCategory
}

// Las 48 categorias reales de los calendarios de la temporada. Una regla por
// familia de literal x genero. Orden: primera coincidencia gana, pero las
// reglas estan construidas para ser mutuamente excluyentes (los tokens de
// nivel ORO/PLATA/BRONCE y los `notTokens` evitan solapes).
const CATEGORY_RULES: CategoryRule[] = [
  // ── Senior: 1ª Division Nacional (Liga VIPS) ──────────────────────────────
  {
    tokens: ['VIPS'],
    gender: 'masculino',
    canonical: '1ª División Nacional Masculina',
    basesCategory: 'primera_nac_masc',
    minRefCategory: 'autonomico',
  },
  {
    tokens: ['VIPS'],
    gender: 'femenino',
    canonical: '1ª División Nacional Femenina',
    basesCategory: 'primera_nac_fem',
    minRefCategory: 'autonomico',
  },

  // ── Senior: 1ª Division Autonomica (Liga Ginos) ───────────────────────────
  {
    tokens: ['GINOS', 'ORO'],
    gender: 'masculino',
    canonical: '1ª División Autonómica Masculina ORO',
    basesCategory: 'primera_aut_masc_oro',
    minRefCategory: 'autonomico',
  },
  {
    tokens: ['GINOS', 'PLATA'],
    gender: 'masculino',
    canonical: '1ª División Autonómica Masculina PLATA',
    basesCategory: 'primera_aut_masc_plata',
    minRefCategory: 'autonomico',
  },
  {
    // La Ginos femenina no tiene niveles (Bases A.6): un unico grupo.
    tokens: ['GINOS'],
    notTokens: ['ORO', 'PLATA', 'BRONCE'],
    gender: 'femenino',
    canonical: '1ª División Autonómica Femenina',
    basesCategory: 'primera_aut_fem',
    minRefCategory: 'autonomico',
  },

  // ── Senior: 2ª Division Autonomica ────────────────────────────────────────
  // El token '2' es obligatorio: evita que una "1ª/3ª Div Aut ..." mapee en
  // silencio a la canonica de 2ª. Las Bases (p. 25) dan un unico tipo de
  // arbitraje para toda la 2ª Aut masculina y otro para toda la femenina, sin
  // distinguir nivel; el nivel solo sobrevive en la canonica y en fineCategory.
  {
    tokens: ['2', 'DIV', 'AUT', 'ORO'],
    gender: 'masculino',
    canonical: '2ª División Autonómica Masculina ORO',
    basesCategory: 'segunda_aut_masc',
    minRefCategory: 'autonomico',
  },
  {
    tokens: ['2', 'DIV', 'AUT', 'PLATA'],
    gender: 'masculino',
    canonical: '2ª División Autonómica Masculina PLATA',
    basesCategory: 'segunda_aut_masc',
    minRefCategory: 'autonomico',
  },
  {
    tokens: ['2', 'DIV', 'AUT', 'BRONCE'],
    gender: 'masculino',
    canonical: '2ª División Autonómica Masculina BRONCE',
    basesCategory: 'segunda_aut_masc',
    minRefCategory: 'autonomico',
  },
  {
    tokens: ['2', 'DIV', 'AUT', 'ORO'],
    gender: 'femenino',
    canonical: '2ª División Autonómica Femenina ORO',
    basesCategory: 'segunda_aut_fem',
    minRefCategory: 'autonomico',
  },
  {
    tokens: ['2', 'DIV', 'AUT', 'PLATA'],
    gender: 'femenino',
    canonical: '2ª División Autonómica Femenina PLATA',
    basesCategory: 'segunda_aut_fem',
    minRefCategory: 'autonomico',
  },
  {
    // Sin calendario esta temporada, pero las Bases (A.8) sí convocan BRONCE
    // femenino: se deja mapeado para que no reviente si aparece.
    tokens: ['2', 'DIV', 'AUT', 'BRONCE'],
    gender: 'femenino',
    canonical: '2ª División Autonómica Femenina BRONCE',
    basesCategory: 'segunda_aut_fem',
    minRefCategory: 'autonomico',
  },

  // ── Sub-22 ────────────────────────────────────────────────────────────────
  {
    tokens: ['SUB', '22', 'ORO'],
    gender: 'masculino',
    canonical: 'Sub-22 Masculina ORO',
    basesCategory: 'sub22_masc_oro_y_fem',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['SUB', '22', 'PLATA'],
    gender: 'masculino',
    canonical: 'Sub-22 Masculina PLATA',
    basesCategory: 'sub22_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['SUB', '22', 'BRONCE'],
    gender: 'masculino',
    canonical: 'Sub-22 Masculina BRONCE',
    basesCategory: 'sub22_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    // La Sub-22 femenina no tiene niveles en los calendarios y las Bases la
    // facturan junto a la masculina ORO ("Sub-22 Mas. ORO y Sub-22 Fem.").
    tokens: ['SUB', '22'],
    notTokens: ['ORO', 'PLATA', 'BRONCE'],
    gender: 'femenino',
    canonical: 'Sub-22 Femenina',
    basesCategory: 'sub22_masc_oro_y_fem',
    minRefCategory: 'provincial',
  },

  // ── Junior (Liga Ahorramas + Preferente + 1er año) ────────────────────────
  {
    tokens: ['JUNIOR', 'ORO'],
    gender: 'masculino',
    canonical: 'Junior Masculino ORO',
    basesCategory: 'junior_oro',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['JUNIOR', 'ORO'],
    gender: 'femenino',
    canonical: 'Junior Femenino ORO',
    basesCategory: 'junior_oro',
    minRefCategory: 'provincial',
  },
  {
    // Los calendarios agrupan los dos niveles en un solo literal
    // ("... - PLATA/BRONCE"), igual que las Bases en una sola fila.
    tokens: ['JUNIOR', 'PLATA', 'BRONCE'],
    gender: 'masculino',
    canonical: 'Junior Masculino PLATA/BRONCE',
    basesCategory: 'junior_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['JUNIOR', 'PLATA', 'BRONCE'],
    gender: 'femenino',
    canonical: 'Junior Femenino PLATA/BRONCE',
    basesCategory: 'junior_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['JUNIOR', 'PREF'],
    gender: 'masculino',
    canonical: 'Junior Masculino Preferente',
    basesCategory: 'junior_preferente',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['JUNIOR', 'PREF'],
    gender: 'femenino',
    canonical: 'Junior Femenino Preferente',
    basesCategory: 'junior_preferente',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['JUNIOR', '1', 'ANO'],
    gender: 'masculino',
    canonical: 'Junior Masculino 1er año',
    basesCategory: 'junior_primer_ano',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['JUNIOR', '1', 'ANO'],
    gender: 'femenino',
    canonical: 'Junior Femenino 1er año',
    basesCategory: 'junior_primer_ano',
    minRefCategory: 'provincial',
  },

  // ── Cadete (Liga Ahorramas + Preferente + 1er año) ────────────────────────
  {
    tokens: ['CADETE', 'ORO'],
    gender: 'masculino',
    canonical: 'Cadete Masculino ORO',
    basesCategory: 'cadete_oro',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['CADETE', 'ORO'],
    gender: 'femenino',
    canonical: 'Cadete Femenino ORO',
    basesCategory: 'cadete_oro',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['CADETE', 'PLATA', 'BRONCE'],
    gender: 'masculino',
    canonical: 'Cadete Masculino PLATA/BRONCE',
    basesCategory: 'cadete_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['CADETE', 'PLATA', 'BRONCE'],
    gender: 'femenino',
    canonical: 'Cadete Femenino PLATA/BRONCE',
    basesCategory: 'cadete_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    // OJO: Cadete Preferente es 1 ARBITRO + 1 mesa (Bases p. 25), la unica
    // categoria de club que se pita en solitario junto a infantil y minibasket.
    tokens: ['CADETE', 'PREF'],
    gender: 'masculino',
    canonical: 'Cadete Masculino Preferente',
    basesCategory: 'cadete_preferente',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['CADETE', 'PREF'],
    gender: 'femenino',
    canonical: 'Cadete Femenino Preferente',
    basesCategory: 'cadete_preferente',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['CADETE', '1', 'ANO'],
    gender: 'masculino',
    canonical: 'Cadete Masculino 1er año',
    basesCategory: 'cadete_primer_ano',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['CADETE', '1', 'ANO'],
    gender: 'femenino',
    canonical: 'Cadete Femenino 1er año',
    basesCategory: 'cadete_primer_ano',
    minRefCategory: 'provincial',
  },

  // ── Infantil (Liga Ahorramas + Preferente + 1er año) ──────────────────────
  {
    tokens: ['INFANTIL', 'ORO'],
    gender: 'masculino',
    canonical: 'Infantil Masculino ORO',
    basesCategory: 'infantil_oro',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['INFANTIL', 'ORO'],
    gender: 'femenino',
    canonical: 'Infantil Femenino ORO',
    basesCategory: 'infantil_oro',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['INFANTIL', 'PLATA', 'BRONCE'],
    gender: 'masculino',
    canonical: 'Infantil Masculino PLATA/BRONCE',
    basesCategory: 'infantil_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['INFANTIL', 'PLATA', 'BRONCE'],
    gender: 'femenino',
    canonical: 'Infantil Femenino PLATA/BRONCE',
    basesCategory: 'infantil_plata_bronce',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['INFANTIL', 'PREF'],
    gender: 'masculino',
    canonical: 'Infantil Masculino Preferente',
    basesCategory: 'infantil_preferente_y_primer_ano',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['INFANTIL', 'PREF'],
    gender: 'femenino',
    canonical: 'Infantil Femenino Preferente',
    basesCategory: 'infantil_preferente_y_primer_ano',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['INFANTIL', '1', 'ANO'],
    gender: 'masculino',
    canonical: 'Infantil Masculino 1er año',
    basesCategory: 'infantil_preferente_y_primer_ano',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['INFANTIL', '1', 'ANO'],
    gender: 'femenino',
    canonical: 'Infantil Femenino 1er año',
    basesCategory: 'infantil_preferente_y_primer_ano',
    minRefCategory: 'provincial',
  },

  // ── Minibasket (Liga Marco Aldany): Alevin y Benjamin ─────────────────────
  // Todas las variantes comparten la misma fila de las Bases ("Competiciones
  // Minibasket", 1 + 1); el año y el nivel solo se conservan en la canonica
  // para no fusionar competiciones distintas en el importador.
  {
    tokens: ['ALV', '1', 'ANO'],
    gender: 'masculino',
    canonical: 'Alevín Masculino 1er año',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['ALV', '1', 'ANO'],
    gender: 'femenino',
    canonical: 'Alevín Femenino 1er año',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['ALV', '2', 'ANO', 'ORO'],
    gender: 'masculino',
    canonical: 'Alevín Masculino 2º año ORO',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['ALV', '2', 'ANO', 'ORO'],
    gender: 'femenino',
    canonical: 'Alevín Femenino 2º año ORO',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['ALV', '2', 'ANO', 'PLATA'],
    gender: 'masculino',
    canonical: 'Alevín Masculino 2º año PLATA',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['ALV', '2', 'ANO', 'PLATA'],
    gender: 'femenino',
    canonical: 'Alevín Femenino 2º año PLATA',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['BENJ', '1', 'ANO'],
    gender: 'masculino',
    canonical: 'Benjamín Masculino 1er año',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['BENJ', '1', 'ANO'],
    gender: 'femenino',
    canonical: 'Benjamín Femenino 1er año',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['BENJ', '2', 'ANO'],
    gender: 'masculino',
    canonical: 'Benjamín Masculino 2º año',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
  {
    tokens: ['BENJ', '2', 'ANO'],
    gender: 'femenino',
    canonical: 'Benjamín Femenino 2º año',
    basesCategory: 'minibasket',
    minRefCategory: 'provincial',
  },
]

/**
 * Mapea el literal de CATEGORIA del CSV a la categoria canonica del sistema.
 * `null` = categoria desconocida. NO es un descarte silencioso: el importador
 * (`materializeImport`) aborta con `UnmappedCategoryError` listando todos los
 * literales sin mapear, para que ninguna fila se pierda sin enterarnos.
 */
function findRule(webName: string): CategoryRule | null {
  const tokens = tokensOf(webName)
  const gender = inferGender(webName)

  for (const rule of CATEGORY_RULES) {
    if (rule.gender !== gender) continue
    if (!rule.tokens.every((token) => tokens.has(token))) continue
    if (rule.notTokens?.some((token) => tokens.has(token))) continue
    return rule
  }

  return null
}

export function mapCategory(webName: string): CategoryMapping | null {
  const rule = findRule(webName)
  if (rule === null) return null

  const counts = ARBITRATION_BY_BASES_CATEGORY[rule.basesCategory]
  return {
    canonical: rule.canonical,
    refereesNeeded: counts.refereesNeeded,
    scorersNeeded: counts.scorersNeeded,
    minRefCategory: rule.minRefCategory,
    gender: rule.gender,
    needsConfirmation: false,
  }
}

/**
 * Fila de las Bases a la que pertenece la categoría, para consultar la Tabla B
 * (día y franja horaria). Es una función aparte y no un campo de
 * `CategoryMapping` para no cambiar la forma de ese objeto, sobre la que ya hay
 * aserciones `toEqual` exactas en los tests de mapeo y de cobertura.
 */
export function basesCategoryOf(webName: string): BasesCategory | null {
  return findRule(webName)?.basesCategory ?? null
}

/** Todas las categorias canonicas que puede producir `mapCategory`. */
export function allCanonicalCategories(): string[] {
  return [...new Set(CATEGORY_RULES.map((r) => r.canonical))]
}
