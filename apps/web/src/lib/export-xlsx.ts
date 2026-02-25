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

export function exportLiquidationXlsx(
  liquidation: LiquidationPerson[],
  costByMatchday: CostByMatchday[],
  matchday: number,
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

  XLSX.writeFile(wb, `liquidacion-jornada-${matchday}.xlsx`)
}

// ── Monthly Liquidation Export ───────────────────────────────────────────

interface MonthlyLiquidationPerson {
  name: string
  role: string
  municipality: string
  bankIban: string
  matchdays: { matchday: number; matches: number; cost: number; km: number }[]
  totalMatches: number
  totalKm: number
  totalCost: number
}

export function exportMonthlyLiquidationXlsx(
  data: MonthlyLiquidationPerson[],
  matchdays: number[],
) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Resumen mensual
  const resumenData = data.map((p) => {
    const row: Record<string, string | number> = {
      Persona: p.name,
      Rol: p.role === 'arbitro' ? 'Árbitro' : 'Anotador',
      Municipio: p.municipality,
      IBAN: p.bankIban,
    }
    for (const md of matchdays) {
      const entry = p.matchdays.find((m) => m.matchday === md)
      row[`J${md} (€)`] = entry ? entry.cost : 0
    }
    row['Total Partidos'] = p.totalMatches
    row['Total Km'] = p.totalKm
    row['Total (€)'] = p.totalCost
    return row
  })
  const wsResumen = XLSX.utils.json_to_sheet(resumenData)
  const cols = [
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 28 },
    ...matchdays.map(() => ({ wch: 10 })),
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
  ]
  wsResumen['!cols'] = cols
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen mensual')

  // Sheet 2: Detalle por jornada
  const detailRows: Record<string, string | number>[] = []
  for (const p of data) {
    for (const md of p.matchdays) {
      detailRows.push({
        Persona: p.name,
        Rol: p.role === 'arbitro' ? 'Árbitro' : 'Anotador',
        Jornada: md.matchday,
        Partidos: md.matches,
        Km: md.km,
        'Coste (€)': md.cost,
      })
    }
  }
  const wsDetail = XLSX.utils.json_to_sheet(detailRows)
  wsDetail['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle por jornada')

  const mdLabel =
    matchdays.length > 0 ? `J${matchdays[0]}-J${matchdays[matchdays.length - 1]}` : 'mensual'
  XLSX.writeFile(wb, `liquidacion-mensual-${mdLabel}.xlsx`)
}
