import { describe, it, expect } from 'vitest'
import {
  parseMatchRange,
  filterMatchesByRange,
  getMatchesDateRange,
  listJornadas,
  resolveDefaultJornada,
} from '../match-query'

// 2025-09-27 es sábado → jornada = viernes 26 … jueves 2025-10-02.
const SATURDAY = '2025-09-27'

const matches = [
  { id: 'a', date: '2025-09-25' }, // jueves anterior: FUERA
  { id: 'b', date: '2025-09-26' }, // viernes: dentro
  { id: 'c', date: '2025-09-27' }, // sábado: dentro
  { id: 'd', date: '2025-09-28' }, // domingo: dentro
  { id: 'e', date: '2025-10-01' }, // miércoles: dentro
  { id: 'f', date: '2025-10-02' }, // jueves: dentro (último día)
  { id: 'g', date: '2025-10-03' }, // viernes siguiente: FUERA
]

function idsIn(range: Parameters<typeof filterMatchesByRange>[1]) {
  return filterMatchesByRange(matches, range).map((m) => m.id)
}

describe('parseMatchRange', () => {
  it('traduce ?jornada al rango viernes→jueves', () => {
    const range = parseMatchRange(new URLSearchParams({ jornada: SATURDAY }))
    expect(range).toEqual({ from: '2025-09-26', to: '2025-10-02' })
  })

  it('acepta from/to explícitos', () => {
    const range = parseMatchRange(new URLSearchParams({ from: '2025-10-01', to: '2025-10-05' }))
    expect(range).toEqual({ from: '2025-10-01', to: '2025-10-05' })
  })

  it('permite extremos abiertos', () => {
    expect(parseMatchRange(new URLSearchParams({ from: '2025-10-01' }))).toEqual({
      from: '2025-10-01',
      to: undefined,
    })
    expect(parseMatchRange(new URLSearchParams({ to: '2025-10-01' }))).toEqual({
      from: undefined,
      to: '2025-10-01',
    })
  })

  it('sin parámetros devuelve rango vacío (= sin filtro)', () => {
    expect(parseMatchRange(new URLSearchParams())).toEqual({ from: undefined, to: undefined })
  })

  it('jornada tiene prioridad sobre from/to', () => {
    const range = parseMatchRange(
      new URLSearchParams({ jornada: SATURDAY, from: '2020-01-01', to: '2030-01-01' }),
    )
    expect(range).toEqual({ from: '2025-09-26', to: '2025-10-02' })
  })
})

describe('filterMatchesByRange', () => {
  it('la ventana de jornada incluye viernes..jueves y excluye los bordes', () => {
    expect(idsIn(parseMatchRange(new URLSearchParams({ jornada: SATURDAY })))).toEqual([
      'b',
      'c',
      'd',
      'e',
      'f',
    ])
  })

  it('los extremos del rango son inclusivos', () => {
    expect(idsIn({ from: '2025-09-27', to: '2025-09-28' })).toEqual(['c', 'd'])
  })

  it('sin rango devuelve la lista intacta (compatibilidad)', () => {
    expect(filterMatchesByRange(matches, {})).toBe(matches)
  })

  it('un rango sin partidos devuelve lista vacía', () => {
    expect(idsIn({ from: '2026-01-01', to: '2026-01-31' })).toEqual([])
  })
})

describe('listJornadas', () => {
  it('agrupa por jornada y cuenta partidos', () => {
    // 'a' (jue 25/09) pertenece a la jornada ANTERIOR; b..f a la del 27/09;
    // 'g' (vie 03/10) abre la jornada del 04/10.
    expect(listJornadas(matches)).toEqual([
      { saturday: '2025-09-20', from: '2025-09-19', to: '2025-09-25', count: 1 },
      { saturday: '2025-09-27', from: '2025-09-26', to: '2025-10-02', count: 5 },
      { saturday: '2025-10-04', from: '2025-10-03', to: '2025-10-09', count: 1 },
    ])
  })

  it('devuelve las jornadas ordenadas por fecha sea cual sea el orden de entrada', () => {
    const saturdays = listJornadas([...matches].reverse()).map((j) => j.saturday)
    expect(saturdays).toEqual([...saturdays].sort())
  })

  it('la ventana de cada jornada coincide con el filtro por ?jornada=', () => {
    for (const j of listJornadas(matches)) {
      const viaRange = filterMatchesByRange(matches, { from: j.from, to: j.to })
      expect(viaRange).toHaveLength(j.count)
    }
  })

  it('no inventa jornadas sin partidos', () => {
    // Entre el 27/09 y el 15/11 no hay nada: solo debe salir una jornada por fecha real.
    const sparse = [{ date: '2025-09-27' }, { date: '2025-11-15' }]
    expect(listJornadas(sparse).map((j) => j.saturday)).toEqual(['2025-09-27', '2025-11-15'])
  })

  it('sin partidos devuelve lista vacía', () => {
    expect(listJornadas([])).toEqual([])
  })
})

describe('getMatchesDateRange', () => {
  it('devuelve la primera y la última fecha', () => {
    expect(getMatchesDateRange(matches)).toEqual({
      minDate: '2025-09-25',
      maxDate: '2025-10-03',
    })
  })

  it('no depende del orden del array', () => {
    expect(getMatchesDateRange([...matches].reverse())).toEqual({
      minDate: '2025-09-25',
      maxDate: '2025-10-03',
    })
  })

  it('devuelve null sin partidos', () => {
    expect(getMatchesDateRange([])).toBeNull()
  })
})

describe('resolveDefaultJornada', () => {
  it('dentro de temporada: devuelve la jornada de hoy si tiene partidos', () => {
    // 2025-09-29 (lunes) cae en el bloque lunes-jueves de la jornada del 27/09.
    const result = resolveDefaultJornada(matches, '2025-09-29')
    expect(result).toEqual({
      saturday: '2025-09-27',
      from: '2025-09-26',
      to: '2025-10-02',
      count: 5,
    })
  })

  it('fuera por delante (pretemporada): devuelve la primera jornada futura con partidos', () => {
    // Muy anterior a la primera jornada del fixture (2025-09-20).
    const result = resolveDefaultJornada(matches, '2025-09-01')
    expect(result?.saturday).toBe('2025-09-20')
  })

  it('fuera por detrás (fin de temporada): devuelve la última jornada con partidos', () => {
    // Reproduce el caso real: hoy 2026-07-21, temporada terminada el 2026-05-10.
    const seasonEnd = [{ date: '2026-04-25' }, { date: '2026-05-09' }]
    const result = resolveDefaultJornada(seasonEnd, '2026-07-21')
    expect(result?.saturday).toBe('2026-05-09')
  })

  it('sábado sin partidos entre jornadas: salta a la siguiente jornada futura con partidos', () => {
    // Sin partidos la semana del 04/10 (salto de 27/09 a 11/10).
    const sparse = [{ date: '2025-09-27' }, { date: '2025-10-11' }]
    // 2025-10-06 (lunes) cae en el bloque lunes-jueves de la jornada del 04/10, vacía.
    const result = resolveDefaultJornada(sparse, '2025-10-06')
    expect(result?.saturday).toBe('2025-10-11')
  })

  it('sin partidos devuelve null', () => {
    expect(resolveDefaultJornada([], '2026-07-21')).toBeNull()
  })
})
