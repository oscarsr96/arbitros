// Config de antelacion para declarar disponibilidad, por categoria de arbitro/anotador.
// Sustituye al env var global AVAILABILITY_DAYS_ADVANCE (ver CLAUDE.md, Variables de Entorno).

export type RefereeCategory = 'provincial' | 'autonomico' | 'nacional' | 'feb'

export const AVAILABILITY_DEADLINE_DAYS: Record<RefereeCategory, number> = {
  provincial: 7,
  autonomico: 8,
  nacional: 10,
  feb: 12,
}

function isRefereeCategory(category: string): category is RefereeCategory {
  return category in AVAILABILITY_DEADLINE_DAYS
}

function getDeadlineDays(category: string | null | undefined): number {
  if (category && isRefereeCategory(category)) {
    return AVAILABILITY_DEADLINE_DAYS[category]
  }
  // Categoria null o desconocida → default mas restrictivo (feb, 12 dias)
  return AVAILABILITY_DEADLINE_DAYS.feb
}

/**
 * Fecha limite para declarar disponibilidad de una jornada.
 * saturdayDate: fecha ISO (YYYY-MM-DD) del sabado de la jornada.
 * Devuelve el fin del dia (23:59:59.999) de sabado - N dias, segun categoria.
 */
export function getAvailabilityDeadline(
  category: string | null | undefined,
  saturdayDate: string,
): Date {
  const days = getDeadlineDays(category)
  const deadline = new Date(saturdayDate + 'T00:00:00')
  deadline.setDate(deadline.getDate() - days)
  deadline.setHours(23, 59, 59, 999)
  return deadline
}
