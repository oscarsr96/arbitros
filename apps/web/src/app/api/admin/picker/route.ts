import { NextRequest, NextResponse } from 'next/server'
import { buildCandidates } from '@/lib/candidate-picker'
import type { DesignationPosition } from '@/lib/designation-positions'

// Candidatos para un hueco de designación. Vive en servidor porque la
// validación necesita disponibilidad y solapamientos, que dependen del
// calendario completo (ver candidate-picker.ts).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const matchId = searchParams.get('matchId')
  const role = searchParams.get('role')
  const position = searchParams.get('position') ?? undefined

  if (!matchId) {
    return NextResponse.json({ error: 'Falta matchId' }, { status: 400 })
  }
  if (role !== 'arbitro' && role !== 'anotador') {
    return NextResponse.json({ error: 'role debe ser arbitro o anotador' }, { status: 400 })
  }

  const candidates = buildCandidates({
    matchId,
    role,
    position: position as DesignationPosition | undefined,
  })

  if (candidates === null) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ candidates })
}
