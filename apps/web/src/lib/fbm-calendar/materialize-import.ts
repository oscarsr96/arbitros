import { mockCompetitions, type MockMatch, type MockVenue } from '@/lib/mock-data'
import type { ParsedCsvMatch } from './parse-calendar-csv'
import { basesCategoryOf, mapCategory } from './category-mapping'
import { resolveMunicipality } from './resolve-municipality'
import {
  synthesizeSchedules,
  type SchedulableMatch,
  type SynthesisStats,
} from './synthesize-schedule'

// Convierte el resultado PURO de parseCalendarCsv en partidos/pabellones/
// competiciones mock listos para cargar. No muta ningún array global: la
// ruta que llama a esta función decide si aplica el resultado (dry-run o no).

const SEASON_ID = 'season-fbm-2025-26'

// Slug en mayúsculas, sin tildes ni puntuación, espacios/guiones colapsados a
// un único '-'. Usado para los ids fbm-venue-* y fbm-comp-*.
function slugUpper(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Una o más categorías del CSV no están en `category-mapping.ts`. Aborta el
 * import ENTERO: con ~24.500 partidos por temporada, descartar en silencio las
 * filas de una categoría desconocida perdería miles de partidos sin que nadie
 * se entere. Se acumulan TODAS las categorías fallidas antes de lanzar, para
 * que el operador vea la lista completa de una sola vez.
 */
export class UnmappedCategoryError extends Error {
  constructor(readonly categories: { category: string; matchCount: number }[]) {
    const detail = categories.map((c) => `"${c.category}" (${c.matchCount} partidos)`).join(', ')
    super(
      `Import abortado: ${categories.length} categoría(s) sin mapear en category-mapping.ts: ${detail}`,
    )
    this.name = 'UnmappedCategoryError'
  }
}

export type ImportSummary = {
  filesProcessed: number
  matchesParsed: number
  matchesLoaded: number
  duplicatesSkipped: number
  skippedNoDate: number
  /** Partidos que el CSV emitió con HORA=00:00; su hora se ha sintetizado. */
  timeTBD: number
  /** Métricas del reparto escalonado de horarios (ver synthesize-schedule.ts). */
  schedule: SynthesisStats
  venuesCreated: number
  competitions: {
    id: string
    name: string
    refereesNeeded: number
    scorersNeeded: number
    needsConfirmation: boolean
  }[]
  unresolvedMunicipalities: string[]
  warnings: string[]
}

export type MaterializedImport = {
  matches: MockMatch[]
  venues: MockVenue[]
  competitions: (typeof mockCompetitions)[number][]
  summary: ImportSummary
}

export function materializeImport(
  parsed: ParsedCsvMatch[],
  parseWarnings: string[],
  filesProcessed: number,
): MaterializedImport {
  const warnings = [...parseWarnings]

  // Dedup por sourceId: si el mismo partido aparece en varios ficheros, se
  // queda con la primera aparición.
  const seenSourceIds = new Set<string>()
  const deduped: ParsedCsvMatch[] = []
  let duplicatesSkipped = 0
  for (const p of parsed) {
    if (seenSourceIds.has(p.sourceId)) {
      duplicatesSkipped++
      continue
    }
    seenSourceIds.add(p.sourceId)
    deduped.push(p)
  }

  const venuesById = new Map<string, MockVenue>()
  const competitionsById = new Map<string, (typeof mockCompetitions)[number]>()
  const needsConfirmationById = new Map<string, boolean>()
  const unresolvedMunicipalities: string[] = []
  const seenUnresolved = new Set<string>()
  const matches: MockMatch[] = []
  const schedulable: SchedulableMatch[] = []

  let skippedNoDate = 0
  let timeTBD = 0
  const unmappedCategories = new Map<string, number>()

  for (const p of deduped) {
    if (p.date === null) {
      skippedNoDate++
      continue
    }

    const mapping = mapCategory(p.category)
    if (mapping === null) {
      // No se descarta la fila: se anota y al terminar el bucle se aborta el
      // import entero con la lista completa (ver UnmappedCategoryError).
      unmappedCategories.set(p.category, (unmappedCategories.get(p.category) ?? 0) + 1)
      continue
    }

    // Venue: dedup por CAMPO + POBLACIÓN (dos campos homónimos en municipios
    // distintos no deben fusionarse; con multi-fichero es un riesgo real).
    const venueId = `fbm-venue-${slugUpper(`${p.venueName} ${p.poblacion}`)}`
    let venue = venuesById.get(venueId)
    if (!venue) {
      const resolved = resolveMunicipality(p.poblacion)
      if (!resolved.matched && !seenUnresolved.has(resolved.municipalityName)) {
        seenUnresolved.add(resolved.municipalityName)
        unresolvedMunicipalities.push(resolved.municipalityName)
      }
      venue = {
        id: venueId,
        name: p.venueName,
        address: p.venueAddress,
        municipalityId: resolved.municipalityId ?? '',
        postalCode: '',
      }
      venuesById.set(venueId, venue)
    }

    // Competición: una por categoría canónica mapeada (varias variantes de
    // texto del CSV pueden mapear a la misma familia).
    const compId = `fbm-comp-${slugUpper(mapping.canonical)}`
    let comp = competitionsById.get(compId)
    if (!comp) {
      const gender: 'male' | 'female' = mapping.gender === 'femenino' ? 'female' : 'male'
      if (mapping.gender === null) {
        warnings.push(
          `género no determinado para categoría "${p.category}": se usa masculino por defecto`,
        )
      }
      // El tipo del array mockCompetitions se infiere como unión de las 10
      // formas concretas ya sembradas (cada `as const` de gender/minRefCategory
      // produce un miembro distinto), no como un tipo objeto único: con
      // gender/minRefCategory tipados como unión aquí, el objeto no encaja en
      // ningún miembro exacto sin este cast explícito.
      comp = {
        id: compId,
        name: mapping.canonical,
        category: slugUpper(p.category).toLowerCase(),
        gender,
        refereesNeeded: mapping.refereesNeeded,
        scorersNeeded: mapping.scorersNeeded,
        minRefCategory: mapping.minRefCategory as 'autonomico' | 'provincial',
        seasonId: SEASON_ID,
      } as (typeof mockCompetitions)[number]
      competitionsById.set(compId, comp)
      needsConfirmationById.set(compId, mapping.needsConfirmation)
    }

    if (p.time === null) timeTBD++

    const match: MockMatch = {
      id: `fbm-match-${p.sourceId}`,
      date: p.date,
      // Provisional: la hora definitiva (real o sintetizada) la fija la
      // segunda pasada de synthesizeSchedules, que necesita el pabellón-día
      // completo.
      time: p.time ?? '',
      venueId: venue.id,
      competitionId: comp.id,
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      refereesNeeded: comp.refereesNeeded,
      scorersNeeded: comp.scorersNeeded,
      status: 'scheduled',
      seasonId: SEASON_ID,
      matchday: p.matchday ?? 0,
      courtId: null,
      timeIsEstimated: p.time === null,
    }
    matches.push(match)
    schedulable.push({
      id: match.id,
      date: match.date,
      venueId: match.venueId,
      realTime: p.time,
      basesCategory: basesCategoryOf(p.category),
    })
  }

  if (unmappedCategories.size > 0) {
    throw new UnmappedCategoryError(
      Array.from(unmappedCategories, ([category, matchCount]) => ({ category, matchCount })).sort(
        (a, b) => b.matchCount - a.matchCount,
      ),
    )
  }

  // Horarios escalonados: segunda pasada, cuando ya está formado el grupo
  // completo de cada (pabellón, fecha). Las horas reales del CSV se preservan;
  // las que venían 00:00 se sintetizan dentro de la franja de su categoría.
  const { times, stats: schedule } = synthesizeSchedules(schedulable)
  for (const match of matches) {
    const assigned = times.get(match.id)
    if (assigned === undefined) continue
    match.time = assigned.time
    match.timeIsEstimated = assigned.timeIsEstimated
  }

  const venues = Array.from(venuesById.values())
  const competitions = Array.from(competitionsById.values())

  return {
    matches,
    venues,
    competitions,
    summary: {
      filesProcessed,
      matchesParsed: parsed.length,
      matchesLoaded: matches.length,
      duplicatesSkipped,
      skippedNoDate,
      timeTBD,
      schedule,
      venuesCreated: venues.length,
      competitions: competitions.map((c) => ({
        id: c.id,
        name: c.name,
        refereesNeeded: c.refereesNeeded,
        scorersNeeded: c.scorersNeeded,
        needsConfirmation: needsConfirmationById.get(c.id) ?? false,
      })),
      unresolvedMunicipalities,
      warnings,
    },
  }
}
