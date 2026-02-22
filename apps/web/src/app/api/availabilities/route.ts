import { NextRequest, NextResponse } from 'next/server'
import { mockAvailabilities, DEMO_PERSON_ID } from '@/lib/mock-data'

// Almacén en memoria para desarrollo sin DB
const memoryStore = new Map<string, typeof mockAvailabilities>()

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const personId = searchParams.get('personId') ?? DEMO_PERSON_ID
  const weekStart = searchParams.get('weekStart')

  if (!weekStart) {
    return NextResponse.json({ availabilities: [] })
  }

  const key = `${personId}:${weekStart}`
  const stored = memoryStore.get(key)
  if (stored) {
    return NextResponse.json({ availabilities: stored })
  }

  // Fallback a mock data
  const filtered = mockAvailabilities.filter(
    (a) => a.personId === personId && a.weekStart === weekStart,
  )
  return NextResponse.json({ availabilities: filtered })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { personId, weekStart, slots } = body as {
    personId: string
    weekStart: string
    slots: { dayOfWeek: number; startTime: string; endTime: string }[]
  }

  if (!personId || !weekStart || !slots) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Guardar en memoria (reemplaza la semana completa)
  const key = `${personId}:${weekStart}`
  const entries = slots.map((slot, i) => ({
    id: `avail-gen-${Date.now()}-${i}`,
    personId,
    weekStart,
    ...slot,
  }))

  memoryStore.set(key, entries)

  return NextResponse.json({ availabilities: entries, saved: entries.length })
}
