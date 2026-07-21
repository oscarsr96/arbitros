// Detección de conflictos de horario para el panel de verificación pre-publicación
// (Tanda 2, Feature E). Módulo HOJA client-safe: sin fs, sin `new Date()`/`Date.now()`,
// sin `Math.random()`, determinista. No importa mock-data (evita acoplar este cálculo a
// las fuentes de datos concretas y a cualquier dependencia server-only que arrastre
// mock-data). El llamador (asignacion-view.tsx) resuelve los datos con los helpers de
// mock-data y se los pasa a `getPublishConflicts` por parámetro.
//
// Modelo: cada partido ocupa [start, start + MATCH_DURATION_MIN] en minutos desde
// medianoche. El viaje entre dos partidos del mismo día usa `estimateTravelMinutes`
// (lib/utils.ts) sobre la distancia entre los municipios de los pabellones; viaje = 0 si
// es el mismo pabellón.

import { pairOverlap, timeToMinutes, MATCH_DURATION_MIN, CONFLICT_MARGIN_MIN } from './overlap'
import type { DesignationStatus } from './mock-data-client'

export { MATCH_DURATION_MIN, CONFLICT_MARGIN_MIN }

/** Entrada ya resuelta de un partido de UNA persona en UN día. */
export interface DayConflictEntry {
  personId: string
  personName?: string
  personNick?: string
  date: string
  /** Hora de inicio en minutos desde medianoche (0-1439). */
  startMin: number
  venueId: string
  municipalityId: string
  matchId: string
  hasCar: boolean
}

export type ScheduleConflictReason = 'overlap' | 'insufficient-gap' | 'tight-gap'

export interface ScheduleConflict {
  personId: string
  personName?: string
  personNick?: string
  date: string
  matchAId: string
  matchBId: string
  severity: 'error' | 'warning'
  reason: ScheduleConflictReason
  /** Minutos entre el fin de A y el inicio de B (negativo si hay solape). */
  gapMin: number
  /** Minutos de viaje estimados de A a B (0 si mismo pabellón). */
  travelMin: number
}

function buildConflict(
  a: DayConflictEntry,
  b: DayConflictEntry,
  severity: ScheduleConflict['severity'],
  reason: ScheduleConflictReason,
  gapMin: number,
  travelMin: number,
): ScheduleConflict {
  return {
    personId: a.personId,
    personName: a.personName,
    personNick: a.personNick,
    date: a.date,
    matchAId: a.matchId,
    matchBId: b.matchId,
    severity,
    reason,
    gapMin,
    travelMin,
  }
}

/**
 * Detecta conflictos de horario entre los partidos de UNA persona en UN día.
 * Pura: no importa mock-data, no muta `entries`, determinista.
 *
 * - ERROR `overlap`: los intervalos [start, start+90] se solapan (se compara CUALQUIER
 *   par, incluso mismo pabellón: nadie está en dos partidos a la vez).
 * - ERROR `insufficient-gap`: el hueco entre dos partidos CONSECUTIVOS (ordenados por
 *   inicio) es menor que el viaje estimado entre ambos.
 * - AVISO `tight-gap`: el hueco es menor que viaje + CONFLICT_MARGIN_MIN. Exento si
 *   ambos partidos son en el mismo pabellón (encadenar en la misma pista es deseable).
 *
 * Si el viaje entre un par no es estimable (`travelKnown=false`, municipio de alguno de
 * los pabellones sin resolver) no se emite `insufficient-gap` ni `tight-gap` para ese
 * par: solo queda el error `overlap` si los intervalos se cruzan.
 */
export function detectDayConflicts(
  entries: DayConflictEntry[],
  getDistanceKm: (originMuniId: string, destMuniId: string) => number,
): ScheduleConflict[] {
  if (entries.length < 2) return []

  const sorted = [...entries].sort(
    (a, b) => a.startMin - b.startMin || a.matchId.localeCompare(b.matchId),
  )
  const conflicts: ScheduleConflict[] = []

  // Solape: se compara cada par (no solo consecutivos), porque con duración fija un
  // partido puede solapar con varios otros del mismo día.
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      const { intervalsOverlap, gapMin, travelMin } = pairOverlap(a, b, {
        hasCar: a.hasCar,
        getDistanceKm,
      })
      if (intervalsOverlap) {
        conflicts.push(buildConflict(a, b, 'error', 'overlap', gapMin, travelMin))
      }
    }
  }

  // Hueco insuficiente / justo: solo entre partidos consecutivos en el orden temporal,
  // y solo si ese par no ha sido ya marcado como solape.
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const { intervalsOverlap, gapMin, travelMin, travelKnown, sameVenue } = pairOverlap(a, b, {
      hasCar: a.hasCar,
      getDistanceKm,
    })
    if (intervalsOverlap) continue // ya cubierto por el chequeo de solape
    if (!travelKnown) continue // municipio sin resolver: el viaje no es estimable

    if (gapMin < travelMin) {
      conflicts.push(buildConflict(a, b, 'error', 'insufficient-gap', gapMin, travelMin))
    } else if (!sameVenue && gapMin < travelMin + CONFLICT_MARGIN_MIN) {
      conflicts.push(buildConflict(a, b, 'warning', 'tight-gap', gapMin, travelMin))
    }
  }

  return conflicts
}

/** Designación mínima que necesita `getPublishConflicts` (no acopla al tipo de mock-data). */
export interface PublishConflictDesignation {
  matchId: string
  personId: string
  status: DesignationStatus
}

export interface PublishConflictMatch {
  date: string
  time: string
  venueId: string
}

export interface PublishConflictPerson {
  name?: string
  nick?: string | null
  hasCar: boolean
  municipalityId: string
}

export interface PublishConflictHelpers {
  getMatch: (matchId: string) => PublishConflictMatch | undefined
  getVenueMunicipality: (venueId: string) => string | undefined
  getPerson: (personId: string) => PublishConflictPerson | undefined
  getDistanceKm: (originMuniId: string, destMuniId: string) => number
}

/**
 * Agrupa TODAS las designaciones por personId+fecha, resuelve los datos necesarios vía
 * `helpers` y delega en `detectDayConflicts` por cada grupo. Devuelve la lista plana de
 * conflictos (cada uno ya lleva personId/personName/personNick/date, por lo que agrupar
 * por persona en la UI es un simple reduce del lado del llamador).
 */
export function getPublishConflicts(
  designations: PublishConflictDesignation[],
  helpers: PublishConflictHelpers,
): ScheduleConflict[] {
  const groups = new Map<string, DayConflictEntry[]>()

  for (const designation of designations) {
    const match = helpers.getMatch(designation.matchId)
    if (!match) continue

    const person = helpers.getPerson(designation.personId)
    if (!person) continue

    const municipalityId = helpers.getVenueMunicipality(match.venueId)
    if (!municipalityId) continue

    const entry: DayConflictEntry = {
      personId: designation.personId,
      personName: person.name,
      personNick: person.nick ?? undefined,
      date: match.date,
      startMin: timeToMinutes(match.time),
      venueId: match.venueId,
      municipalityId,
      matchId: designation.matchId,
      hasCar: person.hasCar,
    }

    const key = `${designation.personId}|${match.date}`
    const group = groups.get(key)
    if (group) {
      group.push(entry)
    } else {
      groups.set(key, [entry])
    }
  }

  const conflicts: ScheduleConflict[] = []
  for (const entries of groups.values()) {
    conflicts.push(...detectDayConflicts(entries, helpers.getDistanceKm))
  }
  return conflicts
}
