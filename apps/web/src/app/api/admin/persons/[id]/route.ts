import { NextResponse } from 'next/server'
import {
  getMockPerson,
  getMockMunicipality,
  getMockDesignationsForPerson,
  getMockAvailabilitiesForPerson,
  getPersonIncompatibilities,
} from '@/lib/mock-data'

function getCurrentWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const person = getMockPerson(params.id)
  if (!person) {
    return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
  }

  const municipality = getMockMunicipality(person.municipalityId)
  const designations = getMockDesignationsForPerson(person.id)
  const weekStart = getCurrentWeekStart()
  const availability = getMockAvailabilitiesForPerson(person.id, weekStart)
  const incompatibilities = getPersonIncompatibilities(person.id)

  return NextResponse.json({
    person: { ...person, municipality },
    designations,
    availability,
    incompatibilities,
  })
}
