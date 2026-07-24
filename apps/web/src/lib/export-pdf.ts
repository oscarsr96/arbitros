import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatLocalDate, seasonLabel } from './mock-data-client'

// Default de temporada = la de HOY (`seasonLabel`, única fuente de la app):
// antes era el literal fijo '2024-25', ya desactualizado. Los llamadores con
// datos reales (reportes-view) pasan la temporada explícita derivada del
// rango de fechas del informe; este default solo cubre llamadas sin ese dato.
const CURRENT_SEASON = () => seasonLabel(formatLocalDate(new Date()))

export interface LiquidationPerson {
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
  // Desglose real por día (regla FBM): fuente de verdad del desplazamiento,
  // Σ cost == totalCost. `matches[]` de arriba es solo informativa (fix P3).
  byDay: { date: string; cost: number; km: number }[]
  totalCost: number
  fees: number
  total: number
  unresolvedFees: number
}

// "Jornada 15" | "Mes 2025-10" | "Temporada completa" → slug de fichero.
const scopeSlug = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

interface LiquidationPdfRow {
  name: string
  roleLabel: string
  municipality: string
  matchCount: number
  travelCost: number
  fees: number
  total: number
  unresolvedFees: number
}

// Función pura de armado de filas (testeable sin jsPDF): columnas separadas
// Desplazamiento/Honorarios/Total + totales del ámbito (cabo 2).
export function buildLiquidationPdfRows(liquidation: LiquidationPerson[]): {
  rows: LiquidationPdfRow[]
  totals: { travelCost: number; fees: number; total: number; unresolvedFees: number }
} {
  const rows: LiquidationPdfRow[] = liquidation.map((p) => ({
    name: p.name,
    roleLabel: p.role === 'arbitro' ? 'Árbitro' : 'Anotador',
    municipality: p.municipality,
    matchCount: p.matches.length,
    travelCost: p.totalCost,
    fees: p.fees,
    total: p.total,
    unresolvedFees: p.unresolvedFees,
  }))
  const totals = rows.reduce(
    (acc, r) => ({
      travelCost: acc.travelCost + r.travelCost,
      fees: acc.fees + r.fees,
      total: acc.total + r.total,
      unresolvedFees: acc.unresolvedFees + r.unresolvedFees,
    }),
    { travelCost: 0, fees: 0, total: 0, unresolvedFees: 0 },
  )
  return { rows, totals }
}

// `scopeLabel` es la etiqueta legible del ámbito exportado (fix "Jornada 0":
// en ámbito mes/temporada no hay matchday, así que título y fichero usan la
// etiqueta real del ámbito, no un número de jornada).
export function exportLiquidationPdf(
  liquidation: LiquidationPerson[],
  scopeLabel: string,
  season: string = CURRENT_SEASON(),
) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FBM — Federación de Baloncesto de Madrid', 14, 20)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Liquidación ${scopeLabel} — Temporada ${season}`, 14, 30)

  // Table
  const { rows, totals } = buildLiquidationPdfRows(liquidation)

  autoTable(doc, {
    startY: 40,
    head: [
      [
        'Persona',
        'Rol',
        'Municipio',
        'Partidos',
        'Desplazamiento (€)',
        'Honorarios (€)',
        'Pend.',
        'Total (€)',
      ],
    ],
    body: rows.map((r) => [
      r.name,
      r.roleLabel,
      r.municipality,
      r.matchCount.toString(),
      r.travelCost.toFixed(2),
      r.fees.toFixed(2),
      r.unresolvedFees > 0 ? r.unresolvedFees.toString() : '',
      r.total.toFixed(2),
    ]),
    foot: [
      [
        'Total',
        '',
        '',
        '',
        totals.travelCost.toFixed(2),
        totals.fees.toFixed(2),
        totals.unresolvedFees > 0 ? totals.unresolvedFees.toString() : '',
        totals.total.toFixed(2) + ' €',
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [0, 32, 91] }, // FBM navy
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'center' },
      7: { halign: 'right' },
    },
  })

  // Footer with generation date
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, pageHeight - 10)

  doc.save(`liquidacion-${scopeSlug(scopeLabel)}.pdf`)
}

interface PersonDetailRow {
  date: string
  km: number
  travelCost: number
  matchCount: number
  matchesDetail: string
}

// Función pura de armado de filas (testeable sin jsPDF): una fila por DÍA
// (fix P3, cabo 1). Antes tabulaba `person.matches[]` con coste ESTIMADO por
// partido (`calculateMockTravelCost`) mientras el pie usaba el total real
// por día: las líneas no sumaban el pie. `byDay` es la fuente real (regla
// FBM: fijo o km por día, nunca por partido), así que Σ travelCost de las
// filas == person.totalCost por construcción. Los partidos de cada día se
// listan solo como dato (equipos/hora/pabellón), sin cifra que no sume.
export function buildPersonDetailRows(person: LiquidationPerson): PersonDetailRow[] {
  return person.byDay.map((day) => {
    const dayMatches = person.matches.filter((m) => m.date === day.date)
    return {
      date: day.date,
      km: day.km,
      travelCost: day.cost,
      matchCount: dayMatches.length,
      matchesDetail: dayMatches
        .map((m) => `${m.time} ${m.homeTeam}-${m.awayTeam} (${m.venue})`)
        .join('; '),
    }
  })
}

export function exportPersonDetailPdf(
  person: LiquidationPerson,
  scopeLabel: string,
  season: string = CURRENT_SEASON(),
) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FBM — Federación de Baloncesto de Madrid', 14, 20)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Justificante de desplazamiento — ${scopeLabel}`, 14, 30)
  doc.text(`Temporada ${season}`, 14, 37)

  // Person info
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Datos personales', 14, 50)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nombre: ${person.name}`, 14, 57)
  doc.text(`Rol: ${person.role === 'arbitro' ? 'Árbitro' : 'Anotador'}`, 14, 63)
  doc.text(`Municipio: ${person.municipality}`, 14, 69)
  doc.text(`IBAN: ${person.bankIban}`, 14, 75)

  // Days table (fix P3: por día, no por partido estimado)
  const rows = buildPersonDetailRows(person)
  const totalKm = rows.reduce((sum, r) => sum + r.km, 0)
  const totalMatches = rows.reduce((sum, r) => sum + r.matchCount, 0)

  autoTable(doc, {
    startY: 85,
    head: [['Fecha', 'Km', 'Desplazamiento (€)', 'Partidos', 'Detalle']],
    body: rows.map((r) => [
      r.date,
      r.km.toFixed(1),
      r.travelCost.toFixed(2),
      r.matchCount.toString(),
      r.matchesDetail,
    ]),
    foot: [
      [
        'Total',
        totalKm.toFixed(1),
        person.totalCost.toFixed(2) + ' €',
        totalMatches.toString(),
        '',
      ],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 32, 91] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'center' },
    },
  })

  // Totales: desplazamiento + honorarios por separado (la Σ de días ya
  // cuadra con totalCost, ver buildPersonDetailRows).
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 85
  let y = finalY + 10
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen', 14, y)
  doc.setFont('helvetica', 'normal')
  y += 7
  doc.text(`Desplazamiento: ${person.totalCost.toFixed(2)} €`, 14, y)
  y += 6
  doc.text(`Honorarios: ${person.fees.toFixed(2)} €`, 14, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${person.total.toFixed(2)} €`, 14, y)

  if (person.unresolvedFees > 0) {
    y += 10
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 60, 0)
    doc.text(
      `Aviso: ${person.unresolvedFees} designación${person.unresolvedFees !== 1 ? 'es' : ''} sin tarifa aplicada`,
      14,
      y,
    )
    doc.setTextColor(0, 0, 0)
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, pageHeight - 10)

  doc.save(
    `justificante-${person.name.replace(/\s+/g, '-').toLowerCase()}-${scopeSlug(scopeLabel)}.pdf`,
  )
}

// ── Monthly Justificante PDF (per person) ───────────────────────────────
// (El PDF mensual completo legacy, `exportMonthlyLiquidationPdf` con columnas
// J1..Jn por matchday, se retiró en 4.3: era incompatible con el shape de mes
// natural y su caso de uso lo cubren el Excel mensual + este justificante.)
// Contrato del backend (/api/admin/reports?month=YYYY-MM, `monthlyLiquidation.people[]`):
// el desglose es POR DÍA (no por partido estimado), agrupado igual que la
// liquidación real (misma forma que consume `export-xlsx.ts::buildMonthlyRows`).
// No se recalcula coste aquí: se consume travelCost/fees/total tal cual llega.

interface MonthlyJustificanteMatch {
  matchId: string
  date: string
  time: string
  homeTeam: string
  awayTeam: string
  venue: string
  municipality: string
}

interface MonthlyJustificanteDay {
  date: string
  matches: MonthlyJustificanteMatch[]
  municipalities: string[]
  km: number
  travelCost: number
}

export interface MonthlyJustificantePerson {
  personId: string
  name: string
  role: string
  municipality: string
  bankIban: string
  days: MonthlyJustificanteDay[]
  travelCost: number
  fees: number
  total: number
  unresolvedFees: number
}

interface JustificanteRow {
  date: string
  municipalities: string
  km: number
  travelCost: number
  matchCount: number
  matchesDetail: string
}

// Mes "YYYY-MM" → "Julio 2026" (fix cabo 3: nunca "Jornada 0", un justificante
// mensual no tiene matchday).
function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const label = new Date(year, m - 1, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Función pura de armado de filas (testeable sin jsPDF): una fila por DÍA.
// Σ travelCost de las filas == person.travelCost (fix P3).
export function buildJustificanteRows(person: MonthlyJustificantePerson): JustificanteRow[] {
  return person.days.map((day) => ({
    date: day.date,
    municipalities: day.municipalities.join(', '),
    km: day.km,
    travelCost: day.travelCost,
    matchCount: day.matches.length,
    matchesDetail: day.matches.map((m) => `${m.time} ${m.homeTeam}-${m.awayTeam}`).join('; '),
  }))
}

export function exportMonthlyJustificantePdf(
  person: MonthlyJustificantePerson,
  month: string,
  season: string = CURRENT_SEASON(),
) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FBM — Federación de Baloncesto de Madrid', 14, 20)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Justificante de desplazamiento — ${monthLabel(month)}`, 14, 30)
  doc.text(`Temporada ${season}`, 14, 37)

  // Person info
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Datos personales', 14, 50)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nombre: ${person.name}`, 14, 57)
  doc.text(`Rol: ${person.role === 'arbitro' ? 'Árbitro' : 'Anotador'}`, 14, 63)
  doc.text(`Municipio: ${person.municipality}`, 14, 69)
  doc.text(`IBAN: ${person.bankIban}`, 14, 75)

  // Days table
  const rows = buildJustificanteRows(person)
  const totalKm = rows.reduce((sum, r) => sum + r.km, 0)
  const totalMatches = rows.reduce((sum, r) => sum + r.matchCount, 0)

  autoTable(doc, {
    startY: 85,
    head: [['Fecha', 'Municipios', 'Km', 'Desplazamiento (€)', 'Partidos', 'Detalle']],
    body: rows.map((r) => [
      r.date,
      r.municipalities,
      r.km.toFixed(1),
      r.travelCost.toFixed(2),
      r.matchCount.toString(),
      r.matchesDetail,
    ]),
    foot: [
      [
        'Total',
        '',
        totalKm.toFixed(1),
        person.travelCost.toFixed(2) + ' €',
        totalMatches.toString(),
        '',
      ],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 32, 91] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'center' },
    },
  })

  // Totales: desplazamiento + honorarios por separado (la Σ de días ya
  // cuadra con travelCost, ver buildJustificanteRows).
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 85
  let y = finalY + 10
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen', 14, y)
  doc.setFont('helvetica', 'normal')
  y += 7
  doc.text(`Desplazamiento: ${person.travelCost.toFixed(2)} €`, 14, y)
  y += 6
  doc.text(`Honorarios: ${person.fees.toFixed(2)} €`, 14, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${person.total.toFixed(2)} €`, 14, y)

  if (person.unresolvedFees > 0) {
    y += 10
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 60, 0)
    doc.text(
      `Aviso: ${person.unresolvedFees} designación${person.unresolvedFees !== 1 ? 'es' : ''} sin tarifa aplicada`,
      14,
      y,
    )
    doc.setTextColor(0, 0, 0)
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, pageHeight - 10)

  doc.save(`justificante-${person.name.replace(/\s+/g, '-').toLowerCase()}-${month}.pdf`)
}
