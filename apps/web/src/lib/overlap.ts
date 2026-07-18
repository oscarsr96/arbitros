// Primitiva compartida de solapamiento temporal entre dos partidos del MISMO día para
// una misma persona. Unifica el criterio que antes vivía duplicado en dos sitios:
// - solver.ts (hasTimeOverlapWith): comparaba solo HORAS ENTERAS truncadas
//   (parseInt(time.split(':')[0])) y |horaA-horaB|<2, ignorando minutos, duración real,
//   pabellón y viaje/hasCar.
// - schedule-conflicts.ts (panel de verificación pre-publicación): ya usaba minutos +
//   duración real + viaje estimado (estimateTravelMinutes) + hasCar.
// Ambos consumidores ahora comparten esta función.

import { estimateTravelMinutes } from './utils'

export const MATCH_DURATION_MIN = 90
export const CONFLICT_MARGIN_MIN = 30

/** Datos mínimos de un partido de UNA persona necesarios para comparar solapamiento. */
export interface OverlapMatch {
  date: string
  /** Minutos desde medianoche (0-1439). */
  startMin: number
  venueId: string
  municipalityId: string
}

export interface OverlapCtx {
  hasCar: boolean
  getDistanceKm: (originMuniId: string, destMuniId: string) => number
  /** Duración del partido en minutos. Por defecto MATCH_DURATION_MIN. */
  durationMin?: number
}

export interface OverlapResult {
  /** true si los intervalos [start, start+dur] de a y b se solapan. */
  intervalsOverlap: boolean
  /** Minutos entre el fin del partido temprano y el inicio del tardío (negativo si se solapan). */
  gapMin: number
  /** Minutos de viaje estimados entre ambos partidos (0 si mismo pabellón o si no es estimable). */
  travelMin: number
  /** true si a y b comparten pabellón. */
  sameVenue: boolean
  /**
   * true si el viaje es estimable: mismo pabellón, o ambos municipios resueltos
   * (no vacíos/falsy). Si es false, `travelMin` es 0 y los consumidores NO deben aplicar
   * ningún chequeo basado en viaje (evita que un municipio sin resolver caiga en el
   * fallback de distancia de getDistanceKm y produzca rechazos o aceptaciones falsas).
   */
  travelKnown: boolean
}

/** Convierte "HH:MM" a minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Compara dos partidos de la MISMA persona. Días distintos nunca solapan. Mismo día:
 * ordena por startMin (early `e`, late `l`) y calcula solape/hueco/viaje sobre intervalos
 * de duración `ctx.durationMin` (MATCH_DURATION_MIN por defecto). El viaje es 0 si ambos
 * comparten pabellón (encadenar en la misma pista no requiere desplazamiento), o si
 * `travelKnown` sale false (municipio de a o b sin resolver): en ese caso no se llama a
 * `getDistanceKm` para evitar su fallback de distancia.
 */
export function pairOverlap(a: OverlapMatch, b: OverlapMatch, ctx: OverlapCtx): OverlapResult {
  const sameVenue = a.venueId === b.venueId

  if (a.date !== b.date)
    return { intervalsOverlap: false, gapMin: Infinity, travelMin: 0, sameVenue, travelKnown: true }

  const [e, l] = a.startMin <= b.startMin ? [a, b] : [b, a]
  const dur = ctx.durationMin ?? MATCH_DURATION_MIN
  const intervalsOverlap = l.startMin < e.startMin + dur
  const travelKnown = sameVenue || (Boolean(a.municipalityId) && Boolean(b.municipalityId))
  const travelMin =
    sameVenue || !travelKnown
      ? 0
      : estimateTravelMinutes(ctx.getDistanceKm(e.municipalityId, l.municipalityId), ctx.hasCar)
  const gapMin = l.startMin - (e.startMin + dur)

  return { intervalsOverlap, gapMin, travelMin, sameVenue, travelKnown }
}

/**
 * Decisión de conflicto duro para el SOLVER (más estricta que el panel de verificación:
 * exige un colchón adicional `CONFLICT_MARGIN_MIN` sobre el viaje estimado, salvo cuando
 * ambos partidos son en el mismo pabellón, donde encadenar sin margen es válido). Si el
 * viaje no es estimable (`travelKnown=false`, municipio sin resolver) el chequeo de viaje
 * se omite por completo: solo bloquea el solape real de intervalos.
 */
export function isSolverConflict(o: OverlapResult): boolean {
  return (
    o.intervalsOverlap ||
    (!o.sameVenue && o.travelKnown && o.gapMin < o.travelMin + CONFLICT_MARGIN_MIN)
  )
}
