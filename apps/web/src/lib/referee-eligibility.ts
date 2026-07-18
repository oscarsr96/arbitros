// ── Modelo de categorías de árbitro y matriz de elegibilidad (FBM) ──────────
//
// Traduce las reglas de la FBM sobre QUÉ categoría de competición puede pitar
// cada nivel de árbitro y en qué ROL (principal / auxiliar-vinculado).
//
// IMPORTANTE (alcance actual): la matriz YA la consume el solver y los pickers
// manuales de asignación, a través del helper único `checkSlotEligibility` de
// este mismo módulo. Si el partido tiene categoría fina y la persona tiene
// nivel fino, valida contra esta matriz; si falta cualquiera de los dos datos,
// hace fallback al ranking lineal `CATEGORY_RANK`/`meetsMinCategory` (ahora en
// `category-rank.ts`), con el mismo comportamiento que antes de esta fase.
//
// El modelo lineal de 4 niveles (provincial<autonomico<nacional<feb) NO puede
// expresar estas reglas porque NO son monótonas: p. ej. un Nacional NO pita 1ª
// autonómica (reservada a los árbitros de 1ª aut) aunque sea "superior".
//
// Las 4 ambigüedades iniciales del borrador ([AMBIGUO-1..4]) ya se resolvieron
// con el usuario y están reflejadas en la matriz (ver comentarios inline).

// Fallback legacy de `checkSlotEligibility` (D2/D4). Importado del módulo hoja
// `category-rank.ts` (no de `mock-data.ts`, que crearía un ciclo: `mock-data.ts`
// → `referee-roster.ts` → `referee-eligibility.ts`).
import { meetsMinCategory } from './category-rank'

export type RefereeLevel =
  | 'nacional'
  | 'feb'
  | 'primera_aut' // 1ª autonómica
  | 'autonomico_oro' // 2ª autonómica oro
  | 'autonomico_plata'
  | 'autonomico_bronce'
  | 'escuela'

export type CompetitionCategory =
  | 'nacional'
  | 'primera_aut_oro' // 1ª autonómica oro (reservada a árbitros de 1ª aut)
  | 'primera_aut_plata' // 1ª autonómica plata (reservada a árbitros de 1ª aut)
  | 'primera_aut_fem' // 1ª autonómica femenina (reservada a árbitros de 1ª aut)
  | 'segunda_aut_oro'
  | 'segunda_aut_plata'
  | 'segunda_aut_bronce'
  | 'junior_pref' // junior preferente (a doble)
  | 'junior_especial_oro'
  | 'junior_especial_plata'
  | 'junior_especial_bronce'
  | 'sub22_oro'
  | 'sub22_plata'
  | 'sub22_bronce'
  | 'cadete_pref' // escuela (se pita solo)
  | 'infantil_pref' // escuela (se pita solo)
  | 'minibasket' // escuela (se pita solo)

export type EligibleRole = 'principal' | 'auxiliar'

export const REFEREE_LEVELS: RefereeLevel[] = [
  'nacional',
  'feb',
  'primera_aut',
  'autonomico_oro',
  'autonomico_plata',
  'autonomico_bronce',
  'escuela',
]

export const REFEREE_LEVEL_LABELS: Record<RefereeLevel, string> = {
  nacional: 'Nacional',
  feb: 'FEB',
  primera_aut: '1ª Autonómica',
  autonomico_oro: 'Autonómico Oro',
  autonomico_plata: 'Autonómico Plata',
  autonomico_bronce: 'Autonómico Bronce',
  escuela: 'Escuela',
}

// Distribución del roster (petición del usuario). Suma = 770.
export const REFEREE_LEVEL_DISTRIBUTION: Record<RefereeLevel, number> = {
  nacional: 60,
  feb: 40,
  primera_aut: 70,
  autonomico_oro: 50,
  autonomico_plata: 100,
  autonomico_bronce: 150,
  escuela: 300,
}

// Mapeo del nivel fino → `category` legacy (la que entiende el solver y la UI
// actual). Mantiene el motor de asignación intacto mientras el nivel fino vive
// en paralelo para la matriz de elegibilidad.
export const LEGACY_CATEGORY_BY_LEVEL: Record<
  RefereeLevel,
  'provincial' | 'autonomico' | 'nacional' | 'feb'
> = {
  nacional: 'nacional',
  feb: 'feb',
  primera_aut: 'autonomico',
  autonomico_oro: 'autonomico',
  autonomico_plata: 'autonomico',
  autonomico_bronce: 'autonomico',
  escuela: 'provincial',
}

// ── Matriz de elegibilidad ──────────────────────────────────────────────────
// level → competición → roles en que ese nivel puede actuar en esa competición.
// Ausente / [] = no pita esa categoría.
export const ELIGIBILITY: Record<
  RefereeLevel,
  Partial<Record<CompetitionCategory, EligibleRole[]>>
> = {
  // NACIONAL: pita nacional (pareja 2×nacional o nacional + 1ª aut vinculado) y
  // el resto de FBM SALVO 1ª autonómica. Siempre principal. Foco: junior
  // especial oro, junior pref, cadete, infantil.
  nacional: {
    nacional: ['principal'],
    segunda_aut_oro: ['principal'],
    segunda_aut_plata: ['principal'],
    segunda_aut_bronce: ['principal'],
    junior_pref: ['principal'],
    junior_especial_oro: ['principal'],
    junior_especial_plata: ['principal'],
    junior_especial_bronce: ['principal'],
    sub22_oro: ['principal'],
    sub22_plata: ['principal'],
    sub22_bronce: ['principal'],
    cadete_pref: ['principal'],
    infantil_pref: ['principal'],
    minibasket: ['principal'],
  },
  // FEB: todo MENOS nacional, 1ª aut y escuela (no pita solo). Principal.
  // segunda_aut_oro es exclusiva de autonomico_oro: feb no la pita.
  feb: {
    segunda_aut_plata: ['principal'],
    segunda_aut_bronce: ['principal'],
    junior_pref: ['principal'],
    junior_especial_oro: ['principal'],
    junior_especial_plata: ['principal'],
    junior_especial_bronce: ['principal'],
    sub22_oro: ['principal'],
    sub22_plata: ['principal'],
    sub22_bronce: ['principal'],
  },
  // 1ª AUT: exclusiva en 1ª autonómica (pareja 2×1ª aut o 1ª aut + autonómico
  // vinculado). Auxiliar de FEB y nacionales. Principal de autonómicos y
  // escuela. Foco principal: 2ª aut, junior pref, sub22 plata/bronce, junior
  // especial plata/bronce.
  primera_aut: {
    // Los 3 subniveles heredan la misma elegibilidad que la antigua
    // primera_aut; refinar si las reglas FBM difieren por oro/plata/fem.
    primera_aut_oro: ['principal'],
    primera_aut_plata: ['principal'],
    primera_aut_fem: ['principal'],
    nacional: ['auxiliar'],
    junior_especial_oro: ['auxiliar'],
    sub22_oro: ['auxiliar'],
    segunda_aut_oro: ['principal'],
    segunda_aut_plata: ['principal'],
    segunda_aut_bronce: ['principal'],
    junior_pref: ['principal'],
    sub22_plata: ['principal'],
    sub22_bronce: ['principal'],
    junior_especial_plata: ['principal'],
    junior_especial_bronce: ['principal'],
    cadete_pref: ['principal'],
    infantil_pref: ['principal'],
    minibasket: ['principal'],
  },
  // AUTONÓMICO ORO: exclusiva en 2ª aut oro. Auxiliar de FEB/nacionales/1ª aut.
  // Principal de 2ª plata, 2ª bronce y escuela.
  autonomico_oro: {
    segunda_aut_oro: ['principal'],
    segunda_aut_plata: ['principal'],
    segunda_aut_bronce: ['principal'],
    primera_aut_oro: ['auxiliar'],
    primera_aut_plata: ['auxiliar'],
    primera_aut_fem: ['auxiliar'],
    nacional: ['auxiliar'],
    junior_especial_oro: ['auxiliar'],
    sub22_oro: ['auxiliar'],
    cadete_pref: ['principal'],
    infantil_pref: ['principal'],
    minibasket: ['principal'],
    junior_pref: ['principal'],
  },
  // AUTONÓMICO PLATA: 2ª plata (exclusiva o con nacionales/1ª aut). Auxiliar de
  // FEB/nacional/1ª aut/2ª oro. Principal de 2ª bronce y escuela.
  autonomico_plata: {
    segunda_aut_plata: ['principal'],
    segunda_aut_bronce: ['principal'],
    segunda_aut_oro: ['auxiliar'],
    nacional: ['auxiliar'],
    primera_aut_oro: ['auxiliar'],
    primera_aut_plata: ['auxiliar'],
    primera_aut_fem: ['auxiliar'],
    junior_especial_oro: ['auxiliar'],
    sub22_oro: ['auxiliar'],
    cadete_pref: ['principal'],
    infantil_pref: ['principal'],
    minibasket: ['principal'],
    junior_pref: ['principal'],
  },
  // AUTONÓMICO BRONCE: como máximo 2ª bronce (con feb/nacional/1ª aut/2ª oro/2ª
  // plata de principal). Principal de escuela. Nada por encima de 2ª bronce.
  autonomico_bronce: {
    segunda_aut_bronce: ['principal', 'auxiliar'],
    cadete_pref: ['principal'],
    infantil_pref: ['principal'],
    minibasket: ['principal'],
    junior_pref: ['principal'],
  },
  // ESCUELA: solos en minibasket, infantil pref, cadete pref. A dobles en junior
  // pref (auxiliar, en especial junto a 1ª aut). Pitan más solos que a dobles.
  escuela: {
    minibasket: ['principal'],
    infantil_pref: ['principal'],
    cadete_pref: ['principal'],
    junior_pref: ['auxiliar'],
  },
}

/**
 * ¿Puede un árbitro de nivel `level` pitar la competición `competition`?
 * Si se pasa `role`, comprueba además que pueda hacerlo en ese rol concreto.
 */
export function canOfficiate(
  level: RefereeLevel,
  competition: CompetitionCategory,
  role?: EligibleRole,
): boolean {
  const roles = ELIGIBILITY[level]?.[competition]
  if (!roles || roles.length === 0) return false
  return role ? roles.includes(role) : true
}

/** Roles posibles de un nivel en una competición ([] si no la pita). */
export function eligibleRoles(
  level: RefereeLevel,
  competition: CompetitionCategory,
): EligibleRole[] {
  return ELIGIBILITY[level]?.[competition] ?? []
}

/** Label del nivel fino para la UI (null si el valor no es un nivel conocido). */
export function refereeLevelLabel(value?: string | null): string | null {
  if (!value) return null
  return REFEREE_LEVEL_LABELS[value as RefereeLevel] ?? null
}

/** ¿`value` es uno de los 7 niveles reconocidos de la matriz de elegibilidad? */
export function isRefereeLevel(value?: string | null): value is RefereeLevel {
  return !!value && (REFEREE_LEVELS as string[]).includes(value)
}

/**
 * Helper ÚNICO de elegibilidad por slot (T3, tasks/todo-solver-7niveles.md).
 * Lo consumen el solver (T4) y los pickers manuales (T6) para decidir si una
 * persona puede ocupar un slot concreto de un partido.
 *
 * - Anotadores (D5): la matriz es solo de árbitros → siempre elegibles.
 * - Modelo fino: si el partido lleva `fineCategory` Y la persona un
 *   `refereeLevel` reconocido, se consulta `eligibleRoles`. El slot
 *   `principal` exige el rol `principal`; el slot `auxiliar` (D3) acepta
 *   también un nivel solo-principal (basta con que pite en algún rol); sin
 *   `slotPosition` (uso genérico, p. ej. un picker sin slot activo) vale
 *   cualquier rol elegible.
 * - Fallback legacy (D2 sin fina en el partido / D4 sin nivel en la persona):
 *   `meetsMinCategory` sobre el ranking lineal de siempre. Sin
 *   `minRefCategory` en el partido → elegible (nada que exigir).
 */
export function checkSlotEligibility(
  person: { role: string; category: string | null; refereeLevel?: string | null },
  competition:
    | { fineCategory?: CompetitionCategory | null; minRefCategory?: string | null }
    | undefined,
  slotPosition?: EligibleRole,
): boolean {
  if (person.role !== 'arbitro') return true

  const fineCategory = competition?.fineCategory
  const level = person.refereeLevel

  if (fineCategory && isRefereeLevel(level)) {
    const roles = eligibleRoles(level, fineCategory)
    if (slotPosition === 'principal') return roles.includes('principal')
    return roles.length > 0
  }

  if (!competition?.minRefCategory) return true
  return meetsMinCategory(person.category, competition.minRefCategory)
}
