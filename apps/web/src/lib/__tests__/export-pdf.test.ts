import { describe, it, expect } from 'vitest'
import {
  buildJustificanteRows,
  buildLiquidationPdfRows,
  buildPersonDetailRows,
  type LiquidationPerson,
  type MonthlyJustificantePerson,
} from '../export-pdf'

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

// Fixture del ámbito seleccionado (jornada/mes/temporada). `matches[].travelCost`
// es la estimación ANTIGUA por partido (3+5+5=13) que NO cuadra con el total
// real por día (byDay: 3+7.8=10.8) — así se prueba el fix P3: las filas nuevas
// deben salir de `byDay`, no de sumar esas estimaciones por partido.
const liquidationPerson: LiquidationPerson = {
  name: 'Juan Pérez',
  role: 'arbitro',
  municipality: 'Madrid',
  bankIban: 'ES00 0000 0000 0000',
  matches: [
    {
      matchId: 'm1',
      date: '2025-10-03',
      time: '10:00',
      homeTeam: 'A',
      awayTeam: 'B',
      venue: 'Pabellón 1',
      travelCost: 3,
      distanceKm: 0,
    },
    {
      matchId: 'm2',
      date: '2025-10-04',
      time: '11:00',
      homeTeam: 'C',
      awayTeam: 'D',
      venue: 'Pabellón 2',
      travelCost: 5,
      distanceKm: 15,
    },
    {
      matchId: 'm3',
      date: '2025-10-04',
      time: '13:00',
      homeTeam: 'E',
      awayTeam: 'F',
      venue: 'Pabellón 3',
      travelCost: 5,
      distanceKm: 15,
    },
  ],
  byDay: [
    { date: '2025-10-03', cost: 3, km: 0 },
    { date: '2025-10-04', cost: 7.8, km: 30 },
  ],
  totalCost: 10.8,
  fees: 40,
  total: 50.8,
  unresolvedFees: 1,
}

describe('buildPersonDetailRows', () => {
  it('una fila por DÍA (byDay real), Σ travelCost de filas == person.totalCost (fix P3)', () => {
    const rows = buildPersonDetailRows(liquidationPerson)
    expect(rows).toHaveLength(2)
    const sum = rows.reduce((s, r) => s + r.travelCost, 0)
    expect(sum).toBeCloseTo(liquidationPerson.totalCost, 5)
    // La suma de estimaciones por partido (13) NO cuadraba con el total real:
    // confirma que ya no se usa esa vía.
    const naiveMatchSum = liquidationPerson.matches.reduce((s, m) => s + m.travelCost, 0)
    expect(naiveMatchSum).not.toBeCloseTo(liquidationPerson.totalCost, 5)
  })

  it('agrupa los partidos de cada día sin cifra estimada por partido', () => {
    const rows = buildPersonDetailRows(liquidationPerson)
    expect(rows[0].matchCount).toBe(1)
    expect(rows[1].matchCount).toBe(2)
    expect(rows[1].matchesDetail).toBe('11:00 C-D (Pabellón 2); 13:00 E-F (Pabellón 3)')
  })
})

describe('buildLiquidationPdfRows', () => {
  it('columnas separadas Desplazamiento/Honorarios/Total + totales', () => {
    const other: LiquidationPerson = {
      ...liquidationPerson,
      name: 'Ana López',
      role: 'anotador',
      totalCost: 2,
      fees: 10,
      total: 12,
      unresolvedFees: 0,
    }
    const { rows, totals } = buildLiquidationPdfRows([liquidationPerson, other])
    expect(rows[0].travelCost).toBe(10.8)
    expect(rows[0].fees).toBe(40)
    expect(rows[0].total).toBe(50.8)
    expect(totals.travelCost).toBeCloseTo(12.8, 5)
    expect(totals.fees).toBe(50)
    expect(totals.total).toBeCloseTo(62.8, 5)
    expect(totals.unresolvedFees).toBe(1)
  })
})

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
