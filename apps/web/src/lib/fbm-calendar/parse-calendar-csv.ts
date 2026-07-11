import Papa from 'papaparse'

// ── Parser del CSV de partidos exportado por el backend de competición FBM ──
//
// Formato real: delimitador `;`, cabecera en la primera fila, `;` final que
// deja una columna vacía. El fichero llega en cp1252/latin1; esta función es
// PURA y recibe el texto ya decodificado a UTF-8 (el decodificado lo hace la
// ruta que consume este parser, no este fichero).
//
// Gotcha de comillas: algunos campos (p. ej. "C.B. VILLA DE VALDEMORO  "D"")
// contienen comillas dobles literales en medio del texto; el CSV no
// entrecomilla campos. Con el quoteChar por defecto ('"'), papaparse trata
// cualquier campo que EMPIECE por comilla como el inicio de un campo
// entrecomillado y, al no encontrar cierre, se traga el resto de la fila
// (delimitadores incluidos). Se fija `quoteChar` a un carácter que nunca
// aparece en el CSV (`\0`) para desactivar por completo la interpretación de
// comillas y que se conserven tal cual.
//
// Robustez: nunca lanza excepción. Cabecera ausente/irreconocible, filas con
// columnas faltantes o IDENTIFICADOR vacío se acumulan en `warnings` y se
// omiten.

export type ParsedCsvMatch = {
  sourceId: string
  category: string
  fase: string
  grupo: string
  matchday: number | null
  homeClub: string
  homeTeam: string
  awayClub: string
  awayTeam: string
  date: string | null
  time: string | null
  venueName: string
  venueAddress: string
  poblacion: string
}

// Rango de temporada válido: fuera de esto es basura del backend (p. ej. la
// fecha centinela "08/08/1928" que marca un partido no disputado).
const MIN_SEASON_YEAR = 2024
const MAX_SEASON_YEAR = 2027

const REQUIRED_COLUMNS = [
  'CATEGORÍA',
  'FASE',
  'GRUPO',
  'JORNADA',
  'CLUB L.',
  'EQ. LOCAL',
  'CLUB V.',
  'EQ. VISITANTE',
  'FECHA',
  'HORA',
  'CAMPO',
  'DIRECCIÓN',
  'POBLACIÓN',
  'IDENTIFICADOR',
]

function cell(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// "dd/mm/aaaa" → "aaaa-mm-dd", validando rango de temporada y que la fecha
// exista de verdad (round-trip con Date rechaza 31/02, 99/99, etc.).
function parseDate(raw: string): string | null {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  const y = parseInt(year, 10)
  const mo = parseInt(month, 10)
  const d = parseInt(day, 10)
  if (y < MIN_SEASON_YEAR || y > MAX_SEASON_YEAR) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${year}-${month}-${day}`
}

// "HH:MM"; "00:00" (hora por confirmar) se trata como ausente
function parseTime(raw: string): string | null {
  if (raw === '00:00') return null
  const match = raw.match(/^(\d{2}):(\d{2})$/)
  return match ? raw : null
}

export function parseCalendarCsv(csvText: string): {
  matches: ParsedCsvMatch[]
  warnings: string[]
} {
  const matches: ParsedCsvMatch[] = []
  const warnings: string[] = []

  try {
    const result = Papa.parse<Record<string, unknown>>(csvText, {
      delimiter: ';',
      header: true,
      skipEmptyLines: true,
      quoteChar: '\0',
    })

    const fields = result.meta.fields ?? []
    const missing = REQUIRED_COLUMNS.filter((column) => !fields.includes(column))
    if (missing.length > 0) {
      warnings.push(`cabecera no reconocida: faltan columnas ${missing.join(', ')}`)
      return { matches, warnings }
    }

    result.data.forEach((row, i) => {
      const rowNum = i + 2 // +1 por índice 0-based, +1 por la fila de cabecera
      try {
        const sourceId = cell(row['IDENTIFICADOR'])
        if (!sourceId) {
          warnings.push(`fila ${rowNum}: sin IDENTIFICADOR; fila omitida`)
          return
        }

        const matchdayNum = parseInt(cell(row['JORNADA']), 10)
        const matchday = Number.isNaN(matchdayNum) ? null : matchdayNum

        const dateRaw = cell(row['FECHA'])
        const date = parseDate(dateRaw)
        if (date === null) {
          warnings.push(
            `fila ${rowNum} (${sourceId}): fecha inválida o fuera de temporada "${dateRaw}"`,
          )
        }

        const timeRaw = cell(row['HORA'])
        const time = parseTime(timeRaw)
        if (time === null) {
          warnings.push(`fila ${rowNum} (${sourceId}): hora inválida o por confirmar "${timeRaw}"`)
        }

        matches.push({
          sourceId,
          category: cell(row['CATEGORÍA']),
          fase: cell(row['FASE']),
          grupo: cell(row['GRUPO']),
          matchday,
          homeClub: cell(row['CLUB L.']),
          homeTeam: cell(row['EQ. LOCAL']),
          awayClub: cell(row['CLUB V.']),
          awayTeam: cell(row['EQ. VISITANTE']),
          date,
          time,
          venueName: cell(row['CAMPO']),
          venueAddress: cell(row['DIRECCIÓN']),
          poblacion: cell(row['POBLACIÓN']),
        })
      } catch (err) {
        warnings.push(
          `fila ${rowNum}: error inesperado (${err instanceof Error ? err.message : String(err)}); fila omitida`,
        )
      }
    })
  } catch (err) {
    warnings.push(
      `error inesperado al procesar el CSV: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  return { matches, warnings }
}
