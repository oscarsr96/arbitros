import { NextResponse } from 'next/server'
import {
  mockMatches,
  mockVenues,
  mockCourts,
  mockCompetitions,
  type MockVenue,
  type MockCourt,
  type MockMatch,
} from '@/lib/mock-data'
import type { ParsedXlsxMatch } from '@/lib/types'

// Normaliza para comparar nombres de forma tolerante a mayúsculas/tildes/puntuación.
function normalize(value: string): string {
  return value
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

let importSeq = 0
function nextId(prefix: string): string {
  importSeq += 1
  return `${prefix}-imp-${Date.now()}-${importSeq}-${Math.random().toString(36).slice(2, 6)}`
}

// El xlsx es la fuente autoritativa de pabellones: si no existe, se crea (a
// diferencia del importador CSV, que cae en "venue-001" en silencio).
function resolveVenue(venueName: string, district: string): { venue: MockVenue; created: boolean } {
  const target = normalize(venueName)
  const existing = mockVenues.find((v) => normalize(v.name) === target)
  if (existing) return { venue: existing, created: false }

  const newVenue: MockVenue = {
    id: nextId('venue'),
    name: venueName,
    address: '',
    // Los distritos de SABADO/DOMINGO/ENTRE SEMANA son barrios de Madrid capital;
    // el seed de CAMPOS (tarea aparte) corrige municipio/dirección reales.
    municipalityId: 'muni-001',
    postalCode: '',
    district: district || undefined,
  }
  mockVenues.push(newVenue)
  return { venue: newVenue, created: true }
}

function resolveCourt(venueId: string, courtName: string): { court: MockCourt; created: boolean } {
  // Sufijo numérico de pabellón estándar ("BARAJAS - 1" → "1"): se muestra como
  // "Pista 1" para casar con el estilo de las pistas ya sembradas.
  const displayName = /^\d+$/.test(courtName) ? `Pista ${courtName}` : courtName
  const target = normalize(displayName)
  const existing = mockCourts.find((c) => c.venueId === venueId && normalize(c.name) === target)
  if (existing) return { court: existing, created: false }

  const newCourt: MockCourt = { id: nextId('court'), venueId, name: displayName }
  mockCourts.push(newCourt)
  return { court: newCourt, created: true }
}

function findCompetition(category: string) {
  const norm = normalize(category).replace(/[^A-Z0-9]/g, '')
  if (!norm) return undefined
  return mockCompetitions.find((c) => {
    const cn = normalize(c.category).replace(/[^A-Z0-9]/g, '')
    return norm.includes(cn) || cn.includes(norm)
  })
}

export async function POST(request: Request) {
  const { matches } = (await request.json()) as { matches: ParsedXlsxMatch[] }

  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return NextResponse.json({ error: 'No se proporcionaron partidos válidos' }, { status: 400 })
  }

  // Una jornada = un número de jornada nuevo, correlativo al máximo existente.
  const matchday = Math.max(0, ...mockMatches.map((m) => m.matchday)) + 1

  const warnings: string[] = []
  let venuesCreated = 0
  let courtsCreated = 0

  const imported: MockMatch[] = []

  for (const m of matches) {
    const { venue, created: venueCreated } = resolveVenue(m.venueName, m.district)
    if (venueCreated) {
      venuesCreated++
      warnings.push(
        `Pabellón nuevo creado desde hoja ${m.sheet}: "${m.venueName}" (distrito: ${m.district || 'sin distrito'})`,
      )
    }

    let courtId: string | null = null
    if (m.courtName) {
      const { court, created: courtCreated } = resolveCourt(venue.id, m.courtName)
      courtId = court.id
      if (courtCreated) courtsCreated++
    }

    const comp = findCompetition(m.category)
    if (!comp) {
      warnings.push(
        m.category
          ? `Categoría "${m.category}" no reconocida (${m.homeTeam} vs ${m.awayTeam}); se usa competición por defecto`
          : `Partido sin categoría en el xlsx (${m.homeTeam} vs ${m.awayTeam}); se usa competición por defecto`,
      )
    }

    const newMatch: MockMatch = {
      id: nextId('match'),
      date: m.date,
      time: m.time,
      venueId: venue.id,
      courtId,
      competitionId: comp?.id ?? 'comp-001',
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      refereesNeeded: comp?.refereesNeeded ?? m.refereesNeeded,
      scorersNeeded: comp?.scorersNeeded ?? 1,
      status: 'scheduled',
      seasonId: 'season-001',
      matchday,
    }

    mockMatches.push(newMatch)
    imported.push(newMatch)
  }

  return NextResponse.json({
    imported: imported.length,
    venuesCreated,
    courtsCreated,
    warnings,
  })
}
