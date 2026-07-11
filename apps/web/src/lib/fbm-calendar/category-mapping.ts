// Mapeo de categoria comercial FBM (columna CATEGORIA del CSV de calendario) a
// categoria canonica del sistema, con los requisitos de arbitraje que aplican.
//
// Los conteos refereesNeeded/scorersNeeded son PROVISIONALES: las categorias de
// club (Preferente / Sub-22 / 2a Div Aut) siguen la convencion mayoritaria de
// mockCompetitions (2 + 1); las ligas nacionales (1a Div Nacional Masc/Fem) y el
// Junior Masculino ORO usan 2 + 3 (decision del designador, plan original), a
// falta de la tabla de arbitraje oficial de las Bases FBM. Por eso TODAS las
// entradas llevan needsConfirmation: true (marca de "ajustar cuando llegue la
// tabla oficial", no un rechazo: el importador SI carga estas filas).
// minRefCategory es ademas juicio PROVISIONAL del planner, pendiente de
// validar con el comite FBM.

import type { RefereeCategory } from '../availability-deadline'

export type CategoryMapping = {
  canonical: string
  refereesNeeded: number
  scorersNeeded: number
  minRefCategory: RefereeCategory
  gender: 'masculino' | 'femenino' | null
  needsConfirmation: boolean
}

// Normaliza para matching robusto: mayusculas, sin tildes, sin puntuacion,
// espacios colapsados. Cubre variantes de espaciado ("Sub 22" / "Sub22") y
// abreviaturas con punto ("Masc.", "Pref.") porque el punto se elimina.
function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Fallback de inferencia de genero. "MASC" cubre tanto la abreviatura
// ("Masc.") como la palabra completa ("Masculino"); igual "FEM" con
// "Fem."/"Femenina".
export function inferGender(webName: string): 'masculino' | 'femenino' | null {
  const normalized = normalizeText(webName)
  if (normalized.includes('MASC')) return 'masculino'
  if (normalized.includes('FEM')) return 'femenino'
  return null
}

type CategoryFamily = {
  // Palabras clave que deben aparecer todas (en cualquier orden/espaciado)
  // para identificar la familia. "PREF" cubre "Pref."/"Preferente", "DIV"
  // cubre "Div"/"División", "AUT" cubre "Aut"/"Autonómica".
  tokens: string[]
  gender: 'masculino' | 'femenino'
  canonical: string
  minRefCategory: RefereeCategory
  refereesNeeded: number
  scorersNeeded: number
}

const CATEGORY_FAMILIES: CategoryFamily[] = [
  {
    tokens: ['JUNIOR', 'PREF'],
    gender: 'masculino',
    canonical: 'Junior Masculino Preferente',
    minRefCategory: 'provincial',
    refereesNeeded: 2,
    scorersNeeded: 1,
  },
  {
    // Junior Masculino ORO (nombre comercial "LIGA AHORRAMAS - ORO"): distinto
    // de la familia JUNIOR+PREF de arriba por el token 'ORO'. 2 árbitros + 3
    // mesa (plan original). Un "Junior Femenino ORO" cae aquí por tokens pero
    // lo rechaza el chequeo de género (no hay entrada femenina confirmada).
    tokens: ['JUNIOR', 'ORO'],
    gender: 'masculino',
    canonical: 'Junior Masculino ORO',
    minRefCategory: 'provincial',
    refereesNeeded: 2,
    scorersNeeded: 3,
  },
  {
    tokens: ['CADETE', 'PREF'],
    gender: 'masculino',
    canonical: 'Cadete Masculino Preferente',
    minRefCategory: 'provincial',
    refereesNeeded: 2,
    scorersNeeded: 1,
  },
  {
    tokens: ['SUB', '22', 'PLATA'],
    gender: 'masculino',
    canonical: 'Sub-22 Masculina PLATA',
    minRefCategory: 'provincial',
    refereesNeeded: 2,
    scorersNeeded: 1,
  },
  {
    // El token '2' evita que "1ª/3ª Div Aut ... BRONCE" mapee en silencio a la
    // canónica "2ª" (el diseño para lo no confirmado es rechazar + informar).
    tokens: ['2', 'DIV', 'AUT', 'BRONCE'],
    gender: 'masculino',
    canonical: '2ª División Autonómica Masculina BRONCE',
    minRefCategory: 'autonomico',
    refereesNeeded: 2,
    scorersNeeded: 1,
  },
  {
    tokens: ['2', 'DIV', 'AUT', 'PLATA'],
    gender: 'femenino',
    canonical: '2ª División Autonómica Femenina PLATA',
    minRefCategory: 'autonomico',
    refereesNeeded: 2,
    scorersNeeded: 1,
  },
  {
    // Ligas nacionales = Liga VIPS (mapeo confirmado a "1ª División Nacional").
    // El token de género ('MASC'/'FEM') separa las dos entradas VIPS: sin él,
    // el early-return por género de mapCategory tumbaría la variante femenina
    // al chocar antes con la masculina (mismos tokens). 2 árbitros + 3 mesa.
    // minRef 'autonomico' = igual que las VIPS demo (comp-001/002) y realista
    // (la 1ª Nacional la arbitran autonómicos).
    tokens: ['VIPS', 'MASC'],
    gender: 'masculino',
    canonical: '1ª División Nacional Masculina',
    minRefCategory: 'autonomico',
    refereesNeeded: 2,
    scorersNeeded: 3,
  },
  {
    tokens: ['VIPS', 'FEM'],
    gender: 'femenino',
    canonical: '1ª División Nacional Femenina',
    minRefCategory: 'autonomico',
    refereesNeeded: 2,
    scorersNeeded: 3,
  },
]

export function mapCategory(webName: string): CategoryMapping | null {
  const normalized = normalizeText(webName)
  const inferredGender = inferGender(webName)

  for (const family of CATEGORY_FAMILIES) {
    if (!family.tokens.every((token) => normalized.includes(token))) continue
    // Si el nombre indica explicitamente el genero opuesto al confirmado
    // para esta familia, no hay entrada valida: se rechaza en vez de
    // mapear mal (p.ej. no hay "Sub-22 Femenina PLATA" confirmada).
    if (inferredGender && inferredGender !== family.gender) return null

    return {
      canonical: family.canonical,
      refereesNeeded: family.refereesNeeded,
      scorersNeeded: family.scorersNeeded,
      minRefCategory: family.minRefCategory,
      gender: family.gender,
      needsConfirmation: true,
    }
  }

  // Categoria no reconocida: el importador la rechazara/omitira.
  return null
}
