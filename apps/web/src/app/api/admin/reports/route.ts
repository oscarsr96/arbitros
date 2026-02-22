import { NextResponse } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  getMockPerson,
  getMockMatch,
  getMockVenue,
  getMockMunicipality,
  getMockDesignationsForMatch,
} from '@/lib/mock-data'

export async function GET() {
  // Cost per matchday
  const totalCost = mockDesignations
    .filter((d) => d.status !== 'rejected')
    .reduce((sum, d) => sum + parseFloat(d.travelCost), 0)

  // Load per person (referees)
  const loadByPerson = mockPersons.map((person) => {
    const desigs = mockDesignations.filter(
      (d) => d.personId === person.id && d.status !== 'rejected',
    )
    const cost = desigs.reduce((sum, d) => sum + parseFloat(d.travelCost), 0)
    return {
      personId: person.id,
      name: person.name,
      role: person.role,
      matchesAssigned: desigs.length,
      totalCost: Number(cost.toFixed(2)),
    }
  })

  // Coverage
  let covered = 0
  let partial = 0
  let uncovered = 0
  for (const match of mockMatches) {
    const desigs = getMockDesignationsForMatch(match.id)
    const active = desigs.filter((d) => d.status !== 'rejected')
    const refs = active.filter((d) => d.role === 'arbitro').length
    const scorers = active.filter((d) => d.role === 'anotador').length
    if (refs >= match.refereesNeeded && scorers >= match.scorersNeeded) covered++
    else if (refs > 0 || scorers > 0) partial++
    else uncovered++
  }

  // Liquidation data (per person)
  const liquidation = mockPersons
    .map((person) => {
      const municipality = getMockMunicipality(person.municipalityId)
      const desigs = mockDesignations.filter(
        (d) => d.personId === person.id && d.status !== 'rejected',
      )
      const matches = desigs.map((d) => {
        const match = getMockMatch(d.matchId)
        const venue = match ? getMockVenue(match.venueId) : undefined
        return {
          matchId: d.matchId,
          date: match?.date ?? '',
          time: match?.time ?? '',
          homeTeam: match?.homeTeam ?? '',
          awayTeam: match?.awayTeam ?? '',
          venue: venue?.name ?? '',
          travelCost: parseFloat(d.travelCost),
          distanceKm: parseFloat(d.distanceKm),
        }
      })
      const total = matches.reduce((sum, m) => sum + m.travelCost, 0)

      return {
        personId: person.id,
        name: person.name,
        role: person.role,
        municipality: municipality?.name ?? '',
        bankIban: person.bankIban,
        matches,
        totalCost: Number(total.toFixed(2)),
      }
    })
    .filter((p) => p.matches.length > 0)

  return NextResponse.json({
    summary: {
      totalCost: Number(totalCost.toFixed(2)),
      totalMatches: mockMatches.length,
      covered,
      partial,
      uncovered,
      matchday: 15,
    },
    loadByPerson,
    liquidation,
  })
}
