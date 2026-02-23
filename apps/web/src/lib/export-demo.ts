import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { EnrichedMatch } from './types'

// ── Excel ─────────────────────────────────────────────────────────────────

export function exportDemoXlsx(matches: EnrichedMatch[]) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Partidos
  const matchRows = matches.map((m) => {
    const activeDesigs = m.designations.filter((d) => d.status !== 'rejected')
    const refs = activeDesigs.filter((d) => d.role === 'arbitro')
    const scos = activeDesigs.filter((d) => d.role === 'anotador')
    const cost = activeDesigs.reduce((s, d) => s + parseFloat(d.travelCost), 0)

    return {
      Partido: `${m.homeTeam} vs ${m.awayTeam}`,
      Fecha: m.date,
      Hora: m.time,
      Pabellón: m.venue?.name ?? '',
      Competición: m.competition?.name ?? '',
      'Árb. asignados': `${refs.length}/${m.refereesNeeded}`,
      'Anot. asignados': `${scos.length}/${m.scorersNeeded}`,
      Cubierto: m.isCovered ? 'Sí' : 'No',
      'Coste (€)': Number(cost.toFixed(2)),
    }
  })
  const wsMatches = XLSX.utils.json_to_sheet(matchRows)
  wsMatches['!cols'] = [
    { wch: 40 },
    { wch: 12 },
    { wch: 6 },
    { wch: 35 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, wsMatches, 'Partidos')

  // Sheet 2: Designaciones (una fila por asignación)
  const desigRows: Record<string, string | number>[] = []
  for (const m of matches) {
    for (const d of m.designations) {
      if (d.status === 'rejected') continue
      desigRows.push({
        Partido: `${m.homeTeam} vs ${m.awayTeam}`,
        Fecha: m.date,
        Hora: m.time,
        Pabellón: m.venue?.name ?? '',
        Persona: d.person?.name ?? '',
        Rol: d.role === 'arbitro' ? 'Árbitro' : 'Anotador',
        Categoría: d.person?.category ?? '',
        Municipio: d.municipality?.name ?? '',
        Estado: d.status,
        'Coste (€)': Number(parseFloat(d.travelCost).toFixed(2)),
        Km: Number(parseFloat(d.distanceKm).toFixed(1)),
      })
    }
  }
  const wsDesig = XLSX.utils.json_to_sheet(desigRows)
  wsDesig['!cols'] = [
    { wch: 40 },
    { wch: 12 },
    { wch: 6 },
    { wch: 35 },
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDesig, 'Designaciones')

  // Sheet 3: Resumen
  const totalMatches = matches.length
  const covered = matches.filter((m) => m.isCovered).length
  const totalDesigs = desigRows.length
  const totalCost = desigRows.reduce((s, r) => s + (r['Coste (€)'] as number), 0)

  const summaryData = [
    { Concepto: 'Total partidos', Valor: totalMatches },
    { Concepto: 'Partidos cubiertos', Valor: covered },
    {
      Concepto: 'Cobertura (%)',
      Valor: totalMatches > 0 ? Math.round((covered / totalMatches) * 100) : 0,
    },
    { Concepto: 'Total designaciones', Valor: totalDesigs },
    { Concepto: 'Coste total desplazamiento (€)', Valor: Number(totalCost.toFixed(2)) },
  ]
  const wsSummary = XLSX.utils.json_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

  XLSX.writeFile(wb, `demo-designaciones-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── PDF ───────────────────────────────────────────────────────────────────

export function exportDemoPdf(matches: EnrichedMatch[]) {
  const doc = new jsPDF({ orientation: 'landscape' })

  const totalMatches = matches.length
  const covered = matches.filter((m) => m.isCovered).length
  const allDesigs = matches.flatMap((m) => m.designations.filter((d) => d.status !== 'rejected'))
  const totalCost = allDesigs.reduce((s, d) => s + parseFloat(d.travelCost), 0)
  const coveragePct = totalMatches > 0 ? Math.round((covered / totalMatches) * 100) : 0

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('FBM — Sistema de Designaciones', 14, 18)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Simulación de jornada — Resultados del solver', 14, 26)

  // Summary boxes
  doc.setFontSize(9)
  const summaryY = 34
  const boxW = 60
  const summaryItems = [
    { label: 'Partidos', value: `${totalMatches}` },
    { label: 'Cubiertos', value: `${covered} (${coveragePct}%)` },
    { label: 'Designaciones', value: `${allDesigs.length}` },
    { label: 'Coste total', value: `${totalCost.toFixed(2)} €` },
  ]
  summaryItems.forEach((item, i) => {
    const x = 14 + i * (boxW + 4)
    doc.setFillColor(240, 240, 240)
    doc.roundedRect(x, summaryY, boxW, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(item.label, x + 3, summaryY + 5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(item.value, x + 3, summaryY + 11)
  })

  // Match table with designations
  const body: (string | number)[][] = []
  for (const m of matches) {
    const activeDesigs = m.designations.filter((d) => d.status !== 'rejected')
    const refNames = activeDesigs
      .filter((d) => d.role === 'arbitro')
      .map((d) => d.person?.name ?? '—')
      .join(', ')
    const scoNames = activeDesigs
      .filter((d) => d.role === 'anotador')
      .map((d) => d.person?.name ?? '—')
      .join(', ')
    const cost = activeDesigs.reduce((s, d) => s + parseFloat(d.travelCost), 0)

    body.push([
      `${m.homeTeam} vs ${m.awayTeam}`,
      `${m.date} ${m.time}`,
      m.venue?.name ?? '',
      refNames || '— sin cubrir —',
      scoNames || '— sin cubrir —',
      m.isCovered ? 'Sí' : 'No',
      cost.toFixed(2),
    ])
  }

  autoTable(doc, {
    startY: 54,
    head: [
      ['Partido', 'Fecha/Hora', 'Pabellón', 'Árbitros', 'Anotadores', 'Cubierto', 'Coste (€)'],
    ],
    body,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [0, 32, 91], fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 28 },
      2: { cellWidth: 45 },
      3: { cellWidth: 60 },
      4: { cellWidth: 45 },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 18, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.height
    doc.setFontSize(7)
    doc.setTextColor(160)
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — Página ${i}/${pageCount}`,
      14,
      h - 8,
    )
  }

  doc.save(`demo-designaciones-${new Date().toISOString().slice(0, 10)}.pdf`)
}
