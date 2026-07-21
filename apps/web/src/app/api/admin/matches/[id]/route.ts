import { NextResponse } from 'next/server'
import {
  getMockMatch,
  getMockVenue,
  getMockCompetition,
  getMockDesignationsForMatch,
} from '@/lib/mock-data'
import type { EnrichedMatch } from '@/lib/types'

// Un único partido con su enriquecimiento completo, designaciones incluidas.
//
// Lo consume la vista de Partidos al desplegar una fila: la lista
// (`?shape=list`) omite las designaciones porque pesan ~606 B cada una y hay 5
// slots por partido, lo que dispararía una jornada designada a 4,34 MB. Como
// las filas se despliegan de una en una, cargarlas aquí sale gratis.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const match = getMockMatch(params.id)
  if (!match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  }

  const designations = getMockDesignationsForMatch(match.id)
  const refereesAssigned = designations.filter((d) => d.role === 'arbitro').length
  const scorersAssigned = designations.filter((d) => d.role === 'anotador').length

  const enriched: EnrichedMatch = {
    ...match,
    venue: getMockVenue(match.venueId),
    competition: getMockCompetition(match.competitionId),
    designations,
    refereesAssigned,
    scorersAssigned,
    isCovered: refereesAssigned >= match.refereesNeeded && scorersAssigned >= match.scorersNeeded,
  }

  return NextResponse.json({ match: enriched })
}
