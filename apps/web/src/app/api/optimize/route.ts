import { NextResponse } from 'next/server'
import { solve } from '@/lib/solver'
import type { SolverParameters, EnrichedMatch, EnrichedPerson, Proposal } from '@/lib/types'
import {
  mockMatches,
  mockPersons,
  mockDesignations,
  mockCompetitions,
  mockVenues,
  getMockMunicipality,
  getMockDesignationsForMatch,
} from '@/lib/mock-data'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const numProposals = Math.min(5, Math.max(1, body.numProposals ?? 1))
    const parameters: SolverParameters = {
      costWeight: body.costWeight ?? 0.7,
      balanceWeight: body.balanceWeight ?? 0.3,
      maxMatchesPerPerson: body.maxMatchesPerPerson ?? 3,
      forceExisting: body.forceExisting ?? true,
      numProposals,
    }

    // Enrich matches
    const matches: EnrichedMatch[] = mockMatches.map((m) => {
      const venue = mockVenues.find((v) => v.id === m.venueId)
      const competition = mockCompetitions.find((c) => c.id === m.competitionId)
      const designations = getMockDesignationsForMatch(m.id)
      const activeDesigs = designations.filter((d) => d.status !== 'rejected')
      const refereesAssigned = activeDesigs.filter((d) => d.role === 'arbitro').length
      const scorersAssigned = activeDesigs.filter((d) => d.role === 'anotador').length

      return {
        ...m,
        venue: venue ? { ...venue, latitude: 0, longitude: 0 } : undefined,
        competition: competition ?? undefined,
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
        const personDesigs = mockDesignations.filter(
          (d) => d.personId === p.id && d.status !== 'rejected',
        )
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          role: p.role,
          category: p.category,
          address: p.address,
          postalCode: p.postalCode,
          municipalityId: p.municipalityId,
          active: p.active,
          municipality,
          matchesAssigned: personDesigs.length,
          matchesConfirmed: personDesigs.filter((d) => d.status === 'confirmed').length,
          totalCost: personDesigs.reduce((sum, d) => sum + parseFloat(d.travelCost), 0),
          hasAvailability: true,
        }
      })

    const input = { matches, persons, parameters }

    // Generar N propuestas con seeds distintas
    const proposals: Proposal[] = []
    for (let i = 0; i < numProposals; i++) {
      const seed = numProposals === 1 ? undefined : i
      const result = solve(input, seed)
      proposals.push({
        id: crypto.randomUUID(),
        label: `Propuesta ${i + 1}`,
        status: result.status,
        assignments: result.assignments,
        metrics: result.metrics,
        unassigned: result.unassigned,
      })
    }

    return NextResponse.json({ proposals })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
