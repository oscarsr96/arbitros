import { NextRequest, NextResponse } from 'next/server'
import {
  getMockDesignationsForPerson,
  getMockPerson,
  getPersonTravelCost,
  DEMO_PERSON_ID,
} from '@/lib/mock-data'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const personId = searchParams.get('personId') ?? DEMO_PERSON_ID

  const designations = getMockDesignationsForPerson(personId)
  const person = getMockPerson(personId)

  // El coste real es por persona y día (regla FBM) y necesita el calendario
  // completo para resolver fecha y municipio de cada partido: se calcula en
  // servidor para que el portal no tenga que importar mock-data (seed ~10 MB).
  const totalTravelCost = getPersonTravelCost(personId, designations).totalCost

  return NextResponse.json({
    designations,
    totalTravelCost,
    person: person ? { address: person.address, hasCar: person.hasCar } : null,
  })
}

export async function POST() {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 })
}
