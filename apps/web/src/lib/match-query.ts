// Filtrado de partidos por ventana temporal, para que las rutas API no tengan
// que devolver el calendario entero (con la temporada real son ~24.500 partidos
// ≈ 20 MB por request).
//
// La unidad natural de filtrado es la JORNADA FBM: viernes anterior al sábado,
// sábado, domingo y lunes-jueves siguientes (ver matchday-availability.ts). Un
// `route.ts` de Next solo puede exportar handlers HTTP, así que estos helpers
// viven aquí.

import { getMatchdayWindow, getJornadaSaturdayForDate } from './matchday-availability'

export interface MatchDateRange {
  from?: string
  to?: string
}

export interface MatchLike {
  date: string
}

/**
 * Traduce los parámetros de query a un rango [from, to] inclusivo.
 *
 * - `jornada=YYYY-MM-DD` (sábado de la jornada) → ventana viernes→jueves.
 * - `from` / `to` sueltos → rango explícito; cualquiera de los dos puede faltar
 *   (extremo abierto).
 * - Sin parámetros → rango vacío = sin filtro (compatibilidad: los consumidores
 *   actuales siguen recibiendo todos los partidos).
 */
export function parseMatchRange(searchParams: URLSearchParams): MatchDateRange {
  const jornada = searchParams.get('jornada')
  if (jornada) {
    const window = getMatchdayWindow(jornada)
    return { from: window.friday, to: window.thursday }
  }
  return {
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  }
}

/** Filtra por rango inclusivo. Sin `from` ni `to` devuelve la lista tal cual. */
export function filterMatchesByRange<T extends MatchLike>(
  matches: T[],
  range: MatchDateRange,
): T[] {
  if (!range.from && !range.to) return matches
  return matches.filter((m) => {
    if (range.from && m.date < range.from) return false
    if (range.to && m.date > range.to) return false
    return true
  })
}

export interface JornadaSummary {
  /** Sábado que identifica la jornada (clave para `?jornada=`). */
  saturday: string
  /** Viernes y jueves que delimitan la ventana. */
  from: string
  to: string
  count: number
}

/**
 * Agrupa TODOS los partidos por jornada FBM y devuelve el índice ordenado por
 * fecha. Alimenta el selector de jornada: se calcula sobre el calendario entero
 * pero solo viajan ~29 entradas, así que la UI puede ofrecer todas las jornadas
 * sin descargarse los partidos.
 *
 * Se agrupa con `getJornadaSaturdayForDate` (la inversa de `getMatchdayWindow`)
 * en vez de recorrer sábados del calendario: así las jornadas sin partidos
 * simplemente no aparecen, y no se asume que las semanas sean consecutivas.
 */
export function listJornadas<T extends MatchLike>(matches: T[]): JornadaSummary[] {
  const counts = new Map<string, number>()
  for (const m of matches) {
    const saturday = getJornadaSaturdayForDate(m.date)
    counts.set(saturday, (counts.get(saturday) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([saturday, count]) => {
      const window = getMatchdayWindow(saturday)
      return { saturday, from: window.friday, to: window.thursday, count }
    })
    .sort((a, b) => a.saturday.localeCompare(b.saturday))
}

/** Primera y última fecha del calendario, para que la UI sepa qué jornada pedir. */
export function getMatchesDateRange<T extends MatchLike>(
  matches: T[],
): { minDate: string; maxDate: string } | null {
  if (matches.length === 0) return null
  let minDate = matches[0].date
  let maxDate = matches[0].date
  for (const m of matches) {
    if (m.date < minDate) minDate = m.date
    if (m.date > maxDate) maxDate = m.date
  }
  return { minDate, maxDate }
}
