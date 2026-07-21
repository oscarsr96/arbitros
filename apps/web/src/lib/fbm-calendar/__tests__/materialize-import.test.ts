import { describe, it, expect } from 'vitest'
import { materializeImport, UnmappedCategoryError } from '../materialize-import'
import type { ParsedCsvMatch } from '../parse-calendar-csv'
import { mockCompetitions, mockMatches, mockVenues } from '@/lib/mock-data'

function buildMatch(overrides: Partial<ParsedCsvMatch>): ParsedCsvMatch {
  return {
    sourceId: '1001',
    category: 'Junior Masc. Pref.',
    fase: 'Liga Regular',
    grupo: 'A',
    matchday: 5,
    homeClub: 'C.B. Vallecas',
    homeTeam: 'Vallecas A',
    awayClub: 'C.B. Alcorcón',
    awayTeam: 'Alcorcón B',
    date: '2026-03-14',
    time: '10:00',
    venueName: 'CDM Villa de Madrid',
    venueAddress: 'C/ Brezos, 4',
    poblacion: 'Madrid',
    ...overrides,
  }
}

describe('materializeImport', () => {
  it('carga un partido normal generando competición, venue y match con ids fbm-*', () => {
    const result = materializeImport([buildMatch({})], [], 1)

    expect(result.matches).toHaveLength(1)
    expect(result.venues).toHaveLength(1)
    expect(result.competitions).toHaveLength(1)

    const match = result.matches[0]
    expect(match.id).toBe('fbm-match-1001')
    expect(match.venueId).toBe(result.venues[0].id)
    expect(match.competitionId).toBe(result.competitions[0].id)
    expect(match.venueId).toMatch(/^fbm-venue-/)
    expect(match.competitionId).toMatch(/^fbm-comp-/)

    expect(result.summary.matchesParsed).toBe(1)
    expect(result.summary.matchesLoaded).toBe(1)
    expect(result.summary.skippedNoDate).toBe(0)
    expect(result.summary.timeTBD).toBe(0)
    expect(result.summary.venuesCreated).toBe(1)
  })

  // Con ~24.500 partidos por temporada, descartar en silencio las filas de una
  // categoría desconocida perdería miles de partidos sin avisar: se aborta.
  it('categoría no mapeada: aborta el import entero con UnmappedCategoryError', () => {
    expect(() =>
      materializeImport([buildMatch({ sourceId: '1002', category: 'Categoría Inventada' })], [], 1),
    ).toThrow(UnmappedCategoryError)
  })

  it('el error lista TODAS las categorías sin mapear, ordenadas por nº de partidos', () => {
    let thrown: UnmappedCategoryError | null = null
    try {
      materializeImport(
        [
          buildMatch({ sourceId: '2001', category: 'Categoría Inventada' }),
          buildMatch({ sourceId: '2002', category: 'Otra Rara' }),
          buildMatch({ sourceId: '2003', category: 'Otra Rara' }),
          buildMatch({ sourceId: '2004', category: 'Junior Masc. Pref.' }),
        ],
        [],
        1,
      )
    } catch (err) {
      thrown = err as UnmappedCategoryError
    }

    expect(thrown).toBeInstanceOf(UnmappedCategoryError)
    expect(thrown?.categories).toEqual([
      { category: 'Otra Rara', matchCount: 2 },
      { category: 'Categoría Inventada', matchCount: 1 },
    ])
    expect(thrown?.message).toContain('Otra Rara')
    expect(thrown?.message).toContain('Categoría Inventada')
  })

  it('date null: no carga el partido y cuenta skippedNoDate', () => {
    const result = materializeImport([buildMatch({ sourceId: '1003', date: null })], [], 1)

    expect(result.matches).toHaveLength(0)
    expect(result.summary.skippedNoDate).toBe(1)
    expect(result.summary.matchesLoaded).toBe(0)
  })

  it('time null: sintetiza la hora dentro de la franja y la marca como estimada', () => {
    const result = materializeImport([buildMatch({ sourceId: '1004', time: null })], [], 1)

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].time).toMatch(/^\d{2}:\d{2}$/)
    expect(result.matches[0].time >= '09:00').toBe(true)
    expect(result.matches[0].time <= '20:30').toBe(true)
    expect(result.matches[0].timeIsEstimated).toBe(true)
    expect(result.summary.timeTBD).toBe(1)
    expect(result.summary.schedule.synthesizedTimes).toBe(1)
  })

  it('hora real del CSV: se preserva tal cual y no se marca como estimada', () => {
    const result = materializeImport([buildMatch({ sourceId: '1005', time: '18:45' })], [], 1)

    expect(result.matches[0].time).toBe('18:45')
    expect(result.matches[0].timeIsEstimated).toBe(false)
    expect(result.summary.schedule.realTimes).toBe(1)
    expect(result.summary.schedule.synthesizedTimes).toBe(0)
  })

  it('mismo pabellón y fecha: los partidos sin hora se escalonan cada 90 min', () => {
    const result = materializeImport(
      [
        buildMatch({ sourceId: '8001', time: null }),
        buildMatch({ sourceId: '8002', time: null }),
        buildMatch({ sourceId: '8003', time: null }),
      ],
      [],
      1,
    )

    const mins = result.matches.map((m) => {
      const [h, min] = m.time.split(':').map(Number)
      return h * 60 + min
    })
    expect(mins[1] - mins[0]).toBe(90)
    expect(mins[2] - mins[1]).toBe(90)
  })

  it('dos partidos con mismo sourceId (entre ficheros) se cargan como un único match', () => {
    const result = materializeImport(
      [
        buildMatch({ sourceId: '2001' }),
        buildMatch({ sourceId: '2001', homeTeam: 'Vallecas A (repetido)' }),
      ],
      [],
      2,
    )

    expect(result.matches).toHaveLength(1)
    expect(result.summary.matchesParsed).toBe(2)
    expect(result.summary.matchesLoaded).toBe(1)
  })

  it('dos partidos distinto sourceId con mismo venueName generan un único venue', () => {
    const result = materializeImport(
      [
        buildMatch({ sourceId: '3001', venueName: 'Polideportivo Norte' }),
        buildMatch({ sourceId: '3002', venueName: 'Polideportivo Norte' }),
      ],
      [],
      1,
    )

    expect(result.matches).toHaveLength(2)
    expect(result.venues).toHaveLength(1)
    expect(result.matches[0].venueId).toBe(result.matches[1].venueId)
  })

  it('población no resoluble deja municipalityId "" y se acumula en unresolvedMunicipalities', () => {
    const result = materializeImport(
      [buildMatch({ sourceId: '4001', poblacion: 'Chinchón' })],
      [],
      1,
    )

    expect(result.venues[0].municipalityId).toBe('')
    expect(result.summary.unresolvedMunicipalities).toContain('Chinchón')
  })

  it('no muta ningún array global (mockMatches, mockVenues, mockCompetitions)', () => {
    const matchesBefore = mockMatches.length
    const venuesBefore = mockVenues.length
    const competitionsBefore = mockCompetitions.length

    materializeImport(
      [buildMatch({}), buildMatch({ sourceId: '5002', venueName: 'Otro Campo' })],
      [],
      1,
    )

    expect(mockMatches.length).toBe(matchesBefore)
    expect(mockVenues.length).toBe(venuesBefore)
    expect(mockCompetitions.length).toBe(competitionsBefore)
  })

  it('A2: mismo venueName en municipios distintos genera dos venues (no se fusionan)', () => {
    const result = materializeImport(
      [
        buildMatch({ sourceId: '6001', venueName: 'Polideportivo Municipal', poblacion: 'Madrid' }),
        buildMatch({ sourceId: '6002', venueName: 'Polideportivo Municipal', poblacion: 'Getafe' }),
      ],
      [],
      1,
    )
    expect(result.venues).toHaveLength(2)
    expect(result.matches[0].venueId).not.toBe(result.matches[1].venueId)
  })

  it('B1: partidos con sourceId duplicado cuentan en duplicatesSkipped', () => {
    const result = materializeImport(
      [buildMatch({ sourceId: '7001' }), buildMatch({ sourceId: '7001' })],
      [],
      1,
    )
    expect(result.summary.duplicatesSkipped).toBe(1)
    expect(result.summary.matchesLoaded).toBe(1)
  })
})
