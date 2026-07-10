import * as XLSX from 'xlsx'
import type { ParsedCamposVenue, ParsedXlsxMatch, XlsxImportResult } from './types'

// ── Parser del workbook de jornada (JDM) ─────────────────────────────────────
//
// Estructura real del fichero (calibrada con una jornada real):
//
// - SABADO / DOMINGO / ENTRE SEMANA: cada hoja contiene una o dos "bandas" de
//   mini-tablas en paralelo (banda izquierda en las columnas 0-7, banda derecha
//   en las 9-16). Cada bloque tiene una etiqueta de pabellón/pista en la
//   columna LOCAL de su banda (p. ej. "BARAJAS - 1"), seguida de una fila
//   cabecera `H | CAT | GR. | DISTRITO | LOCAL | VISITANTE | ARBITRO | ANOT.`
//   y de las filas de partido. Los títulos de distrito ("BARAJAS", "CENTRO")
//   viven en la columna-hueco entre bandas y se ignoran.
// - ENTRE SEMANA además intercala cabeceras de día ("Martes 3 Marzo") como
//   única celda de su fila; cada una fija la fecha de los bloques siguientes.
// - Hojas satélite (MOSTOLES / TORREJON / ARANJUEZ): misma mecánica de bandas
//   pero con cabeceras `ARBITRO 1 | ARBITRO 2 | ANOTADOR` (→ 2 árbitros) o
//   `ARBITRO | ANOT.` (→ 1 árbitro), etiquetas de pista tipo `ZONA "A"` /
//   `PISTA 1`, y el nombre del pabellón a veces centrado en la columna-hueco
//   entre las dos bandas (caso ARANJUEZ), de ahí el rango de etiquetas ±1.
//   También intercalan cabeceras de día ("Sábado 7 Marzo" / "Domingo 8 Marzo");
//   por defecto se asume el sábado de la jornada.
// - CAMPOS: tabla plana DISTRITO | NOMBRE | DIRECCIÓN | METRO | AUTOBUS | ...
// - SANCIONADOS: se ignora (la app no importa sanciones).
//
// Las columnas ARBITRO/ANOT. se leen y se IGNORAN a propósito: la app genera
// sus propias designaciones, no reimporta las ya publicadas.
//
// Robustez: el parser NUNCA lanza excepción; toda anomalía se acumula en
// `warnings` y la fila u hoja afectada se omite.

const SATELLITE_SHEETS = ['MOSTOLES', 'TORREJON', 'ARANJUEZ']

// Desplazamiento de cada día respecto al sábado de la jornada, dentro de la
// ventana [viernes anterior, jueves posterior]. Solo se usa como fallback
// cuando la cabecera de día no incluye fecha explícita ("Miercoles" a secas).
const WEEKDAY_OFFSETS: Record<string, number> = {
  VIERNES: -1,
  SABADO: 0,
  DOMINGO: 1,
  LUNES: 2,
  MARTES: 3,
  MIERCOLES: 4,
  JUEVES: 5,
}

// Día de la semana de Date.getDay() para cada nombre en español
const WEEKDAY_JS: Record<string, number> = {
  DOMINGO: 0,
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
}

const MONTHS: Record<string, number> = {
  ENERO: 0,
  FEBRERO: 1,
  MARZO: 2,
  ABRIL: 3,
  MAYO: 4,
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
  SETIEMBRE: 8,
  OCTUBRE: 9,
  NOVIEMBRE: 10,
  DICIEMBRE: 11,
}

// "Martes 3 Marzo", "Martes 3 de Marzo", "Miercoles" (con o sin tilde)
const DAY_HEADER_RE =
  /^(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)(?:\s+(\d{1,2}))?(?:\s+DE)?(?:\s+([A-Z]+))?$/

// Sufijo de pista en cabeceras de pabellón: "BARAJAS - 1", "SAMARANCH-2"
const COURT_SUFFIX_RE = /^(.*\S)\s*[-–]\s*(\d{1,2})$/

// Etiquetas de pista en hojas satélite: ZONA "A", PISTA 1, PISTA CENTRAL
const SATELLITE_COURT_RE = /^(ZONA|PISTA)\b/

// ── Utilidades de celda y fecha ──────────────────────────────────────────────

function cellText(value: unknown): string {
  if (value === null || value === undefined || value instanceof Date) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

// Mayúsculas y sin tildes, para comparar de forma tolerante
function normalize(value: unknown): string {
  return cellText(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  // T00:00:00 fuerza hora local y evita el desfase de zona horaria
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Acepta horas como texto ("9:00", "18.30"), número Excel (fracción de día)
// o Date (workbooks leídos con cellDates). Devuelve "HH:MM" o null.
function parseTimeCell(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const fraction = value % 1
    if (fraction <= 0) return null // enteros no son horas
    const totalMinutes = Math.round(fraction * 24 * 60)
    return `${pad2(Math.floor(totalMinutes / 60) % 24)}:${pad2(totalMinutes % 60)}`
  }
  const match = cellText(value).match(/^(\d{1,2})[:.hH](\d{2})$/)
  if (!match) return null
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  if (hours > 23 || minutes > 59) return null
  return `${pad2(hours)}:${pad2(minutes)}`
}

interface DayHeader {
  date: string
  weekdayMismatch: boolean
}

// Interpreta una celda como cabecera de día. Con fecha explícita
// ("Martes 3 Marzo") esta gana siempre: en el fichero real los partidos de
// ENTRE SEMANA pueden ser anteriores al fin de semana de la jornada. Sin
// fecha explícita se usa la ventana [viernes anterior, jueves posterior].
function resolveDayHeader(normText: string, saturday: Date): DayHeader | null {
  const match = normText.match(DAY_HEADER_RE)
  if (!match) return null
  const weekday = match[1]
  const dayNum = match[2] ? parseInt(match[2], 10) : null
  const monthName = match[3] ?? null

  if (monthName !== null) {
    const month = MONTHS[monthName]
    // Texto con una palabra extra que no es mes ("DOMINGO SAVIO"): no es día
    if (month === undefined || dayNum === null) return null
    // Año: el candidato más cercano al sábado de la jornada (cubre el cambio de año)
    let best: Date | null = null
    for (const year of [
      saturday.getFullYear() - 1,
      saturday.getFullYear(),
      saturday.getFullYear() + 1,
    ]) {
      const candidate: Date = new Date(year, month, dayNum)
      if (candidate.getMonth() !== month || candidate.getDate() !== dayNum) continue
      if (
        !best ||
        Math.abs(candidate.getTime() - saturday.getTime()) <
          Math.abs(best.getTime() - saturday.getTime())
      ) {
        best = candidate
      }
    }
    if (!best) return null
    return { date: formatIsoDate(best), weekdayMismatch: best.getDay() !== WEEKDAY_JS[weekday] }
  }

  // Solo nombre de día (se ignora un posible número suelto sin mes)
  return {
    date: formatIsoDate(addDays(saturday, WEEKDAY_OFFSETS[weekday])),
    weekdayMismatch: false,
  }
}

// ── Detección de cabeceras de mini-tabla ─────────────────────────────────────

interface BandColumns {
  h: number
  cat: number | null
  group: number | null
  district: number | null
  local: number
  visitante: number
  refereeCols: number // 1 (ARBITRO) o 2 (ARBITRO 1 | ARBITRO 2)
  end: number // última columna mapeada de la banda
}

// Intenta interpretar una cabecera de mini-tabla que empieza con "H" en hCol
function tryParseHeader(row: unknown[], hCol: number): BandColumns | null {
  let cat: number | null = null
  let group: number | null = null
  let district: number | null = null
  let local: number | null = null
  let visitante: number | null = null
  let refereeCols = 0
  let end = hCol

  for (let c = hCol + 1; c < row.length && c <= hCol + 12; c++) {
    const token = normalize(row[c]).replace(/\.$/, '')
    if (!token) continue
    if (token === 'H') break // empieza la siguiente banda
    let mapped = true
    if (token === 'CAT') cat = c
    else if (token === 'GR') group = c
    else if (token === 'DISTRITO') district = c
    else if (token === 'LOCAL') local = c
    else if (token === 'VISITANTE') visitante = c
    else if (token === 'ARBITRO' || token === 'ARBITRO 1') refereeCols = Math.max(refereeCols, 1)
    else if (token === 'ARBITRO 2') refereeCols = 2
    else if (token === 'ANOT' || token === 'ANOTADOR') void 0
    else mapped = false
    if (mapped) end = c
  }

  if (local === null || visitante === null) return null
  // Layout estándar H|CAT|GR.|DISTRITO|LOCAL con la celda DISTRITO vacía:
  // se infiere la columna (ocurre en algún bloque del fichero real)
  if (district === null && local === hCol + 4) district = hCol + 3
  if (refereeCols === 0) refereeCols = 1
  return { h: hCol, cat, group, district, local, visitante, refereeCols, end }
}

// ── Hojas de partidos ────────────────────────────────────────────────────────

interface MatchSheetOptions {
  mode: 'standard' | 'satellite'
  initialDate: string | null // null → sin fecha hasta la primera cabecera de día
  trackDays: boolean // ENTRE SEMANA y satélites siguen cabeceras de día
  saturday: Date
  defaultDistrict: string // '' en estándar; nombre de hoja en satélites
}

function parseMatchSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
  opts: MatchSheetOptions,
  matches: ParsedXlsxMatch[],
  warnings: string[],
): void {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][]

  // Paso 1: localizar todas las cabeceras de mini-tabla y deducir las bandas
  const headers = new Map<string, BandColumns>() // clave "fila:columna"
  const bandEnds = new Map<number, number>() // inicio de banda → fin máximo
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (normalize(row[c]) !== 'H') continue
      const header = tryParseHeader(row, c)
      if (!header) continue
      headers.set(`${r}:${c}`, header)
      bandEnds.set(c, Math.max(bandEnds.get(c) ?? header.end, header.end))
    }
  })
  if (bandEnds.size === 0) {
    warnings.push(`hoja ${sheetName}: no se encontró ninguna cabecera de mini-tabla; hoja omitida`)
    return
  }

  // Paso 2: cabeceras de día (globales a la hoja). Solo cuentan las celdas que
  // son el único contenido de su fila, para no confundir nombres de equipo.
  const dayEvents: { row: number; date: string }[] = []
  if (opts.trackDays) {
    rows.forEach((row, r) => {
      const nonEmpty = row.map((v, c) => ({ v, c })).filter(({ v }) => cellText(v) !== '')
      if (nonEmpty.length !== 1) return
      const day = resolveDayHeader(normalize(nonEmpty[0].v), opts.saturday)
      if (!day) return
      if (day.weekdayMismatch) {
        warnings.push(
          `hoja ${sheetName}, fila ${r + 1}: la fecha "${cellText(nonEmpty[0].v)}" no coincide con el día de la semana indicado; se usa la fecha explícita`,
        )
      }
      dayEvents.push({ row: r, date: day.date })
    })
  }

  // Paso 3: recorrer cada banda de forma independiente
  for (const [start, end] of bandEnds) {
    // En satélites la etiqueta de pabellón puede vivir en la columna-hueco
    // adyacente a la banda (caso ARANJUEZ), de ahí el ±1
    const labelStart = opts.mode === 'satellite' ? start - 1 : start
    const labelEnd = opts.mode === 'satellite' ? end + 1 : end
    let venue: string | null = null
    let court: string | null = null
    let colmap: BandColumns | null = null
    let currentDate = opts.initialDate
    let eventPtr = 0

    for (let r = 0; r < rows.length; r++) {
      while (eventPtr < dayEvents.length && dayEvents[eventPtr].row <= r) {
        currentDate = dayEvents[eventPtr].date
        eventPtr++
      }
      const row = rows[r] ?? []

      const header = headers.get(`${r}:${start}`)
      if (header) {
        colmap = header
        continue
      }

      // ¿Fila de partido? (hora válida + ambos equipos)
      if (colmap) {
        const time = parseTimeCell(row[colmap.h])
        if (time) {
          const homeTeam = cellText(row[colmap.local])
          const awayTeam = cellText(row[colmap.visitante])
          if (!homeTeam || !awayTeam) {
            warnings.push(
              `hoja ${sheetName}, fila ${r + 1}: partido con hora ${time} sin equipos completos; fila omitida`,
            )
            continue
          }
          if (!currentDate) {
            warnings.push(
              `hoja ${sheetName}, fila ${r + 1}: partido sin cabecera de día previa; fila omitida`,
            )
            continue
          }
          if (!venue) {
            warnings.push(
              `hoja ${sheetName}, fila ${r + 1}: partido sin pabellón identificado; fila omitida`,
            )
            continue
          }
          matches.push({
            date: currentDate,
            time,
            venueName: venue,
            courtName: court,
            district:
              (colmap.district !== null ? cellText(row[colmap.district]) : '') ||
              opts.defaultDistrict,
            category: colmap.cat !== null ? cellText(row[colmap.cat]) : '',
            group: colmap.group !== null ? cellText(row[colmap.group]) : '',
            homeTeam,
            awayTeam,
            refereesNeeded: colmap.refereeCols,
            sheet: sheetName,
          })
          continue
        }
      }

      // Fila de etiqueta: pabellón/pista, o basura si hay varias celdas
      const labels: { col: number; text: string }[] = []
      for (let c = Math.max(0, labelStart); c <= labelEnd && c < row.length; c++) {
        const text = cellText(row[c])
        if (!text) continue
        if (resolveDayHeader(normalize(text), opts.saturday)) continue // títulos de día
        labels.push({ col: c, text })
      }
      if (labels.length === 0) continue
      if (labels.length > 1) {
        warnings.push(
          `hoja ${sheetName}, fila ${r + 1}: fila con datos no reconocidos; fila omitida`,
        )
        continue
      }
      const label = labels[0]
      if (opts.mode === 'standard') {
        // La etiqueta de pabellón vive exactamente en la columna LOCAL (start+4)
        if (label.col !== start + 4) {
          warnings.push(
            `hoja ${sheetName}, fila ${r + 1}: texto inesperado "${label.text}" fuera de la columna de pabellón; ignorado`,
          )
          continue
        }
        const suffix = label.text.match(COURT_SUFFIX_RE)
        if (suffix) {
          venue = suffix[1]
          court = suffix[2] // "BARAJAS - 1" → pista "1"
        } else {
          venue = label.text
          court = null // pista implícita
        }
      } else if (SATELLITE_COURT_RE.test(normalize(label.text))) {
        court = label.text // ZONA "A", PISTA 1, PISTA CENTRAL...
      } else {
        venue = label.text
        court = null
      }
    }
  }
}

// ── Hoja CAMPOS ──────────────────────────────────────────────────────────────

function parseCamposSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
  camposVenues: ParsedCamposVenue[],
  warnings: string[],
): void {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][]

  let headerRow = -1
  let district = -1
  let name = -1
  let address = -1
  let metro = -1
  let bus = -1
  let observations = -1
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const token = normalize(row[c])
      if (token === 'DISTRITO') district = c
      else if (token.startsWith('NOMBRE')) name = c
      else if (token.startsWith('DIRECC')) address = c
      else if (token.startsWith('METRO')) metro = c
      else if (token.includes('BUS')) bus = c
      // startsWith cubre el typo "OBSERVAVIONES" del fichero real
      else if (token.startsWith('OBSERVA')) observations = c
    }
    if (district >= 0 && name >= 0) {
      headerRow = r
      break
    }
    district = name = address = metro = bus = observations = -1
  }
  if (headerRow < 0) {
    warnings.push(`hoja ${sheetName}: no se encontró la cabecera DISTRITO | NOMBRE; hoja omitida`)
    return
  }

  const field = (row: unknown[], col: number) => (col >= 0 ? cellText(row[col]) : '')
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const venueName = field(row, name)
    if (!venueName) continue
    camposVenues.push({
      district: field(row, district),
      name: venueName,
      address: field(row, address),
      metro: field(row, metro),
      bus: field(row, bus),
      observations: field(row, observations),
    })
  }
}

// ── Entrada principal ────────────────────────────────────────────────────────

export function parseJornadaWorkbook(
  workbook: XLSX.WorkBook,
  saturdayDate: string,
): XlsxImportResult {
  const result: XlsxImportResult = { matches: [], camposVenues: [], warnings: [] }
  try {
    const saturday = parseIsoDate(saturdayDate)
    if (!saturday) {
      result.warnings.push(
        `fecha de sábado inválida: "${saturdayDate}" (se esperaba YYYY-MM-DD); no se importó nada`,
      )
      return result
    }
    if (saturday.getDay() !== 6) {
      result.warnings.push(
        `la fecha ${saturdayDate} no es sábado; se usa igualmente como base de la jornada`,
      )
    }
    const sundayDate = formatIsoDate(addDays(saturday, 1))

    for (const sheetName of workbook.SheetNames ?? []) {
      const ws = workbook.Sheets?.[sheetName]
      if (!ws) continue
      const key = normalize(sheetName)
      try {
        if (key === 'SABADO') {
          parseMatchSheet(
            ws,
            sheetName,
            {
              mode: 'standard',
              initialDate: saturdayDate,
              trackDays: false,
              saturday,
              defaultDistrict: '',
            },
            result.matches,
            result.warnings,
          )
        } else if (key === 'DOMINGO') {
          parseMatchSheet(
            ws,
            sheetName,
            {
              mode: 'standard',
              initialDate: sundayDate,
              trackDays: false,
              saturday,
              defaultDistrict: '',
            },
            result.matches,
            result.warnings,
          )
        } else if (key === 'ENTRE SEMANA') {
          parseMatchSheet(
            ws,
            sheetName,
            { mode: 'standard', initialDate: null, trackDays: true, saturday, defaultDistrict: '' },
            result.matches,
            result.warnings,
          )
        } else if (SATELLITE_SHEETS.includes(key)) {
          // Suposición: los satélites son de fin de semana; sus cabeceras de
          // día ("Sábado 7 Marzo" / "Domingo 8 Marzo") ajustan la fecha, y sin
          // cabecera se asume el sábado de la jornada. Al no tener columna
          // DISTRITO, se usa el nombre de la hoja (municipio) como distrito.
          parseMatchSheet(
            ws,
            sheetName,
            {
              mode: 'satellite',
              initialDate: saturdayDate,
              trackDays: true,
              saturday,
              defaultDistrict: sheetName,
            },
            result.matches,
            result.warnings,
          )
        } else if (key === 'CAMPOS') {
          parseCamposSheet(ws, sheetName, result.camposVenues, result.warnings)
        } else if (key === 'SANCIONADOS') {
          result.warnings.push('hoja SANCIONADOS ignorada (las sanciones no se importan)')
        } else {
          result.warnings.push(`hoja "${sheetName}" no reconocida; ignorada`)
        }
      } catch (err) {
        result.warnings.push(
          `hoja "${sheetName}": error inesperado (${err instanceof Error ? err.message : String(err)}); hoja omitida`,
        )
      }
    }
  } catch (err) {
    result.warnings.push(
      `error inesperado al procesar el libro: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  return result
}
