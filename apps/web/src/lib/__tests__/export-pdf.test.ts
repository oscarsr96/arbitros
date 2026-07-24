import { describe, it, expect } from 'vitest'
import { buildJustificanteRows, type MonthlyJustificantePerson } from '../export-pdf'

// Mismo fixture numérico que export-xlsx.test.ts (misma fuente de datos:
// monthlyLiquidation.people[] del backend), para que ambos exports cuadren.
const person: MonthlyJustificantePerson = {
  personId: 'p1',
  name: 'Juan Pérez',
  role: 'arbitro',
  municipality: 'Madrid',
  bankIban: 'ES00 0000 0000 0000',
  days: [
    {
      date: '2025-10-03',
      matches: [
        {
          matchId: 'm1',
          date: '2025-10-03',
          time: '10:00',
          homeTeam: 'A',
          awayTeam: 'B',
          venue: 'Pabellón 1',
          municipality: 'Madrid',
        },
      ],
      municipalities: ['Madrid'],
      km: 0,
      travelCost: 3,
    },
    {
      date: '2025-10-04',
      matches: [
        {
          matchId: 'm2',
          date: '2025-10-04',
          time: '11:00',
          homeTeam: 'C',
          awayTeam: 'D',
          venue: 'Pabellón 2',
          municipality: 'Alcalá de Henares',
        },
        {
          matchId: 'm3',
          date: '2025-10-04',
          time: '13:00',
          homeTeam: 'E',
          awayTeam: 'F',
          venue: 'Pabellón 3',
          municipality: 'Alcalá de Henares',
        },
      ],
      municipalities: ['Alcalá de Henares'],
      km: 30,
      travelCost: 7.8,
    },
  ],
  travelCost: 10.8,
  fees: 40,
  total: 50.8,
  unresolvedFees: 0,
}

describe('buildJustificanteRows', () => {
  it('una fila por día, Σ desplazamiento de filas == person.travelCost (fix P3)', () => {
    const rows = buildJustificanteRows(person)
    expect(rows).toHaveLength(2)
    const sum = rows.reduce((s, r) => s + r.travelCost, 0)
    expect(sum).toBeCloseTo(person.travelCost, 5)
  })

  it('total = desplazamiento + honorarios', () => {
    expect(Number((person.travelCost + person.fees).toFixed(2))).toBe(person.total)
  })

  it('nº de partidos y municipios por día correctos', () => {
    const rows = buildJustificanteRows(person)
    expect(rows[0].matchCount).toBe(1)
    expect(rows[0].municipalities).toBe('Madrid')
    expect(rows[1].matchCount).toBe(2)
    expect(rows[1].municipalities).toBe('Alcalá de Henares')
    expect(rows[1].matchesDetail).toBe('11:00 C-D; 13:00 E-F')
  })
})
