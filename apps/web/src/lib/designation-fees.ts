// Honorarios de arbitraje por designación (Fase 4, tarea 4.1.3).
//
// Módulo HOJA y puro (sin IO, sin imports de mock-data): resuelve el honorario
// € que cobra una persona en un partido según la CATEGORÍA DEL PARTIDO (fila
// de la Tabla C de las Bases, p. 25, `FEES_BY_BASES_CATEGORY`) y la POSICIÓN
// del slot (principal/auxiliar/anotador/cronometrador/24"). NUNCA según el
// nivel/categoría del árbitro. Es independiente de todo lo de desplazamiento
// (`getPersonTravelCost`/`calculateDailyTravelCost`): honorarios y kilometraje
// son dos conceptos de liquidación separados.
//
// Cadena de resolución: designación → partido → competición → fila de Bases.
//   - `competition.name` es la CANÓNICA ('1ª División Nacional Masculina',
//     ver materialize-import.ts) y solo una parte de las canónicas tokeniza
//     con las reglas de `basesCategoryOf` (pensadas para literales CSV:
//     'VIPS', 'GINOS', 'DIV AUT', 'PREF', 'ALV', 'BENJ' no aparecen en la
//     canónica).
//   - `competition.category` es el slug del literal CSV original
//     ('liga-vips-masculina'), cuyos tokens SÍ resuelven siempre.
// Por eso se intenta `name` primero y `category` como fallback. Si ninguno
// resuelve → `fee: null` con `reason`, NUNCA 0 € silencioso.

import { isValidPositionForRole, type DesignationPosition } from './designation-positions'
import { FEES_BY_BASES_CATEGORY, type BasesCategory } from './fbm-calendar/bases-fbm'
import { basesCategoryOf } from './fbm-calendar/category-mapping'

/** Subconjunto de `EnrichedDesignation` que necesita la resolución. */
export type FeeDesignation = {
  role: 'arbitro' | 'anotador'
  position?: DesignationPosition
}

/** Subconjunto de `EnrichedMatch['competition']` que necesita la resolución. */
export type FeeCompetition = {
  name: string
  category?: string | null
}

export type DesignationFeeResult = {
  /** Importe € de la Tabla C, o `null` si no se pudo resolver (ver `reason`). */
  fee: number | null
  basesCategory: BasesCategory | null
  /** Presente solo cuando `fee` es `null`: por qué no se pudo resolver. */
  reason?: string
}

/**
 * Fila de las Bases (Tabla C) de una competición: primero por `name`
 * (canónica) y si no tokeniza, por `category` (slug del literal CSV).
 */
export function feeBasesCategoryOf(competition: FeeCompetition): BasesCategory | null {
  const byName = basesCategoryOf(competition.name)
  if (byName !== null) return byName
  return competition.category ? basesCategoryOf(competition.category) : null
}

/**
 * Honorario € de una designación según la categoría del PARTIDO y la posición
 * del slot. Un `fee: 0` es un importe real de la tabla (p. ej. auxiliar en
 * categorías de árbitro único); lo irresoluble siempre es `fee: null`.
 */
export function resolveDesignationFee(
  designation: FeeDesignation,
  competition: FeeCompetition | null | undefined,
): DesignationFeeResult {
  if (!competition) {
    return { fee: null, basesCategory: null, reason: 'partido sin competición resuelta' }
  }

  const basesCategory = feeBasesCategoryOf(competition)
  if (basesCategory === null) {
    return {
      fee: null,
      basesCategory: null,
      reason: `competición "${competition.name}" sin fila en la Tabla C de las Bases (p. 25)`,
    }
  }

  const fees = FEES_BY_BASES_CATEGORY[basesCategory]
  const { role, position } = designation

  if (position !== undefined) {
    if (!isValidPositionForRole(position, role)) {
      return {
        fee: null,
        basesCategory,
        reason: `posición "${position}" inválida para el rol "${role}"`,
      }
    }
    // La posición ES la clave de la fila: principal/auxiliar/anotador/
    // cronometrador/veinticuatro (mismos literales en ambos módulos).
    return { fee: fees[position], basesCategory }
  }

  // Designación legacy sin posición (las del piloto).
  if (role === 'arbitro') {
    // En la Tabla C toda fila cumple principal === auxiliar, o bien
    // auxiliar === 0 porque la categoría se pita con UN árbitro (y entonces el
    // único slot es el principal). En ambos casos el honorario del árbitro sin
    // posición es el de principal. (Invariante cubierto por test.)
    return { fee: fees.principal, basesCategory }
  }
  // Mesa sin posición: anotador/cronometrador/24" cobran importes distintos en
  // la misma fila; inventar una posición liquidaría mal.
  return {
    fee: null,
    basesCategory,
    reason: 'designación de mesa sin posición: anotador/cronometrador/24" cobran distinto',
  }
}

export type DesignationFeeEntry = {
  designation: FeeDesignation
  competition: FeeCompetition | null | undefined
}

export type FeesSummary = {
  /** Suma € de los honorarios resueltos (exacta a céntimo). */
  totalFees: number
  resolved: number
  /** Designaciones con `fee: null`: deben reportarse, nunca sumarse como 0. */
  unresolved: number
}

/**
 * Agrega los honorarios de una lista de designaciones (pensado para el panel
 * de reportes, tarea 4.1.4). Acumula en céntimos para que la suma de importes
 * con dos decimales no arrastre error de coma flotante.
 */
export function sumDesignationFees(entries: readonly DesignationFeeEntry[]): FeesSummary {
  let cents = 0
  let resolved = 0
  let unresolved = 0
  for (const { designation, competition } of entries) {
    const result = resolveDesignationFee(designation, competition)
    if (result.fee === null) {
      unresolved++
    } else {
      resolved++
      cents += Math.round(result.fee * 100)
    }
  }
  return { totalFees: cents / 100, resolved, unresolved }
}
