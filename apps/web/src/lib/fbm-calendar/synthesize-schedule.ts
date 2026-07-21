// Síntesis de horarios para los partidos que el calendario oficial emite con
// HORA = 00:00 (~87% de la temporada: la FBM aún no había fijado horario cuando
// se publicaron los calendarios).
//
// Regla de las Bases (p. 56): "será obligatorio programar los horarios de los
// partidos de forma escalonada". Se implementa literal: dentro de cada
// (pabellón, fecha) los partidos se reparten en slots consecutivos de
// MATCH_DURATION_MIN minutos desde el inicio de la franja de su categoría
// (Tabla B de las Bases, ver `bases-fbm.ts`).
//
// Tres invariantes:
//  1. La hora REAL del CSV es dato, no simulación: se respeta tal cual y sale
//     con `timeIsEstimated: false`. Ocupa slot igual que las sintetizadas.
//  2. Toda hora sintetizada cae dentro de [startTime, endTime] de la franja de
//     su categoría (endTime es la hora de INICIO más tardía permitida, no la de
//     finalización: un partido que empieza a las 20:30 es legal).
//  3. Determinismo absoluto: sin Math.random ni Date.now. El reparto depende
//     solo del contenido de los partidos y de un orden estable por id. Es
//     obligatorio: `mock-data` se importa desde componentes cliente y una hora
//     no determinista provocaría mismatch de hidratación server/cliente.
//
// PISTAS PARALELAS (política para pabellones saturados). Una franja de
// 09:00-20:30 da 8 slots de 90 min; hay pabellón-día con hasta 34 partidos en
// los calendarios reales, que no caben en una sola pista bajo ninguna política.
// No es un defecto del dato: el propio CSV trae 310 pabellón-día con horas
// reales solapadas y hasta 5 partidos simultáneos en el mismo pabellón, es
// decir, los pabellones grandes tienen varias pistas. Cuando la franja se
// agota se abre una pista paralela y se vuelve a empezar por el inicio de la
// franja. Así ninguna PISTA tiene dos partidos solapados, y las pistas abiertas
// se reportan en `SynthesisStats` en vez de esconderse.
//
// La pista NO se escribe en `MockMatch.courtId`: ese campo referencia entidades
// reales de `mockCourts` y un id inventado rompería `getMockCourt`. Además, que
// el solver siga viendo dos partidos simultáneos del mismo pabellón como
// solapados es correcto: una persona no puede arbitrar dos partidos a la vez
// aunque sean en pistas contiguas.

import { MATCH_DURATION_MIN, timeToMinutes } from '../overlap'
import { SCHEDULE_BY_BASES_CATEGORY, type BasesCategory, type ScheduleWindow } from './bases-fbm'

/** Datos mínimos de un partido para poder programarlo. */
export type SchedulableMatch = {
  id: string
  date: string
  venueId: string
  /** Hora del CSV en "HH:MM", o null si venía 00:00 y hay que sintetizarla. */
  realTime: string | null
  /** Fila de la Tabla B de la que sale la franja. null → franja por defecto. */
  basesCategory: BasesCategory | null
}

export type SynthesizedTime = {
  time: string
  timeIsEstimated: boolean
}

export type SynthesisStats = {
  /** Partidos con hora del CSV, preservada tal cual. */
  realTimes: number
  /** Partidos cuya hora se ha sintetizado. */
  synthesizedTimes: number
  /** Pabellón-día que no caben en una pista y abren pistas paralelas. */
  venueDaysWithParallelTracks: number
  /** Máximo de pistas paralelas abiertas en un mismo pabellón y día. */
  maxParallelTracks: number
  /** Partidos colocados en una pista distinta de la primera. */
  matchesOnParallelTracks: number
}

/**
 * Franja aplicada cuando la categoría no tiene fila en la Tabla B
 * (`liga_universitaria`) o no se pudo resolver. Es la franja general, la de 9
 * de las 11 filas de la tabla.
 */
const DEFAULT_WINDOW: ScheduleWindow = {
  basesLabel: '(sin fila en la Tabla B: franja general por defecto)',
  day: 'sabado_o_domingo',
  startTime: '09:00',
  endTime: '20:30',
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function windowOf(basesCategory: BasesCategory | null): ScheduleWindow {
  if (basesCategory === null) return DEFAULT_WINDOW
  return SCHEDULE_BY_BASES_CATEGORY[basesCategory] ?? DEFAULT_WINDOW
}

/**
 * Slots de inicio válidos de una franja: desde `startMin`, en pasos de
 * MATCH_DURATION_MIN, mientras el INICIO siga dentro de la franja. Minibasket
 * (09:00-18:30) da 7 slots; la franja general (09:00-20:30), 8.
 */
function gridSlots(startMin: number, endMin: number): number[] {
  const slots: number[] = []
  for (let t = startMin; t <= endMin; t += MATCH_DURATION_MIN) slots.push(t)
  return slots
}

/**
 * Hash FNV-1a de 32 bits. Es el "PRNG con semilla fija" del reparto: la semilla
 * es el propio (pabellón, fecha), así que el resultado no depende de nada
 * externo al dato y es reproducible byte a byte.
 */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Slot inicial del pabellón-día. Sin esto TODOS los pabellón-día arrancarían a
 * las 09:00 y el 38% de la temporada (8.142 partidos) empezaría a la vez, algo
 * que ni es realista ni deja medir cobertura: las horas REALES del CSV se
 * reparten por toda la franja (picos a las 11:00, 13:00 y 17:00, valle a las
 * 14:00). El desplazamiento se acota a `slotCount - groupSize` para que el
 * bloque de partidos siga siendo CONSECUTIVO (que es lo que exigen las Bases,
 * "de forma escalonada") y quepa entero dentro de la franja.
 */
function startOffset(groupKey: string, slotCount: number, groupSize: number): number {
  const room = slotCount - groupSize + 1
  if (room <= 1) return 0
  return fnv1a(groupKey) % room
}

/** Slots en orden de preferencia: desde `offset`, dando la vuelta al final. */
function rotate(slots: number[], offset: number): number[] {
  if (offset <= 0 || offset >= slots.length) return slots
  return [...slots.slice(offset), ...slots.slice(0, offset)]
}

type Interval = { start: number; end: number }

function fitsIn(track: Interval[], startMin: number): boolean {
  const end = startMin + MATCH_DURATION_MIN
  return track.every((iv) => end <= iv.start || startMin >= iv.end)
}

function compareIds(a: string, b: string): number {
  // Comparación de código de unidad, no `localeCompare`: el orden no puede
  // depender del locale del proceso o el reparto dejaría de ser reproducible.
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Asigna hora a cada partido. Devuelve un mapa id → hora (real o sintetizada) y
 * las métricas de saturación. No muta la entrada.
 */
export function synthesizeSchedules(matches: SchedulableMatch[]): {
  times: Map<string, SynthesizedTime>
  stats: SynthesisStats
} {
  const times = new Map<string, SynthesizedTime>()
  const stats: SynthesisStats = {
    realTimes: 0,
    synthesizedTimes: 0,
    venueDaysWithParallelTracks: 0,
    maxParallelTracks: 0,
    matchesOnParallelTracks: 0,
  }

  const groups = new Map<string, SchedulableMatch[]>()
  for (const m of matches) {
    const key = `${m.venueId}|${m.date}`
    const group = groups.get(key)
    if (group) group.push(m)
    else groups.set(key, [m])
  }

  for (const [groupKey, group] of groups) {
    const tracks: Interval[][] = []
    let matchesOnParallel = 0

    // 1) Las horas reales son inamovibles: se colocan primero y condicionan los
    //    slots que quedan libres. Dos partidos reales simultáneos en el mismo
    //    pabellón (los hay en el CSV) abren pista paralela igual que el resto.
    const real = group
      .filter((m) => m.realTime !== null)
      .sort((a, b) => {
        const diff = timeToMinutes(a.realTime as string) - timeToMinutes(b.realTime as string)
        return diff !== 0 ? diff : compareIds(a.id, b.id)
      })

    for (const m of real) {
      const startMin = timeToMinutes(m.realTime as string)
      let trackIndex = tracks.findIndex((t) => fitsIn(t, startMin))
      if (trackIndex === -1) {
        tracks.push([])
        trackIndex = tracks.length - 1
      }
      tracks[trackIndex].push({ start: startMin, end: startMin + MATCH_DURATION_MIN })
      if (trackIndex > 0) matchesOnParallel++
      times.set(m.id, { time: m.realTime as string, timeIsEstimated: false })
      stats.realTimes++
    }

    // 2) Sintéticas, la franja más estrecha primero (greedy de más restringido
    //    primero: maximiza lo que cabe y además da el reparto realista, con
    //    minibasket por la mañana porque su franja cierra a las 18:30).
    const synthetic = group
      .filter((m) => m.realTime === null)
      .map((m) => ({ match: m, window: windowOf(m.basesCategory) }))
      .sort((a, b) => {
        const endDiff = timeToMinutes(a.window.endTime) - timeToMinutes(b.window.endTime)
        if (endDiff !== 0) return endDiff
        const startDiff = timeToMinutes(a.window.startTime) - timeToMinutes(b.window.startTime)
        if (startDiff !== 0) return startDiff
        return compareIds(a.match.id, b.match.id)
      })

    // El desplazamiento se calcula sobre la franja MÁS ESTRECHA del grupo: es
    // la que decide cuánto margen hay antes de que el bloque se salga.
    const slotsByWindow = synthetic.map(({ window }) =>
      gridSlots(timeToMinutes(window.startTime), timeToMinutes(window.endTime)),
    )
    const narrowest = slotsByWindow.length > 0 ? Math.min(...slotsByWindow.map((s) => s.length)) : 0
    const offset = startOffset(groupKey, narrowest, group.length)

    for (const [i, { match }] of synthetic.entries()) {
      const slots = rotate(slotsByWindow[i], offset)

      let chosenSlot: number | null = null
      let trackIndex = -1
      for (let i = 0; i < tracks.length && chosenSlot === null; i++) {
        for (const slot of slots) {
          if (fitsIn(tracks[i], slot)) {
            chosenSlot = slot
            trackIndex = i
            break
          }
        }
      }

      // Franja llena en todas las pistas abiertas → se abre una más. Siempre
      // termina colocando: una pista vacía admite el primer slot de cualquier
      // franja.
      if (chosenSlot === null) {
        tracks.push([])
        trackIndex = tracks.length - 1
        chosenSlot = slots[0]
      }

      tracks[trackIndex].push({ start: chosenSlot, end: chosenSlot + MATCH_DURATION_MIN })
      if (trackIndex > 0) matchesOnParallel++
      times.set(match.id, { time: minutesToTime(chosenSlot), timeIsEstimated: true })
      stats.synthesizedTimes++
    }

    if (tracks.length > 1) stats.venueDaysWithParallelTracks++
    if (tracks.length > stats.maxParallelTracks) stats.maxParallelTracks = tracks.length
    stats.matchesOnParallelTracks += matchesOnParallel
  }

  return { times, stats }
}
