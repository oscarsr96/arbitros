import { NextRequest, NextResponse } from 'next/server'
import {
  mockAvailabilities,
  mockMatchdayAvailabilities,
  mockPersons,
  DEMO_PERSON_ID,
} from '@/lib/mock-data'
import type { MatchdayAvailability } from '@/lib/mock-data'
import { getAvailabilityDeadline } from '@/lib/availability-deadline'
import { materializeToSlots, getMatchdaySlotFootprint } from '@/lib/matchday-availability'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const personId = searchParams.get('personId') ?? DEMO_PERSON_ID
  const saturdayDate = searchParams.get('saturdayDate')

  if (!saturdayDate) {
    return NextResponse.json({ error: 'Falta el parametro saturdayDate' }, { status: 400 })
  }

  const record = mockMatchdayAvailabilities.find(
    (r) => r.personId === personId && r.saturdayDate === saturdayDate,
  )

  return NextResponse.json({ matchdayAvailability: record ?? null })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    personId,
    saturdayDate,
    saturdayMorning,
    saturdayAfternoon,
    sundayMorning,
    sundayAfternoon,
    weekdayDays,
    notes,
  } = body as {
    personId?: string
    saturdayDate?: string
    saturdayMorning?: boolean
    saturdayAfternoon?: boolean
    sundayMorning?: boolean
    sundayAfternoon?: boolean
    weekdayDays?: number[]
    notes?: string | null
  }

  if (!personId || !saturdayDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (weekdayDays !== undefined && !Array.isArray(weekdayDays)) {
    return NextResponse.json({ error: 'weekdayDays debe ser un array' }, { status: 400 })
  }

  if (weekdayDays && weekdayDays.some((w) => !Number.isInteger(w) || w < 0 || w > 4)) {
    return NextResponse.json(
      { error: 'weekdayDays debe contener valores enteros entre 0 (lunes) y 4 (viernes)' },
      { status: 400 },
    )
  }

  const person = mockPersons.find((p) => p.id === personId)
  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const deadline = getAvailabilityDeadline(person.category, saturdayDate)
  if (new Date() > deadline) {
    return NextResponse.json(
      {
        error: `El plazo para declarar disponibilidad de la jornada del ${saturdayDate} finalizo el ${deadline.toLocaleDateString('es-ES')}.`,
      },
      { status: 403 },
    )
  }

  const existingIndex = mockMatchdayAvailabilities.findIndex(
    (r) => r.personId === personId && r.saturdayDate === saturdayDate,
  )

  const record: MatchdayAvailability = {
    id:
      existingIndex >= 0
        ? mockMatchdayAvailabilities[existingIndex].id
        : `matchday-avail-gen-${Date.now()}`,
    personId,
    saturdayDate,
    saturdayMorning: !!saturdayMorning,
    saturdayAfternoon: !!saturdayAfternoon,
    sundayMorning: !!sundayMorning,
    sundayAfternoon: !!sundayAfternoon,
    weekdayDays: weekdayDays ?? [],
    notes: notes ?? null,
    updatedAt: new Date().toISOString(),
  }

  // Upsert por personId + saturdayDate
  if (existingIndex >= 0) {
    mockMatchdayAvailabilities[existingIndex] = record
  } else {
    mockMatchdayAvailabilities.push(record)
  }

  // Re-materializar: elimina los slots existentes de esta persona que caen en la
  // huella exacta de esta jornada (fin de semana + bloque entre semana) y escribe
  // los derivados del registro actualizado. Filtrar por (weekStart, dayOfWeek) en
  // lugar de por weekStart entero evita borrar los dias 0-3 de la jornada anterior
  // que comparte semana ISO con el fin de semana de esta jornada.
  const footprint = getMatchdaySlotFootprint(saturdayDate)
  const isInFootprint = (weekStart: string, dayOfWeek: number) =>
    footprint.some((k) => k.weekStart === weekStart && k.dayOfWeek === dayOfWeek)
  const remaining = mockAvailabilities.filter(
    (a) => !(a.personId === personId && isInFootprint(a.weekStart, a.dayOfWeek)),
  )
  mockAvailabilities.length = 0
  mockAvailabilities.push(...remaining)

  const newSlots = materializeToSlots(record)
  mockAvailabilities.push(
    ...newSlots.map((slot, i) => ({
      id: `avail-matchday-${Date.now()}-${i}`,
      ...slot,
    })),
  )

  return NextResponse.json({ matchdayAvailability: record, slotsGenerated: newSlots.length })
}
