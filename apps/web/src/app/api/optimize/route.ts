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
  enrichMatchDesignations,
} from '@/lib/mock-data'
import { validateDateRange, filterMatchesByRange } from '@/lib/optimize-range'
import { resolveDefaultJornada } from '@/lib/match-query'
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

    // Partidos a considerar: `partial` acota a UN único partido (ignora dateFrom/dateTo).
    // Sin rango explícito NO se resuelve la temporada entera: la FBM designa jornada a
    // jornada, así que se deriva la ventana viernes→jueves por defecto. Solo afecta a
    // llamadas API directas: la UI de Asignación siempre envía rango.
    let appliedRange: { from: string | null; to: string | null; defaulted: boolean } | null = null
    let scopedMatches
    if (partial) {
      scopedMatches = mockMatches.filter((m) => m.id === partial.matchId)
    } else {
      let from = body.dateFrom
      let to = body.dateTo
      let defaulted = false
      if (!from && !to) {
        const todayISO = new Date().toISOString().slice(0, 10)
        const jornada = resolveDefaultJornada(mockMatches, todayISO)
        if (!jornada) {
          return NextResponse.json(
            {
              error:
                'No hay partidos cargados: no se puede derivar la jornada por defecto. Envía dateFrom y dateTo.',
            },
            { status: 400 },
          )
        }
        from = jornada.from
        to = jornada.to
        defaulted = true
      }
      scopedMatches = filterMatchesByRange(mockMatches, from, to)
      appliedRange = { from: from ?? null, to: to ?? null, defaulted }
    }

    // Índices por request: sin ellos el enriquecido es cuadrático (partidos ×
    // designaciones, personas × designaciones) sobre el calendario real.
    const venuesById = new Map(mockVenues.map((v) => [v.id, v]))
    const competitionsById = new Map(mockCompetitions.map((c) => [c.id, c]))
    const designationsByMatch = new Map<string, (typeof mockDesignations)[number][]>()
    const designationsByPerson = new Map<string, (typeof mockDesignations)[number][]>()
    for (const d of mockDesignations) {
      const byMatch = designationsByMatch.get(d.matchId)
      if (byMatch) byMatch.push(d)
      else designationsByMatch.set(d.matchId, [d])
      const byPerson = designationsByPerson.get(d.personId)
      if (byPerson) byPerson.push(d)
      else designationsByPerson.set(d.personId, [d])
    }

    // Enrich matches
    const matches: EnrichedMatch[] = scopedMatches.map((m) => {
      const venue = venuesById.get(m.venueId)
      const competition = competitionsById.get(m.competitionId)
      const designations = enrichMatchDesignations(m, designationsByMatch.get(m.id) ?? [])
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
        const personDesigs = designationsByPerson.get(p.id) ?? []
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

    return NextResponse.json({ proposals, appliedRange })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
