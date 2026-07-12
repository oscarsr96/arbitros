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
import { persistDesignations } from '@/lib/designation-persistence'

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

// Crea una designación e la inserta en `mockDesignations`, o devuelve el motivo
// del conflicto (duplicado / sobre-cobertura) sin insertar. Valida contra el
// array VIVO, así que en un lote ve las que se han insertado antes en el mismo
// bucle → sin duplicados ni sobre-cobertura dentro de la propia propuesta.
function createDesignation(matchId: string, personId: string, role: 'arbitro' | 'anotador') {
  if (!matchId || !personId || !role) {
    return { ok: false as const, reason: 'matchId, personId y role son requeridos' }
  }
  const person = getMockPerson(personId)
  const match = getMockMatch(matchId)
  if (!person || !match) {
    return { ok: false as const, reason: 'Persona o partido no encontrado' }
  }
  const conflict = checkDesignationConflict(mockDesignations, match, personId, role)
  if (!conflict.ok) {
    return { ok: false as const, reason: conflict.reason ?? 'Conflicto' }
  }
  const venue = getMockVenue(match.venueId)
  const { cost, km } = calculateMockTravelCost(person.municipalityId, venue?.municipalityId ?? '')
  const designation = {
    id: `desig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    matchId,
    personId,
    role,
    travelCost: cost.toFixed(2),
    distanceKm: km.toFixed(1),
    status: 'pending' as const,
    notifiedAt: null,
    createdAt: new Date(),
  }
  mockDesignations.push(designation)
  return { ok: true as const, designation }
}

// POST acepta dos formas contra la MISMA ruta (que ya comparte el módulo mock con
// el lector `/api/admin/matches`; una ruta nueva y "fría" en Next dev tendría su
// propio `mockDesignations` aislado y las inserciones no se verían):
//   - { matchId, personId, role }         → una designación (manual, sustitución, re-optimizar).
//   - { assignments: [{matchId,personId,role}, ...] } → lote (aplicar una propuesta en UNA llamada).
export async function POST(request: Request) {
  const body = await request.json()

  // Modo lote: aplicar una propuesta completa de una vez (antes eran N POST
  // secuenciales desde el cliente, frágil: aplicaciones a medias, sin feedback real).
  if (Array.isArray(body?.assignments)) {
    const assignments = body.assignments as {
      matchId: string
      personId: string
      role: 'arbitro' | 'anotador'
    }[]
    if (assignments.length === 0) {
      return NextResponse.json(
        { error: 'assignments (array) no puede estar vacío' },
        { status: 400 },
      )
    }
    let applied = 0
    const conflicts: { matchId: string; personId: string; role: string; reason: string }[] = []
    const created = []
    for (const { matchId, personId, role } of assignments) {
      const result = createDesignation(matchId, personId, role)
      if (result.ok) {
        applied++
        created.push(result.designation)
      } else {
        conflicts.push({ matchId, personId, role, reason: result.reason })
      }
    }
    persistDesignations()
    return NextResponse.json({
      applied,
      failed: conflicts.length,
      conflicts,
      designations: created,
    })
  }

  // Modo unitario.
  const { matchId, personId, role } = body
  const result = createDesignation(matchId, personId, role)
  if (!result.ok) {
    // 400 datos incompletos / 404 no encontrado / 409 conflicto → se mantiene 409 para
    // el flujo unitario (los llamadores existentes lo esperan).
    const status = result.reason.includes('requeridos')
      ? 400
      : result.reason.includes('no encontrado')
        ? 404
        : 409
    return NextResponse.json({ error: result.reason }, { status })
  }
  persistDesignations()
  return NextResponse.json({ designation: result.designation }, { status: 201 })
}
