import { NextRequest, NextResponse } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  getMockVenue,
  getMockCompetition,
  enrichMatchDesignations,
  type MockDesignation,
} from '@/lib/mock-data'
import {
  parseMatchRange,
  filterMatchesByRange,
  getMatchesDateRange,
  listJornadas,
} from '@/lib/match-query'
import type { EnrichedMatch } from '@/lib/types'

// GET /api/admin/matches
//   ?jornada=YYYY-MM-DD  → solo la jornada FBM de ese sábado (viernes→jueves)
//   ?from=&to=           → rango explícito (cualquiera de los dos opcional)
//   ?meta=1              → rango de fechas, total e índice de jornadas, sin partidos
//   ?shape=list          → forma ligera para vistas de tabla (ver abajo)
//   sin parámetros       → todos los partidos, forma completa (compatibilidad)
//
// Con el calendario real (~24.500 partidos) devolver todo son ~21 MB: los
// consumidores nuevos deben pedir siempre una jornada. `meta=1` existe para que
// la UI averigüe qué jornada pedir sin descargarse el calendario entero primero.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const range = getMatchesDateRange(mockMatches)

  if (searchParams.get('meta')) {
    return NextResponse.json({
      total: mockMatches.length,
      range,
      jornadas: listJornadas(mockMatches),
    })
  }

  const selected = filterMatchesByRange(mockMatches, parseMatchRange(searchParams))

  // Índice de designaciones por partido, construido UNA vez por request.
  //
  // Resolverlas con `getMockDesignationsForMatch` por partido era
  // O(partidos × designaciones): esa función filtra `mockDesignations` entero en
  // cada llamada. Con la temporada designada (24.508 partidos × 5 slots ≈ 122.500
  // designaciones) una jornada de 1.309 partidos daban ~160 M de comparaciones por
  // request, bloqueando el event loop. Y `mockDesignations` CRECE conforme se
  // publican jornadas, así que degradaba con el uso. Con el índice es
  // O(partidos + designaciones).
  const designationsByMatch = new Map<string, MockDesignation[]>()
  for (const d of mockDesignations) {
    const list = designationsByMatch.get(d.matchId)
    if (list) list.push(d)
    else designationsByMatch.set(d.matchId, [d])
  }
  const NO_DESIGNATIONS: MockDesignation[] = []

  // ── Forma ligera para vistas de tabla ────────────────────────────────────
  //
  // Dos diferencias con la forma completa, ambas por tamaño (medido sobre la
  // jornada pico de 1.309 partidos):
  //
  // 1. SIN designaciones. Cada designación enriquecida pesa ~606 B (lleva
  //    incrustados `person` y `municipality`) y hay 5 slots por partido, así que
  //    una jornada DESIGNADA serían 4,34 MB. La tabla no las necesita: la
  //    cobertura se pinta con los escalares de abajo. Se cargan al desplegar una
  //    fila, vía /api/admin/matches/[id].
  // 2. `venue` y `competition` DEDUPLICADOS en diccionarios en vez de repetidos
  //    en cada partido (409 B/partido → ~35 KB totales). El cliente los rehidrata,
  //    así que `EnrichedMatch` no cambia de forma para el render.
  //
  // Resultado: ~610 KB en el peor caso, esté la jornada designada o no.
  if (searchParams.get('shape') === 'list') {
    const venues: Record<string, NonNullable<EnrichedMatch['venue']> | undefined> = {}
    const competitions: Record<string, NonNullable<EnrichedMatch['competition']> | undefined> = {}

    const matches = selected.map((match) => {
      if (!(match.venueId in venues)) venues[match.venueId] = getMockVenue(match.venueId)
      if (!(match.competitionId in competitions)) {
        competitions[match.competitionId] = getMockCompetition(match.competitionId)
      }

      // Solo hacen falta los contadores: la lista no lleva designaciones, así que
      // aquí ni siquiera se enriquecen.
      const designations = designationsByMatch.get(match.id) ?? NO_DESIGNATIONS
      const refereesAssigned = designations.filter((d) => d.role === 'arbitro').length
      const scorersAssigned = designations.filter((d) => d.role === 'anotador').length

      return {
        ...match,
        refereesAssigned,
        scorersAssigned,
        isCovered:
          refereesAssigned >= match.refereesNeeded && scorersAssigned >= match.scorersNeeded,
      }
    })

    return NextResponse.json({ matches, venues, competitions, total: mockMatches.length, range })
  }

  const enriched: EnrichedMatch[] = selected.map((match) => {
    const venue = getMockVenue(match.venueId)
    const competition = getMockCompetition(match.competitionId)
    // Mismo índice: `match` ya está resuelto aquí, así que además se ahorra el
    // `getMockMatch` (otro escaneo lineal) que hace `getMockDesignationsForMatch`.
    const designations = enrichMatchDesignations(
      match,
      designationsByMatch.get(match.id) ?? NO_DESIGNATIONS,
    )
    const refereesAssigned = designations.filter((d) => d.role === 'arbitro').length
    const scorersAssigned = designations.filter((d) => d.role === 'anotador').length

    return {
      ...match,
      venue,
      competition,
      designations,
      refereesAssigned,
      scorersAssigned,
      isCovered: refereesAssigned >= match.refereesNeeded && scorersAssigned >= match.scorersNeeded,
    }
  })

  return NextResponse.json({ matches: enriched, total: mockMatches.length, range })
}
