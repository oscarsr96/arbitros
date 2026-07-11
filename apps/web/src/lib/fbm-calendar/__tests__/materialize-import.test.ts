import { describe, it, expect } from 'vitest'
import { materializeImport } from '../materialize-import'
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
    expect(result.summary.skippedUnmappedCategory).toBe(0)
    expect(result.summary.timeTBD).toBe(0)
    expect(result.summary.venuesCreated).toBe(1)
  })

  it('categoría no mapeada: no carga el partido y cuenta skippedUnmappedCategory', () => {
    const result = materializeImport(
      [buildMatch({ sourceId: '1002', category: 'Categoría Inventada' })],
      [],
      1,
    )

    expect(result.matches).toHaveLength(0)
    expect(result.summary.skippedUnmappedCategory).toBe(1)
    expect(result.summary.matchesLoaded).toBe(0)
    expect(result.summary.warnings.some((w) => w.includes('Categoría Inventada'))).toBe(true)
  })

  it('date null: no carga el partido y cuenta skippedNoDate', () => {
    const result = materializeImport([buildMatch({ sourceId: '1003', date: null })], [], 1)

    expect(result.matches).toHaveLength(0)
    expect(result.summary.skippedNoDate).toBe(1)
    expect(result.summary.matchesLoaded).toBe(0)
  })

  it('time null: carga el partido con time "" y cuenta timeTBD', () => {
    const result = materializeImport([buildMatch({ sourceId: '1004', time: null })], [], 1)

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].time).toBe('')
    expect(result.summary.timeTBD).toBe(1)
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
