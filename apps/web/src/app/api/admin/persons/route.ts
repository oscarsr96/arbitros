import { NextResponse } from 'next/server'
import {
  mockPersons,
  mockDesignations,
  mockAvailabilities,
  getMockMunicipality,
  getPersonTravelCost,
} from '@/lib/mock-data'
import type { EnrichedPerson } from '@/lib/types'

export async function GET() {
  const personsWithAvail = new Set(mockAvailabilities.map((a) => a.personId))

  const enriched: EnrichedPerson[] = mockPersons.map((person) => {
    const municipality = getMockMunicipality(person.municipalityId)
    const personDesigs = mockDesignations.filter((d) => d.personId === person.id)
    // Coste real por persona y día (regla FBM), no la suma de costes por partido.
    const totalCost = getPersonTravelCost(
      person.id,
      personDesigs.map((d) => ({ matchId: d.matchId })),
    ).totalCost

    return {
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      role: person.role,
      category: person.category,
      refereeLevel: person.refereeLevel ?? null,
      nick: person.nick ?? null,
      address: person.address,
      postalCode: person.postalCode,
      municipalityId: person.municipalityId,
      active: person.active,
      hasCar: person.hasCar,
      municipality,
      matchesAssigned: personDesigs.length,
      totalCost: Number(totalCost.toFixed(2)),
      hasAvailability: personsWithAvail.has(person.id),
    }
  })

  return NextResponse.json({ persons: enriched })
}
