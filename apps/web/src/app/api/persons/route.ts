import { NextResponse } from 'next/server'
import { mockPersons } from '@/lib/mock-data'

export async function GET() {
  return NextResponse.json({ persons: mockPersons })
}

export async function POST() {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 })
}
