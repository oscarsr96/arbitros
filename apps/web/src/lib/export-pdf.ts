import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export function exportLiquidationPdf(
  liquidation: LiquidationPerson[],
  matchday: number,
  season: string = '2024-25',
) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FBM — Federación de Baloncesto de Madrid', 14, 20)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Liquidación Jornada ${matchday} — Temporada ${season}`, 14, 30)

  // Table
  const totalCost = liquidation.reduce((sum, p) => sum + p.totalCost, 0)

  autoTable(doc, {
    startY: 40,
    head: [['Persona', 'Rol', 'Municipio', 'Partidos', 'Total (€)']],
    body: [
      ...liquidation.map((p) => [
        p.name,
        p.role === 'arbitro' ? 'Árbitro' : 'Anotador',
        p.municipality,
        p.matches.length.toString(),
        p.totalCost.toFixed(2),
      ]),
    ],
    foot: [['Total', '', '', '', totalCost.toFixed(2) + ' €']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [0, 32, 91] }, // FBM navy
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'center' },
      4: { halign: 'right' },
    },
  })

  // Footer with generation date
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, pageHeight - 10)

  doc.save(`liquidacion-jornada-${matchday}.pdf`)
}

export function exportPersonDetailPdf(
  person: LiquidationPerson,
  matchday: number,
  season: string = '2024-25',
) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FBM — Federación de Baloncesto de Madrid', 14, 20)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Justificante de desplazamiento — Jornada ${matchday}`, 14, 30)
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

  // Matches table
  autoTable(doc, {
    startY: 85,
    head: [['Partido', 'Fecha', 'Hora', 'Pabellón', 'Coste (€)', 'Km']],
    body: person.matches.map((m) => [
      `${m.homeTeam} vs ${m.awayTeam}`,
      m.date,
      m.time,
      m.venue,
      m.travelCost.toFixed(2),
      m.distanceKm.toFixed(1),
    ]),
    foot: [['Total', '', '', '', person.totalCost.toFixed(2) + ' €', '']],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 32, 91] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  })

  // Footer
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, pageHeight - 10)

  doc.save(`justificante-${person.name.replace(/\s+/g, '-').toLowerCase()}-j${matchday}.pdf`)
}
