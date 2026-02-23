import { NextResponse } from 'next/server'
import {
  mockMatches,
  getMockVenue,
  getMockCompetition,
  getMockDesignationsForMatch,
} from '@/lib/mock-data'
import type { EnrichedMatch } from '@/lib/types'

export async function GET() {
  const enriched: EnrichedMatch[] = mockMatches.map((match) => {
    const venue = getMockVenue(match.venueId)
    const competition = getMockCompetition(match.competitionId)
    const designations = getMockDesignationsForMatch(match.id)
    const refereesAssigned = designations.filter((d) => d.role === 'arbitro').length
    const scorersAssigned = designations.filter((d) => d.role === 'anotador').length

    return {
      ...match,
      venue,
      competition,
      designations,
      refereesAssigned,
      scorersAssigned,
      isCovered: refereesAssigned >= match.refereesNeeded && scorersAssigned >= match.scorersNeeded,
    }
  })

  return NextResponse.json({ matches: enriched })
}
