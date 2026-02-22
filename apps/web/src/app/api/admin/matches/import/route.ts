import { NextResponse } from 'next/server'
import { mockMatches, mockVenues, mockCompetitions } from '@/lib/mock-data'
import type { CSVMatchRow } from '@/lib/types'

export async function POST(request: Request) {
  const { rows } = (await request.json()) as { rows: CSVMatchRow[] }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No se proporcionaron filas válidas' }, { status: 400 })
  }

  const imported: typeof mockMatches = []
  const errors: string[] = []

  for (const row of rows) {
    // Try to match venue by name (case-insensitive)
    const venue = mockVenues.find((v) => v.name.toLowerCase().includes(row.pabellon.toLowerCase()))
    if (!venue) {
      errors.push(`Pabellón no encontrado: "${row.pabellon}"`)
    }

    // Try to match competition
    const comp = mockCompetitions.find((c) =>
      c.name.toLowerCase().includes(row.competicion.toLowerCase()),
    )

    const newMatch = {
      id: `match-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: row.fecha,
      time: row.hora,
      venueId: venue?.id ?? 'venue-001',
      competitionId: comp?.id ?? 'comp-001',
      homeTeam: row.equipo_local,
      awayTeam: row.equipo_visitante,
      refereesNeeded: comp?.refereesNeeded ?? 2,
      scorersNeeded: comp?.scorersNeeded ?? 1,
      status: 'scheduled' as const,
      seasonId: 'season-001',
      matchday: parseInt(row.jornada) || 16,
    }

    mockMatches.push(newMatch)
    imported.push(newMatch)
  }

  return NextResponse.json({
    imported: imported.length,
    errors,
  })
}
