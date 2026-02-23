import { NextResponse } from 'next/server'
import {
  mockPersons,
  mockMatches,
  mockAvailabilities,
  mockDesignations,
  mockIncompatibilities,
  mockMunicipalities,
  mockVenues,
  mockCompetitions,
  resetMockData,
  nextSaturday,
  nextSunday,
  weekStart,
  nextWeek,
  formatLocalDate,
  getMockMunicipality,
  getMockDesignationsForMatch,
  calculateMockTravelCost,
  getMockVenue,
} from '@/lib/mock-data'
import { solve } from '@/lib/solver'
import type { EnrichedMatch, EnrichedPerson } from '@/lib/types'

// ── Pools de datos ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Carlos',
  'Laura',
  'Miguel',
  'Ana',
  'David',
  'Raúl',
  'Patricia',
  'Sofía',
  'Javier',
  'Elena',
  'Pablo',
  'Marta',
  'Sergio',
  'Carmen',
  'Andrés',
  'Isabel',
  'Fernando',
  'Lucía',
  'Daniel',
  'Claudia',
]

const LAST_NAMES = [
  'García',
  'Martínez',
  'López',
  'Sánchez',
  'Fernández',
  'González',
  'Rodríguez',
  'Pérez',
  'Gómez',
  'Díaz',
  'Moreno',
  'Jiménez',
  'Ruiz',
  'Álvarez',
  'Romero',
  'Navarro',
  'Torres',
  'Domínguez',
  'Vázquez',
  'Ramos',
]

const CLUB_NAMES = [
  'CB Madrid Norte',
  'Basket Chamberí',
  'AD Parla',
  'CB Coslada',
  'Baloncesto Rivas',
  'CB Tres Cantos',
  'AD San Sebastián de los Reyes',
  'CB Pozuelo',
  'Basket Majadahonda',
  'CB Colmenar',
  'AD Arganda',
  'CB Villalba',
  'Baloncesto Boadilla',
  'CB Pinto',
  'AD Valdemoro',
  'CB Aranjuez',
  'Basket Navalcarnero',
  'CB Ciempozuelos',
  'AD Humanes',
  'CB San Fernando',
]

const CATEGORIES: ('provincial' | 'autonomico' | 'nacional')[] = [
  'provincial',
  'provincial',
  'provincial',
  'autonomico',
  'autonomico',
  'autonomico',
  'autonomico',
  'nacional',
  'nacional',
  'nacional',
]

// ── Helpers ───────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomIBAN(): string {
  const digits = Array.from({ length: 22 }, () => Math.floor(Math.random() * 10)).join('')
  return `ES${digits}`
}

function randomPhone(): string {
  return `6${Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')}`
}

// ── GET — stats ───────────────────────────────────────────────────────────

export async function GET() {
  const referees = mockPersons.filter((p) => p.role === 'arbitro')
  const scorers = mockPersons.filter((p) => p.role === 'anotador')
  const personsWithAvail = new Set(mockAvailabilities.map((a) => a.personId)).size

  // Compute coverage
  let matchesCovered = 0
  let matchesPartial = 0
  for (const match of mockMatches) {
    const desigs = mockDesignations.filter((d) => d.matchId === match.id && d.status !== 'rejected')
    const refs = desigs.filter((d) => d.role === 'arbitro').length
    const sco = desigs.filter((d) => d.role === 'anotador').length
    if (refs >= match.refereesNeeded && sco >= match.scorersNeeded) matchesCovered++
    else if (refs > 0 || sco > 0) matchesPartial++
  }

  // Enrich matches for detail view
  const matchesDetail: EnrichedMatch[] = mockMatches.map((m) => {
    const venue = mockVenues.find((v) => v.id === m.venueId)
    const competition = mockCompetitions.find((c) => c.id === m.competitionId)
    const designations = getMockDesignationsForMatch(m.id)
    const activeDesigs = designations.filter((d) => d.status !== 'rejected')
    const refsAssigned = activeDesigs.filter((d) => d.role === 'arbitro').length
    const scoAssigned = activeDesigs.filter((d) => d.role === 'anotador').length

    return {
      ...m,
      venue: venue ? { ...venue } : undefined,
      competition: competition ?? undefined,
      designations,
      refereesAssigned: refsAssigned,
      scorersAssigned: scoAssigned,
      isCovered: refsAssigned >= m.refereesNeeded && scoAssigned >= m.scorersNeeded,
    }
  })

  return NextResponse.json({
    matches: mockMatches.length,
    referees: referees.length,
    scorers: scorers.length,
    persons: mockPersons.length,
    availabilities: mockAvailabilities.length,
    personsWithAvailability: personsWithAvail,
    designations: mockDesignations.length,
    incompatibilities: mockIncompatibilities.length,
    matchesCovered,
    matchesPartial,
    matchesUncovered: mockMatches.length - matchesCovered - matchesPartial,
    matchesDetail,
  })
}

// ── POST — generate / reset ──────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json()
  const { action, numMatches = 20, numReferees = 12, numScorers = 6 } = body

  if (action === 'reset') {
    resetMockData()
    return NextResponse.json({ reset: true })
  }

  if (action !== 'generate') {
    return NextResponse.json({ error: 'action must be generate or reset' }, { status: 400 })
  }

  // 1. Vaciar todo — la demo NO usa datos del seed, solo datos generados
  mockMatches.length = 0
  mockPersons.length = 0
  mockDesignations.length = 0
  mockAvailabilities.length = 0
  mockIncompatibilities.length = 0

  // 2. Generar árbitros
  for (let i = 0; i < numReferees; i++) {
    const id = `person-gen-ref-${String(i + 1).padStart(3, '0')}`
    const firstName = pick(FIRST_NAMES)
    const lastName1 = pick(LAST_NAMES)
    const lastName2 = pick(LAST_NAMES)
    const muni = mockMunicipalities[i % mockMunicipalities.length]
    mockPersons.push({
      id,
      name: `${firstName} ${lastName1} ${lastName2}`,
      email: `${firstName.toLowerCase()}.${lastName1.toLowerCase()}.gen${i}@email.com`,
      phone: randomPhone(),
      role: 'arbitro' as const,
      category: pick(CATEGORIES),
      address: `C/ Generada ${i + 1}, ${muni.name}`,
      postalCode: '28000',
      municipalityId: muni.id,
      bankIban: randomIBAN(),
      active: true,
      authUserId: null,
      createdAt: new Date(),
    })
  }

  // 3. Generar anotadores
  for (let i = 0; i < numScorers; i++) {
    const id = `person-gen-sco-${String(i + 1).padStart(3, '0')}`
    const firstName = pick(FIRST_NAMES)
    const lastName1 = pick(LAST_NAMES)
    const lastName2 = pick(LAST_NAMES)
    const muni = mockMunicipalities[i % mockMunicipalities.length]
    mockPersons.push({
      id,
      name: `${firstName} ${lastName1} ${lastName2}`,
      email: `${firstName.toLowerCase()}.${lastName1.toLowerCase()}.sco${i}@email.com`,
      phone: randomPhone(),
      role: 'anotador' as const,
      category: pick(CATEGORIES),
      address: `C/ Generada ${i + 100}, ${muni.name}`,
      postalCode: '28000',
      municipalityId: muni.id,
      bankIban: randomIBAN(),
      active: true,
      authUserId: null,
      createdAt: new Date(),
    })
  }

  // 4. Generar partidos (solo generados, sin los originales del seed)
  const generatedMatchIds: string[] = []
  const timeSlots = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00']
  const days = [nextSaturday, nextSunday]

  for (let i = 0; i < numMatches; i++) {
    const id = `match-gen-${String(i + 1).padStart(3, '0')}`
    const day = days[i % days.length]
    const time = timeSlots[i % timeSlots.length]
    const venue = mockVenues[i % mockVenues.length]
    const comp = mockCompetitions[i % mockCompetitions.length]
    const homeIdx = (i * 2) % CLUB_NAMES.length
    const awayIdx = (i * 2 + 1) % CLUB_NAMES.length

    mockMatches.push({
      id,
      date: day,
      time,
      venueId: venue.id,
      competitionId: comp.id,
      homeTeam: CLUB_NAMES[homeIdx],
      awayTeam: CLUB_NAMES[awayIdx],
      refereesNeeded: comp.refereesNeeded,
      scorersNeeded: comp.scorersNeeded,
      status: 'scheduled' as const,
      seasonId: 'season-001',
      matchday: 15,
    })
    generatedMatchIds.push(id)
  }

  // 5. Generar disponibilidades para TODAS las personas
  const allWeeks = [weekStart, nextWeek]
  const satDate = new Date(nextSaturday + 'T00:00:00')
  const satDay = satDate.getDay()
  const satDiff = satDate.getDate() - satDay + (satDay === 0 ? -6 : 1)
  satDate.setDate(satDiff)
  const matchWeekStart = formatLocalDate(satDate)
  if (!allWeeks.includes(matchWeekStart)) {
    allWeeks.push(matchWeekStart)
  }

  let availCounter = 1
  const hours = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
  ]

  for (const person of mockPersons) {
    for (const ws of allWeeks) {
      for (const dayOfWeek of [5, 6]) {
        for (const hour of hours) {
          if (Math.random() < 0.7) {
            const nextHour = String(parseInt(hour.split(':')[0]) + 1).padStart(2, '0') + ':00'
            mockAvailabilities.push({
              id: `avail-gen-${String(availCounter++).padStart(4, '0')}`,
              personId: person.id,
              weekStart: ws,
              dayOfWeek,
              startTime: hour,
              endTime: nextHour,
            })
          }
        }
      }
    }
  }

  // 6. Generar incompatibilidades (~10% de personas)
  for (const person of mockPersons) {
    if (Math.random() < 0.1) {
      mockIncompatibilities.push({
        id: `incompat-gen-${person.id}`,
        personId: person.id,
        teamName: pick(CLUB_NAMES),
        reason: 'Vinculación con el club',
      })
    }
  }

  // 7. Ejecutar solver para generar designaciones automáticas
  const enrichedMatches: EnrichedMatch[] = mockMatches.map((m) => {
    const venue = mockVenues.find((v) => v.id === m.venueId)
    const competition = mockCompetitions.find((c) => c.id === m.competitionId)
    const designations = getMockDesignationsForMatch(m.id)
    const activeDesigs = designations.filter((d) => d.status !== 'rejected')
    const refereesAssigned = activeDesigs.filter((d) => d.role === 'arbitro').length
    const scorersAssigned = activeDesigs.filter((d) => d.role === 'anotador').length

    return {
      ...m,
      venue: venue ? { ...venue, latitude: 0, longitude: 0 } : undefined,
      competition: competition ?? undefined,
      designations,
      refereesAssigned,
      scorersAssigned,
      isCovered: refereesAssigned >= m.refereesNeeded && scorersAssigned >= m.scorersNeeded,
    }
  })

  const enrichedPersons: EnrichedPerson[] = mockPersons
    .filter((p) => p.active)
    .map((p) => {
      const municipality = getMockMunicipality(p.municipalityId)
      const personDesigs = mockDesignations.filter(
        (d) => d.personId === p.id && d.status !== 'rejected',
      )
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        category: p.category,
        address: p.address,
        postalCode: p.postalCode,
        municipalityId: p.municipalityId,
        active: p.active,
        municipality,
        matchesAssigned: personDesigs.length,
        matchesConfirmed: personDesigs.filter((d) => d.status === 'confirmed').length,
        totalCost: personDesigs.reduce((sum, d) => sum + parseFloat(d.travelCost), 0),
        hasAvailability: true,
      }
    })

  const solverResult = solve({
    matches: enrichedMatches,
    persons: enrichedPersons,
    parameters: {
      costWeight: 0.7,
      balanceWeight: 0.3,
      maxMatchesPerPerson: 3,
      forceExisting: false,
      numProposals: 1,
    },
  })

  // 8. Crear designaciones a partir del resultado del solver
  const now = new Date()
  const statuses: ('confirmed' | 'notified' | 'pending')[] = [
    'confirmed',
    'confirmed',
    'confirmed',
    'notified',
    'pending',
  ]
  let desigCount = 0

  for (const assignment of solverResult.assignments) {
    const person = mockPersons.find((p) => p.id === assignment.personId)
    const match = mockMatches.find((m) => m.id === assignment.matchId)
    if (!person || !match) continue

    const venue = getMockVenue(match.venueId)
    const { cost, km } = calculateMockTravelCost(person.municipalityId, venue?.municipalityId ?? '')
    const status = pick(statuses)

    mockDesignations.push({
      id: `desig-gen-${String(++desigCount).padStart(4, '0')}`,
      matchId: assignment.matchId,
      personId: assignment.personId,
      role: assignment.role,
      travelCost: cost.toFixed(2),
      distanceKm: km.toFixed(1),
      status,
      notifiedAt: status !== 'pending' ? now : null,
      confirmedAt: status === 'confirmed' ? now : null,
      createdAt: now,
    })
  }

  // 9. Actualizar estado de partidos según cobertura
  for (const match of mockMatches) {
    const desigs = mockDesignations.filter((d) => d.matchId === match.id && d.status !== 'rejected')
    const refs = desigs.filter((d) => d.role === 'arbitro').length
    const sco = desigs.filter((d) => d.role === 'anotador').length
    if (refs >= match.refereesNeeded && sco >= match.scorersNeeded) {
      ;(match as { status: string }).status = 'designated'
    }
  }

  // 10. Construir respuesta enriquecida con partidos + designaciones para visualizar
  const resultMatches: EnrichedMatch[] = mockMatches.map((m) => {
    const venue = mockVenues.find((v) => v.id === m.venueId)
    const competition = mockCompetitions.find((c) => c.id === m.competitionId)
    const designations = getMockDesignationsForMatch(m.id)
    const activeDesigs = designations.filter((d) => d.status !== 'rejected')
    const refereesAssigned = activeDesigs.filter((d) => d.role === 'arbitro').length
    const scorersAssigned = activeDesigs.filter((d) => d.role === 'anotador').length

    return {
      ...m,
      venue: venue ? { ...venue } : undefined,
      competition: competition ?? undefined,
      designations,
      refereesAssigned,
      scorersAssigned,
      isCovered: refereesAssigned >= m.refereesNeeded && scorersAssigned >= m.scorersNeeded,
    }
  })

  return NextResponse.json({
    generated: {
      matches: numMatches,
      referees: numReferees,
      scorers: numScorers,
      availabilities: mockAvailabilities.length,
      totalPersons: mockPersons.length,
      designations: desigCount,
      solverStatus: solverResult.status,
      solverCoverage: solverResult.metrics.coverage,
      solverCost: solverResult.metrics.totalCost,
      solverTimeMs: solverResult.metrics.resolutionTimeMs,
      matchesCovered: mockMatches.filter((m) => m.status === 'designated').length,
      unassignedSlots: solverResult.unassigned,
    },
    matchesDetail: resultMatches,
  })
}
