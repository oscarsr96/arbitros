import { NextResponse } from 'next/server'
import {
  mockDesignations,
  getMockPerson,
  getMockMunicipality,
  getMockMatch,
  getMockVenue,
  calculateMockTravelCost,
} from '@/lib/mock-data'
import { checkDesignationConflict } from '@/lib/designation-validation'

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

  // Evitar duplicados (misma persona dos veces en el partido) y sobre-cobertura
  // (más de los que el partido necesita). Protege todos los flujos que crean
  // designaciones (manual, sustitución, re-optimizar, aplicar propuesta).
  const conflict = checkDesignationConflict(mockDesignations, match, personId, role)
  if (!conflict.ok) {
    return NextResponse.json({ error: conflict.reason }, { status: 409 })
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
