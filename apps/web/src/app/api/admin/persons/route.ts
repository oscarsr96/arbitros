import { NextResponse } from 'next/server'
import {
  mockPersons,
  mockDesignations,
  mockAvailabilities,
  getMockMunicipality,
} from '@/lib/mock-data'
import type { EnrichedPerson } from '@/lib/types'

export async function GET() {
  const personsWithAvail = new Set(mockAvailabilities.map((a) => a.personId))

  const enriched: EnrichedPerson[] = mockPersons.map((person) => {
    const municipality = getMockMunicipality(person.municipalityId)
    const personDesigs = mockDesignations.filter(
      (d) => d.personId === person.id && d.status !== 'rejected',
    )
    const confirmed = personDesigs.filter(
      (d) => d.status === 'confirmed' || d.status === 'completed',
    )
    const totalCost = personDesigs.reduce((sum, d) => sum + parseFloat(d.travelCost), 0)

    return {
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      role: person.role,
      category: person.category,
      address: person.address,
      postalCode: person.postalCode,
      municipalityId: person.municipalityId,
      active: person.active,
      municipality,
      matchesAssigned: personDesigs.length,
      matchesConfirmed: confirmed.length,
      totalCost: Number(totalCost.toFixed(2)),
      hasAvailability: personsWithAvail.has(person.id),
    }
  })

  return NextResponse.json({ persons: enriched })
}
