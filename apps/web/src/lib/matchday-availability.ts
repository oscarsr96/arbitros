// Materializacion de la disponibilidad de jornada (formulario simplificado) a los
// slots horarios concretos que consume mockAvailabilities / isPersonAvailable.
// Ver CLAUDE.md (decision 9): franjas fijas sabado/domingo (manana/tarde) + entre
// semana (franja alta 17:30-22:00).

import { formatLocalDate } from './mock-data'
import type { AvailabilitySlot, MatchdayAvailability } from './mock-data'

// ── Franjas horarias fijas (decision 9) ─────────────────────────────────────

export const MATCHDAY_MORNING = { startTime: '09:00', endTime: '15:30' } as const
export const MATCHDAY_AFTERNOON = { startTime: '15:30', endTime: '22:00' } as const
export const MATCHDAY_WEEKDAY_HIGH = { startTime: '17:30', endTime: '22:00' } as const

// ── Helpers de fecha (mismo criterio que mock-data.ts: lunes = inicio de semana) ──

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatLocalDate(d)
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const jsDay = d.getDay() // 0=domingo..6=sabado
  const diff = d.getDate() - jsDay + (jsDay === 0 ? -6 : 1)
  d.setDate(diff)
  return formatLocalDate(d)
}

// ── Ventana de jornada ───────────────────────────────────────────────────────
// Una jornada = viernes anterior al sabado + sabado + domingo + lunes..jueves
// siguientes. weekdayDays usa 0=lunes..4=viernes: el viernes cae ANTES del sabado
// (misma semana ISO que el fin de semana) y lunes..jueves caen DESPUES del domingo
// (semana ISO siguiente).

export interface MatchdayWindow {
  friday: string
  saturday: string
  sunday: string
  monday: string
  tuesday: string
  wednesday: string
  thursday: string
}

export function getMatchdayWindow(saturdayDate: string): MatchdayWindow {
  return {
    friday: addDays(saturdayDate, -1),
    saturday: saturdayDate,
    sunday: addDays(saturdayDate, 1),
    monday: addDays(saturdayDate, 2),
    tuesday: addDays(saturdayDate, 3),
    wednesday: addDays(saturdayDate, 4),
    thursday: addDays(saturdayDate, 5),
  }
}

function weekdayDateInWindow(window: MatchdayWindow, weekday: number): string {
  switch (weekday) {
    case 0:
      return window.monday
    case 1:
      return window.tuesday
    case 2:
      return window.wednesday
    case 3:
      return window.thursday
    case 4:
      return window.friday
    default:
      throw new Error(`weekdayDays invalido: ${weekday} (esperado 0-4)`)
  }
}

/**
 * weekStarts (lunes) afectados por una jornada, independientemente de que franjas
 * esten marcadas: el fin de semana (viernes anterior + sabado + domingo) cae en una
 * unica semana ISO, y el bloque lunes..jueves siguiente cae en la semana ISO
 * siguiente. Se usa para limpiar mockAvailabilities antes de re-materializar, incluso
 * cuando el usuario desmarca todos los dias de un bloque.
 */
export function getAffectedWeekStarts(saturdayDate: string): [string, string] {
  const weekendWeekStart = mondayOf(saturdayDate)
  const weekdayWeekStart = addDays(saturdayDate, 2) // lunes siguiente al domingo, ya es weekStart
  return [weekendWeekStart, weekdayWeekStart]
}

// ── Materializacion ──────────────────────────────────────────────────────────

/**
 * Convierte un registro de disponibilidad de jornada (formulario simplificado) en los
 * slots horarios concretos que consume mockAvailabilities / isPersonAvailable.
 *
 * Decision (1 slot vs 2 slots por dia con manana+tarde): cuando manana Y tarde estan
 * marcadas se emiten DOS slots contiguos (09:00-15:30 + 15:30-22:00) en lugar de
 * fusionarlos en un unico slot 09:00-22:00. isPersonAvailable compara con intervalos
 * semiabiertos [start,end), asi que el resultado de cobertura es identico en ambos
 * casos; dos slots evita tener que detectar el caso "ambas marcadas" para fusionar
 * rangos y reutiliza siempre las mismas franjas fijas sin recalcular limites.
 */
export function materializeToSlots(record: MatchdayAvailability): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []

  const saturdayWeekStart = mondayOf(record.saturdayDate)
  if (record.saturdayMorning) {
    slots.push({
      personId: record.personId,
      weekStart: saturdayWeekStart,
      dayOfWeek: 5,
      ...MATCHDAY_MORNING,
    })
  }
  if (record.saturdayAfternoon) {
    slots.push({
      personId: record.personId,
      weekStart: saturdayWeekStart,
      dayOfWeek: 5,
      ...MATCHDAY_AFTERNOON,
    })
  }

  const sundayDate = addDays(record.saturdayDate, 1)
  const sundayWeekStart = mondayOf(sundayDate)
  if (record.sundayMorning) {
    slots.push({
      personId: record.personId,
      weekStart: sundayWeekStart,
      dayOfWeek: 6,
      ...MATCHDAY_MORNING,
    })
  }
  if (record.sundayAfternoon) {
    slots.push({
      personId: record.personId,
      weekStart: sundayWeekStart,
      dayOfWeek: 6,
      ...MATCHDAY_AFTERNOON,
    })
  }

  const window = getMatchdayWindow(record.saturdayDate)
  for (const weekday of record.weekdayDays) {
    const date = weekdayDateInWindow(window, weekday)
    slots.push({
      personId: record.personId,
      weekStart: mondayOf(date),
      dayOfWeek: weekday,
      ...MATCHDAY_WEEKDAY_HIGH,
    })
  }

  return slots
}
