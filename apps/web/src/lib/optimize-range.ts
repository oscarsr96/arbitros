// Helpers puros de acotado por rango de fechas para la asignación automática.
// Viven aquí (y no en api/optimize/route.ts) porque los ficheros `route.ts` de Next
// solo pueden exportar los handlers HTTP y su config; cualquier otro export rompe el
// tipo generado en `.next/types`. Se importan desde la ruta y se testean sin servidor.

const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/

// Valida el formato YYYY-MM-DD de dateFrom/dateTo y que dateFrom <= dateTo.
// Devuelve el mensaje de error, o null si el rango (o su ausencia) es válido.
export function validateDateRange(dateFrom?: string, dateTo?: string): string | null {
  if (dateFrom !== undefined && !DATE_FORMAT_RE.test(dateFrom)) {
    return `Formato de fecha inválido en dateFrom: "${dateFrom}" (se espera YYYY-MM-DD)`
  }
  if (dateTo !== undefined && !DATE_FORMAT_RE.test(dateTo)) {
    return `Formato de fecha inválido en dateTo: "${dateTo}" (se espera YYYY-MM-DD)`
  }
  if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
    return `dateFrom (${dateFrom}) debe ser anterior o igual a dateTo (${dateTo})`
  }
  return null
}

// Filtra una lista de partidos (con campo date YYYY-MM-DD) al rango [dateFrom, dateTo].
// Límites ausentes no acotan por ese lado; sin dateFrom ni dateTo, devuelve la lista completa.
export function filterMatchesByRange<T extends { date: string }>(
  matches: T[],
  dateFrom?: string,
  dateTo?: string,
): T[] {
  if (!dateFrom && !dateTo) return matches
  return matches.filter((m) => {
    if (dateFrom && m.date < dateFrom) return false
    if (dateTo && m.date > dateTo) return false
    return true
  })
}
