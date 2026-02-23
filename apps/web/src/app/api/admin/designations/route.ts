import { NextResponse } from 'next/server'
import {
  mockDesignations,
  getMockPerson,
  getMockMunicipality,
  getMockMatch,
  getMockVenue,
  calculateMockTravelCost,
} from '@/lib/mock-data'

export async function GET() {
  const enriched = mockDesignations.map((d) => {
    const person = getMockPerson(d.personId)
    const match = getMockMatch(d.matchId)
    const venue = match ? getMockVenue(match.venueId) : undefined
    const municipality = person ? getMockMunicipality(person.municipalityId) : undefined
    return { ...d, person, match, venue, municipality }
  })

  return NextResponse.json({ designations: enriched })
}

export async function POST(request: Request) {
  const { matchId, personId, role } = await request.json()

  if (!matchId || !personId || !role) {
    return NextResponse.json({ error: 'matchId, personId y role son requeridos' }, { status: 400 })
  }

  const person = getMockPerson(personId)
  const match = getMockMatch(matchId)

  if (!person || !match) {
    return NextResponse.json({ error: 'Persona o partido no encontrado' }, { status: 404 })
  }

  const venue = getMockVenue(match.venueId)
  const { cost, km } = calculateMockTravelCost(person.municipalityId, venue?.municipalityId ?? '')

  const newDesig = {
    id: `desig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    matchId,
    personId,
    role: role as 'arbitro' | 'anotador',
    travelCost: cost.toFixed(2),
    distanceKm: km.toFixed(1),
    status: 'pending' as const,
    notifiedAt: null,
    createdAt: new Date(),
  }

  mockDesignations.push(newDesig)

  return NextResponse.json({ designation: newDesig }, { status: 201 })
}
