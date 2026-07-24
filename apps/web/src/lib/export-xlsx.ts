import * as XLSX from 'xlsx'

interface LiquidationPerson {
  name: string
  role: string
  municipality: string
  bankIban: string
  matches: {
    matchId: string
    date: string
    time: string
    homeTeam: string
    awayTeam: string
    venue: string
    travelCost: number
    distanceKm: number
  }[]
  totalCost: number
}

interface CostByMatchday {
  matchday: number
  cost: number
  matches: number
}

// "Jornada 15" | "Mes 2025-10" | "Temporada completa" → slug de fichero.
const scopeSlug = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

// `scopeLabel` es la etiqueta legible del ámbito exportado (fix "Jornada 0":
// en ámbito mes/temporada no hay matchday, así que el fichero se nombra por
// la etiqueta real del ámbito, no por un número de jornada).
export function exportLiquidationXlsx(
  liquidation: LiquidationPerson[],
  costByMatchday: CostByMatchday[],
  scopeLabel: string,
) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Resumen por jornada
  const resumenData = costByMatchday.map((row) => ({
    Jornada: row.matchday,
    Partidos: row.matches,
    'Coste Total (€)': row.cost,
  }))
  const wsResumen = XLSX.utils.json_to_sheet(resumenData)
  wsResumen['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Sheet 2: Liquidacion por persona
  const liqData = liquidation.map((p) => ({
    Persona: p.name,
    Rol: p.role === 'arbitro' ? 'Árbitro' : 'Anotador',
    Municipio: p.municipality,
    IBAN: p.bankIban,
    Partidos: p.matches.length,
    'Coste Total (€)': p.totalCost,
  }))
  const wsLiq = XLSX.utils.json_to_sheet(liqData)
  wsLiq['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsLiq, 'Liquidación')

  // Sheet 3: Detalle (una fila por designacion)
  const detailRows: {
    Persona: string
    Rol: string
    Partido: string
    Fecha: string
    Hora: string
    Pabellón: string
    'Coste (€)': number
    'Distancia (km)': number
  }[] = []
  for (const p of liquidation) {
    for (const m of p.matches) {
      detailRows.push({
        Persona: p.name,
        Rol: p.role === 'arbitro' ? 'Árbitro' : 'Anotador',
        Partido: `${m.homeTeam} vs ${m.awayTeam}`,
        Fecha: m.date,
        Hora: m.time,
        Pabellón: m.venue,
        'Coste (€)': m.travelCost,
        'Distancia (km)': m.distanceKm,
      })
    }
  }
  const wsDetail = XLSX.utils.json_to_sheet(detailRows)
  wsDetail['!cols'] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 35 },
    { wch: 12 },
    { wch: 8 },
    { wch: 35 },
    { wch: 10 },
    { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle')

  XLSX.writeFile(wb, `liquidacion-${scopeSlug(scopeLabel)}.xlsx`)
}

// ── Monthly Liquidation Export ───────────────────────────────────────────
// Contrato del backend (/api/admin/reports?month=YYYY-MM): el detalle son
// DÍAS (no partidos estimados), ya agrupados por (persona, fecha) sin
// doble-conteo. No se recalcula coste aquí: se consume travelCost/fees/total
// tal cual llega.

interface MonthlyLiquidationDay {
  date: string
  matches: {
    matchId: string
    date: string
    time: string
    homeTeam: string
    awayTeam: string
    venue: string
    municipality: string
  }[]
  municipalities: string[]
  km: number
  travelCost: number
}

interface MonthlyLiquidationPerson {
  personId: string
  name: string
  role: string
  municipality: string
  bankIban: string
  days: MonthlyLiquidationDay[]
  travelCost: number
  fees: number
  total: number
  unresolvedFees: number
}

export interface MonthlyLiquidation {
  month: string
  people: MonthlyLiquidationPerson[]
  totalTravelCost: number
  totalFees: number
  total: number
}

type MonthlyResumenRow = Record<string, string | number>
type MonthlyDetailRow = Record<string, string | number>

function roleLabel(role: string) {
  return role === 'arbitro' ? 'Árbitro' : 'Anotador'
}

// Función pura de armado de filas (testeable sin XLSX/writeFile).
export function buildMonthlyRows(data: MonthlyLiquidation): {
  resumenRows: MonthlyResumenRow[]
  detailRows: MonthlyDetailRow[]
  fileName: string
} {
  const resumenRows: MonthlyResumenRow[] = data.people.map((p) => ({
    Persona: p.name,
    Rol: roleLabel(p.role),
    Municipio: p.municipality,
    IBAN: p.bankIban,
    'Desplazamiento (€)': p.travelCost,
    'Honorarios (€)': p.fees,
    'Total (€)': p.total,
    'Tarifas pendientes': p.unresolvedFees,
  }))
  resumenRows.push({
    Persona: 'TOTAL',
    Rol: '',
    Municipio: '',
    IBAN: '',
    'Desplazamiento (€)': data.totalTravelCost,
    'Honorarios (€)': data.totalFees,
    'Total (€)': data.total,
    'Tarifas pendientes': data.people.reduce((sum, p) => sum + p.unresolvedFees, 0),
  })

  const detailRows: MonthlyDetailRow[] = []
  for (const p of data.people) {
    for (const day of p.days) {
      detailRows.push({
        Persona: p.name,
        Rol: roleLabel(p.role),
        Fecha: day.date,
        Partidos: day.matches.length,
        Municipios: day.municipalities.join(', '),
        Km: day.km,
        'Desplazamiento (€)': day.travelCost,
      })
    }
  }

  return { resumenRows, detailRows, fileName: `liquidacion-mensual-${data.month}.xlsx` }
}

export function exportMonthlyLiquidationXlsx(data: MonthlyLiquidation) {
  const { resumenRows, detailRows, fileName } = buildMonthlyRows(data)
  const wb = XLSX.utils.book_new()

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows)
  wsResumen['!cols'] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  const wsDetail = XLSX.utils.json_to_sheet(detailRows)
  wsDetail['!cols'] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 30 },
    { wch: 10 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle')

  XLSX.writeFile(wb, fileName)
}
