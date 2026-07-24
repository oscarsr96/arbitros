import { describe, it, expect } from 'vitest'
import {
  buildLiquidationRows,
  buildMonthlyRows,
  type LiquidationPerson,
  type MonthlyLiquidation,
} from '../export-xlsx'

// Fixture del ámbito seleccionado (jornada/mes/temporada): matches[] es solo
// informativa, fees/total/unresolvedFees ya vienen resueltos por el backend.
const liquidationFixture: LiquidationPerson[] = [
  {
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
    ],
    totalCost: 3,
    fees: 20,
    total: 23,
    unresolvedFees: 1,
  },
  {
    name: 'Ana López',
    role: 'anotador',
    municipality: 'Alcalá de Henares',
    bankIban: 'ES11 1111 1111 1111',
    matches: [],
    totalCost: 7.8,
    fees: 15,
    total: 22.8,
    unresolvedFees: 0,
  },
]
const costByMatchdayFixture = [{ matchday: 15, cost: 10.8, matches: 4 }]

describe('buildLiquidationRows', () => {
  it('añade columnas separadas Desplazamiento/Honorarios/Total por persona', () => {
    const { liqRows } = buildLiquidationRows(
      liquidationFixture,
      costByMatchdayFixture,
      'Jornada 15',
    )
    const personRow = liqRows.find((r) => r.Persona === 'Juan Pérez')!
    expect(personRow['Desplazamiento (€)']).toBe(3)
    expect(personRow['Honorarios (€)']).toBe(20)
    expect(personRow['Total (€)']).toBe(23)
    expect(personRow['Tarifas pendientes']).toBe(1)
  })

  it('incluye fila TOTAL con las sumas del ámbito', () => {
    const { liqRows } = buildLiquidationRows(
      liquidationFixture,
      costByMatchdayFixture,
      'Jornada 15',
    )
    const totalRow = liqRows.find((r) => r.Persona === 'TOTAL')!
    expect(totalRow['Desplazamiento (€)']).toBe(10.8)
    expect(totalRow['Honorarios (€)']).toBe(35)
    expect(totalRow['Total (€)']).toBe(45.8)
    expect(totalRow['Tarifas pendientes']).toBe(1)
  })

  it('Σ filas de detalle por persona == Desplazamiento de esa persona', () => {
    const { liqRows, detailRows } = buildLiquidationRows(
      liquidationFixture,
      costByMatchdayFixture,
      'Jornada 15',
    )
    const personRow = liqRows.find((r) => r.Persona === 'Juan Pérez')!
    const detailSum = detailRows
      .filter((r) => r.Persona === 'Juan Pérez')
      .reduce((sum, r) => sum + Number(r['Coste (€)']), 0)
    expect(detailSum).toBeCloseTo(Number(personRow['Desplazamiento (€)']), 5)
  })

  it('el fichero se nombra por la etiqueta del ámbito', () => {
    const { fileName } = buildLiquidationRows(
      liquidationFixture,
      costByMatchdayFixture,
      'Jornada 15',
    )
    expect(fileName).toBe('liquidacion-jornada-15.xlsx')
  })
})

// Fixture: 1 persona, 2 días. Coste por día ya viene agrupado desde el
// backend (regla FBM: fijo por día o km por día, nunca por partido estimado).
const fixture: MonthlyLiquidation = {
  month: '2025-10',
  people: [
    {
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
    },
  ],
  totalTravelCost: 10.8,
  totalFees: 40,
  total: 50.8,
}

describe('buildMonthlyRows', () => {
  it('detalle por día suma exactamente el travelCost del resumen (fix P3)', () => {
    const { resumenRows, detailRows } = buildMonthlyRows(fixture)

    const personRow = resumenRows.find((r) => r.Persona === 'Juan Pérez')!
    const detailSum = detailRows
      .filter((r) => r.Persona === 'Juan Pérez')
      .reduce((sum, r) => sum + Number(r['Desplazamiento (€)']), 0)

    expect(detailSum).toBeCloseTo(Number(personRow['Desplazamiento (€)']), 5)
    expect(personRow['Desplazamiento (€)']).toBe(10.8)
  })

  it('el detalle tiene una fila por día, no por partido', () => {
    const { detailRows } = buildMonthlyRows(fixture)
    expect(detailRows).toHaveLength(2)
    expect(detailRows[1].Partidos).toBe(2)
    expect(detailRows[1].Municipios).toBe('Alcalá de Henares')
  })

  it('total = desplazamiento + honorarios, con columnas separadas', () => {
    const { resumenRows } = buildMonthlyRows(fixture)
    const personRow = resumenRows.find((r) => r.Persona === 'Juan Pérez')!
    expect(personRow['Desplazamiento (€)']).toBe(10.8)
    expect(personRow['Honorarios (€)']).toBe(40)
    expect(personRow['Total (€)']).toBe(50.8)
  })

  it('incluye fila de totales del mes', () => {
    const { resumenRows } = buildMonthlyRows(fixture)
    const totalRow = resumenRows.find((r) => r.Persona === 'TOTAL')!
    expect(totalRow['Desplazamiento (€)']).toBe(10.8)
    expect(totalRow['Honorarios (€)']).toBe(40)
    expect(totalRow['Total (€)']).toBe(50.8)
  })

  it('el fichero se titula por MES, nunca por matchday (fix Jornada 0)', () => {
    const { fileName } = buildMonthlyRows(fixture)
    expect(fileName).toBe('liquidacion-mensual-2025-10.xlsx')
  })
})
