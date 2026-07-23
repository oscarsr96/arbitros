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
import { roadKmBetween } from '@/lib/geo-distance'
import {
  autoFillPosition,
  isValidPositionForRole,
  type DesignationPosition,
} from '@/lib/designation-positions'
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
// del conflicto (duplicado / sobre-cobertura / posición) sin insertar, con el
// status HTTP que le corresponde. Valida contra el array VIVO, así que en un
// lote ve las que se han insertado antes en el mismo bucle → sin duplicados,
// sobre-cobertura ni posiciones repetidas dentro de la propia propuesta.
//
// `position` es opcional: si viene, debe ser válida para el rol (400) y única
// en el partido+rol (409, vía checkDesignationConflict). Si NO viene, auto-fill
// determinista (autoFillPosition): primera posición del rol no reclamada
// explícitamente por las designaciones existentes del partido (las legacy sin
// position no reclaman). Si todas están reclamadas queda undefined.
function createDesignation(
  matchId: string,
  personId: string,
  role: 'arbitro' | 'anotador',
  position?: unknown,
) {
  if (!matchId || !personId || !role) {
    return { ok: false as const, status: 400, reason: 'matchId, personId y role son requeridos' }
  }
  if (
    position !== undefined &&
    (typeof position !== 'string' || !isValidPositionForRole(position, role))
  ) {
    return {
      ok: false as const,
      status: 400,
      reason: `Posición "${String(position)}" no válida para el rol ${role}`,
    }
  }
  const requestedPosition = position as DesignationPosition | undefined
  const person = getMockPerson(personId)
  const match = getMockMatch(matchId)
  if (!person || !match) {
    return { ok: false as const, status: 404, reason: 'Persona o partido no encontrado' }
  }
  const conflict = checkDesignationConflict(
    mockDesignations,
    match,
    personId,
    role,
    requestedPosition,
  )
  if (!conflict.ok) {
    return { ok: false as const, status: 409, reason: conflict.reason ?? 'Conflicto' }
  }
  const venue = getMockVenue(match.venueId)
  const { cost, km } = calculateMockTravelCost(person.municipalityId, venue?.municipalityId ?? '')
  // `distanceKm` persistido: distancia real persona→pabellón cuando ambos
  // tienen coords (alimenta "Cómo llegar" y la hora de salida); si falta
  // alguna, fallback muni→muni (km). Solo aplica a designaciones NUEVAS: las
  // ya guardadas son histórico y no se reescriben. El coste estimado (cost)
  // sigue siendo muni→muni (regla FBM).
  const directKm = roadKmBetween(person, venue) ?? km
  const designation = {
    id: `desig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    matchId,
    personId,
    role,
    position: requestedPosition ?? autoFillPosition(mockDesignations, matchId, role),
    travelCost: cost.toFixed(2),
    distanceKm: directKm.toFixed(1),
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
//   - { matchId, personId, role, position? }  → una designación (manual, sustitución, re-optimizar).
//   - { assignments: [{matchId,personId,role,position?}, ...], replaceMatchIds? } → lote
//     (aplicar una propuesta en UNA llamada).
export async function POST(request: Request) {
  const body = await request.json()

  // Modo lote: aplicar una propuesta completa de una vez (antes eran N POST
  // secuenciales desde el cliente, frágil: aplicaciones a medias, sin feedback real).
  if (Array.isArray(body?.assignments)) {
    const assignments = body.assignments as {
      matchId: string
      personId: string
      role: 'arbitro' | 'anotador'
      position?: unknown
    }[]
    if (assignments.length === 0) {
      return NextResponse.json(
        { error: 'assignments (array) no puede estar vacío' },
        { status: 400 },
      )
    }

    // `replaceMatchIds` (opcional): partidos que la propuesta reemplaza (aplicar sin
    // forzar). Se borran ANTES de insertar las designaciones `pending` de esos
    // partidos; las `notified`/`completed` (ya publicadas) nunca se tocan, así que si
    // la propuesta quiere ocupar su slot la inserción choca con
    // `checkDesignationConflict` y cae en `conflicts` (visible, no silencioso).
    if (
      body?.replaceMatchIds !== undefined &&
      (!Array.isArray(body.replaceMatchIds) ||
        body.replaceMatchIds.some((id: unknown) => typeof id !== 'string'))
    ) {
      return NextResponse.json(
        { error: 'replaceMatchIds debe ser un array de strings' },
        { status: 400 },
      )
    }
    const replaceMatchIds = body.replaceMatchIds as string[] | undefined

    let removed = 0
    if (replaceMatchIds && replaceMatchIds.length > 0) {
      const matchIdSet = new Set(replaceMatchIds)
      for (let i = mockDesignations.length - 1; i >= 0; i--) {
        const d = mockDesignations[i]
        if (matchIdSet.has(d.matchId) && d.status === 'pending') {
          mockDesignations.splice(i, 1)
          removed++
        }
      }
    }

    let applied = 0
    const conflicts: { matchId: string; personId: string; role: string; reason: string }[] = []
    const created = []
    for (const { matchId, personId, role, position } of assignments) {
      const result = createDesignation(matchId, personId, role, position)
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
      removed,
    })
  }

  // Modo unitario.
  const { matchId, personId, role, position } = body
  const result = createDesignation(matchId, personId, role, position)
  if (!result.ok) {
    // 400 datos incompletos / posición inválida · 404 no encontrado · 409 conflicto
    // (el flujo unitario espera 409 en conflictos, como hasta ahora).
    return NextResponse.json({ error: result.reason }, { status: result.status })
  }
  persistDesignations()
  return NextResponse.json({ designation: result.designation }, { status: 201 })
}
