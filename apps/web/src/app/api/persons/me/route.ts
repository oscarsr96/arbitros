import { NextRequest, NextResponse } from 'next/server'
import {
  mockPersons,
  getMockDesignationsForPerson,
  getMockMunicipality,
  getPersonTravelCost,
  DEMO_PERSON_ID,
} from '@/lib/mock-data'
import { sumDesignationFees, type DesignationFeeEntry } from '@/lib/designation-fees'

export async function GET() {
  const person = mockPersons.find((p) => p.id === DEMO_PERSON_ID)
  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const municipality = person.municipalityId ? getMockMunicipality(person.municipalityId) : null

  const designations = getMockDesignationsForPerson(person.id)
  const completedDesignations = designations.filter((d) => d.status === 'completed')
  // Total cobrado = coste real por día (regla FBM), no la suma por partido.
  const totalEarned = getPersonTravelCost(person.id, completedDesignations).totalCost

  // ── Historial de temporada (4.4.1) ──
  // A diferencia de `stats.totalEarned` arriba (solo designaciones jugadas),
  // el historial cubre TODAS las designaciones de la persona esta temporada
  // (jugadas y pendientes): lo que la FBM ya le ha asignado y le corresponde
  // cobrar. Acotado por construcción: `getMockDesignationsForPerson` ya
  // filtra por esta persona (decenas de designaciones, nunca la temporada
  // global). `travelCost` reutiliza `getPersonTravelCost` (misma fuente de
  // la verdad que dashboard/portal/reportes, invariante cubierta por test);
  // `fees` es un concepto separado (honorarios por categoría de partido y
  // posición, ver designation-fees.ts), nunca mezclado con el kilometraje.
  const { totalCost: travelCost, totalKm, byDay } = getPersonTravelCost(person.id, designations)
  const feeEntries: DesignationFeeEntry[] = designations.map((d) => ({
    designation: { role: d.role, position: d.position },
    competition: d.competition ?? null,
  }))
  const { totalFees, unresolved: unresolvedFees } = sumDesignationFees(feeEntries)

  const designationHistory = designations
    .map((d) => ({
      id: d.id,
      matchId: d.matchId,
      date: d.match?.date ?? '',
      time: d.match?.time ?? '',
      homeTeam: d.match?.homeTeam ?? '',
      awayTeam: d.match?.awayTeam ?? '',
      venue: d.venue?.name ?? '',
      municipality: d.venue ? (getMockMunicipality(d.venue.municipalityId)?.name ?? '') : '',
      status: d.status,
    }))
    // Más reciente primero: es un historial/actividad, no una agenda.
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))

  return NextResponse.json({
    person: { ...person, municipalityName: municipality?.name ?? null },
    stats: {
      totalMatches: designations.length,
      completedMatches: completedDesignations.length,
      totalEarned: totalEarned.toFixed(2),
    },
    history: {
      designations: designationHistory,
      byDay,
      travelCost,
      totalKm,
      fees: totalFees,
      total: Number((travelCost + totalFees).toFixed(2)),
      unresolvedFees,
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
