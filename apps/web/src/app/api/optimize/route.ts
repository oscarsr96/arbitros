import { NextResponse } from 'next/server'
import { solve } from '@/lib/solver'
import type {
  SolverParameters,
  EnrichedMatch,
  EnrichedPerson,
  Proposal,
  OptimizeRequestBody,
} from '@/lib/types'
import {
  mockMatches,
  mockPersons,
  mockDesignations,
  mockCompetitions,
  mockVenues,
  getMockMunicipality,
  getMockDesignationsForMatch,
} from '@/lib/mock-data'
import { validateDateRange, filterMatchesByRange } from '@/lib/optimize-range'
import { resolveFineCategory } from '@/lib/competition-fine-category'

export async function POST(request: Request) {
  try {
    const body: OptimizeRequestBody = await request.json()

    const rangeError = validateDateRange(body.dateFrom, body.dateTo)
    if (rangeError) {
      return NextResponse.json({ error: rangeError }, { status: 400 })
    }

    const partial = body.partial
    const numProposals = partial ? 1 : Math.min(5, Math.max(1, body.numProposals ?? 1))
    const parameters: SolverParameters = {
      costWeight: body.costWeight ?? 0.7,
      balanceWeight: body.balanceWeight ?? 0.3,
      maxMatchesPerPerson: body.maxMatchesPerPerson ?? 3,
      forceExisting: partial ? true : (body.forceExisting ?? true),
      numProposals,
    }

    // Partidos a considerar: `partial` acota a UN único partido (ignora dateFrom/dateTo);
    // si no, se filtra por el rango de fechas activo (sin rango = temporada completa).
    const scopedMatches = partial
      ? mockMatches.filter((m) => m.id === partial.matchId)
      : filterMatchesByRange(mockMatches, body.dateFrom, body.dateTo)

    // Enrich matches
    const matches: EnrichedMatch[] = scopedMatches.map((m) => {
      const venue = mockVenues.find((v) => v.id === m.venueId)
      const competition = mockCompetitions.find((c) => c.id === m.competitionId)
      const designations = getMockDesignationsForMatch(m.id)
      const refereesAssigned = designations.filter((d) => d.role === 'arbitro').length
      const scorersAssigned = designations.filter((d) => d.role === 'anotador').length

      return {
        ...m,
        // MockVenue ya trae lat/lon reales (venue-coords.json); se pasan tal
        // cual para la distancia persona→pabellón del solver.
        venue,
        competition: competition
          ? { ...competition, fineCategory: resolveFineCategory(competition) }
          : undefined,
        designations,
        refereesAssigned,
        scorersAssigned,
        isCovered: refereesAssigned >= m.refereesNeeded && scorersAssigned >= m.scorersNeeded,
      }
    })

    // Enrich persons
    const persons: EnrichedPerson[] = mockPersons
      .filter((p) => p.active)
      .map((p) => {
        const municipality = getMockMunicipality(p.municipalityId)
        const personDesigs = mockDesignations.filter((d) => d.personId === p.id)
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          role: p.role,
          category: p.category,
          refereeLevel: p.refereeLevel ?? null,
          address: p.address,
          postalCode: p.postalCode,
          municipalityId: p.municipalityId,
          latitude: p.latitude,
          longitude: p.longitude,
          active: p.active,
          hasCar: p.hasCar,
          municipality,
          matchesAssigned: personDesigs.length,
          totalCost: personDesigs.reduce((sum, d) => sum + parseFloat(d.travelCost), 0),
          hasAvailability: true,
        }
      })

    // Acotar por categorías de competición seleccionadas (solo en modo global;
    // `partial` ya está acotado a un único partido). Vacío/ausente = todas.
    const categories = body.categories
    const scopedByCategory =
      !partial && categories && categories.length > 0
        ? matches.filter(
            (m) => m.competition?.category && categories.includes(m.competition.category),
          )
        : matches

    const input = { matches: scopedByCategory, persons, parameters }

    // Generar N propuestas con seeds distintas
    const proposals: Proposal[] = []
    for (let i = 0; i < numProposals; i++) {
      const seed = numProposals === 1 ? undefined : i
      const result = solve(input, seed)
      // En modo partial, acotar la respuesta a las asignaciones/huecos de ESE
      // matchId+role (el solve puede haber intentado cubrir otros slots del mismo
      // partido, p. ej. asignaciones existentes marcadas por forceExisting).
      const assignments = partial
        ? result.assignments.filter(
            // `a.isNew`: en partial con forceExisting=true el solver incluye las
            // designaciones YA existentes del partido; sin este filtro el cliente
            // tomaría assignments[0] (una persona ya designada) y crearía un duplicado.
            (a) => a.matchId === partial.matchId && a.role === partial.role && a.isNew,
          )
        : result.assignments
      const unassigned = partial
        ? result.unassigned.filter((u) => u.matchId === partial.matchId && u.role === partial.role)
        : result.unassigned
      proposals.push({
        id: crypto.randomUUID(),
        label: `Propuesta ${i + 1}`,
        status: result.status,
        assignments,
        metrics: result.metrics,
        unassigned,
        forceExisting: parameters.forceExisting,
      })
    }

    return NextResponse.json({ proposals })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
