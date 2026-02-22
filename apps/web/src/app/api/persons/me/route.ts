import { NextRequest, NextResponse } from 'next/server'
import {
  mockPersons,
  getMockDesignationsForPerson,
  getMockMunicipality,
  DEMO_PERSON_ID,
} from '@/lib/mock-data'

export async function GET() {
  const person = mockPersons.find((p) => p.id === DEMO_PERSON_ID)
  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const municipality = person.municipalityId ? getMockMunicipality(person.municipalityId) : null

  const designations = getMockDesignationsForPerson(person.id)
  const completedDesignations = designations.filter(
    (d) => d.status === 'confirmed' || (d.status as string) === 'completed',
  )
  const totalEarned = completedDesignations.reduce((sum, d) => sum + parseFloat(d.travelCost), 0)

  return NextResponse.json({
    person: { ...person, municipalityName: municipality?.name ?? null },
    stats: {
      totalMatches: designations.length,
      confirmedMatches: completedDesignations.length,
      totalEarned: totalEarned.toFixed(2),
    },
  })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { phone, address } = body as { phone?: string; address?: string }

  const person = mockPersons.find((p) => p.id === DEMO_PERSON_ID)
  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  // Actualizar campos editables en memoria
  if (phone !== undefined) person.phone = phone
  if (address !== undefined) person.address = address

  return NextResponse.json({ person })
}
