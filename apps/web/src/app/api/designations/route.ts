import { NextRequest, NextResponse } from 'next/server'
import { getMockDesignationsForPerson, DEMO_PERSON_ID } from '@/lib/mock-data'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const personId = searchParams.get('personId') ?? DEMO_PERSON_ID

  const designations = getMockDesignationsForPerson(personId)

  return NextResponse.json({ designations })
}

export async function POST() {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 })
}
