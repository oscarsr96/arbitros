// Datos mock para desarrollo sin Supabase/PostgreSQL
// Mismo formato que las tablas del schema Drizzle

// ── Municipios ──────────────────────────────────────────────────────────────

export const mockMunicipalities = [
  { id: 'muni-001', name: 'Madrid', province: 'Madrid' },
  { id: 'muni-002', name: 'Alcorcón', province: 'Madrid' },
  { id: 'muni-003', name: 'Getafe', province: 'Madrid' },
  { id: 'muni-004', name: 'Leganés', province: 'Madrid' },
  { id: 'muni-005', name: 'Móstoles', province: 'Madrid' },
  { id: 'muni-006', name: 'Fuenlabrada', province: 'Madrid' },
  { id: 'muni-007', name: 'Alcalá de Henares', province: 'Madrid' },
  { id: 'muni-008', name: 'Torrejón de Ardoz', province: 'Madrid' },
]

// ── Temporada ───────────────────────────────────────────────────────────────

export const mockSeason = {
  id: 'season-001',
  name: '2024-25',
  startDate: '2024-09-01',
  endDate: '2025-06-30',
  active: true,
  createdAt: new Date('2024-08-01'),
}

// ── Competiciones ───────────────────────────────────────────────────────────

export const mockCompetitions = [
  {
    id: 'comp-001',
    name: 'Liga Preferente Masculina',
    category: 'preferente',
    gender: 'male' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'autonomico' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-002',
    name: '1ª División Femenina',
    category: '1a_division',
    gender: 'female' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-003',
    name: 'Liga Junior Masculina',
    category: 'junior',
    gender: 'male' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
]

// ── Pabellones ──────────────────────────────────────────────────────────────

export const mockVenues = [
  {
    id: 'venue-001',
    name: 'Polideportivo Municipal de Vallecas',
    address: 'C/ Payaso Fofó 1, 28018 Madrid',
    municipalityId: 'muni-001',
    postalCode: '28018',
  },
  {
    id: 'venue-002',
    name: 'Pabellón Santo Domingo',
    address: 'Av. de Lisboa s/n, 28922 Alcorcón',
    municipalityId: 'muni-002',
    postalCode: '28922',
  },
  {
    id: 'venue-003',
    name: 'Centro Deportivo Getafe',
    address: 'C/ Ramón y Cajal 5, 28901 Getafe',
    municipalityId: 'muni-003',
    postalCode: '28901',
  },
  {
    id: 'venue-004',
    name: 'Polideportivo La Fortuna',
    address: 'C/ La Fortuna 12, 28917 Leganés',
    municipalityId: 'muni-004',
    postalCode: '28917',
  },
  {
    id: 'venue-005',
    name: 'Pabellón Jorge Garbajosa',
    address: 'Av. de la Constitución 23, 28933 Móstoles',
    municipalityId: 'muni-005',
    postalCode: '28933',
  },
]

// ── Personas ────────────────────────────────────────────────────────────────

export const mockPersons = [
  {
    id: 'person-001',
    name: 'Carlos Martínez López',
    email: 'carlos.martinez@email.com',
    phone: '612345678',
    role: 'arbitro' as const,
    category: 'autonomico' as const,
    address: 'C/ Gran Vía 15, 28013 Madrid',
    postalCode: '28013',
    municipalityId: 'muni-001',
    bankIban: 'ES1234567890123456789012',
    active: true,
    authUserId: null,
    createdAt: new Date('2024-08-15'),
  },
  {
    id: 'person-002',
    name: 'Laura García Fernández',
    email: 'laura.garcia@email.com',
    phone: '623456789',
    role: 'arbitro' as const,
    category: 'nacional' as const,
    address: 'C/ Alcalá 45, 28014 Madrid',
    postalCode: '28014',
    municipalityId: 'muni-001',
    bankIban: 'ES2234567890123456789012',
    active: true,
    authUserId: null,
    createdAt: new Date('2024-08-15'),
  },
  {
    id: 'person-003',
    name: 'Miguel Ángel Ruiz Torres',
    email: 'miguel.ruiz@email.com',
    phone: '634567890',
    role: 'arbitro' as const,
    category: 'provincial' as const,
    address: 'Av. de la Libertad 8, 28922 Alcorcón',
    postalCode: '28922',
    municipalityId: 'muni-002',
    bankIban: 'ES3234567890123456789012',
    active: true,
    authUserId: null,
    createdAt: new Date('2024-09-01'),
  },
  {
    id: 'person-004',
    name: 'Ana Belén Sánchez Díaz',
    email: 'anabelen.sanchez@email.com',
    phone: '645678901',
    role: 'anotador' as const,
    category: null,
    address: 'C/ Mayor 22, 28901 Getafe',
    postalCode: '28901',
    municipalityId: 'muni-003',
    bankIban: 'ES4234567890123456789012',
    active: true,
    authUserId: null,
    createdAt: new Date('2024-08-20'),
  },
  {
    id: 'person-005',
    name: 'David Fernández Moreno',
    email: 'david.fernandez@email.com',
    phone: '656789012',
    role: 'anotador' as const,
    category: null,
    address: 'C/ Real 10, 28917 Leganés',
    postalCode: '28917',
    municipalityId: 'muni-004',
    bankIban: 'ES5234567890123456789012',
    active: true,
    authUserId: null,
    createdAt: new Date('2024-09-10'),
  },
]

// ── Partidos ────────────────────────────────────────────────────────────────

const nextSaturday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return d.toISOString().split('T')[0]
})()

const nextSunday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay() + 7) % 7 || 7))
  return d.toISOString().split('T')[0]
})()

export const mockMatches = [
  {
    id: 'match-001',
    date: nextSaturday,
    time: '10:00',
    venueId: 'venue-001',
    competitionId: 'comp-001',
    homeTeam: 'CB Vallecas',
    awayTeam: 'Baloncesto Alcorcón',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-002',
    date: nextSaturday,
    time: '12:00',
    venueId: 'venue-002',
    competitionId: 'comp-001',
    homeTeam: 'AD Alcorcón Basket',
    awayTeam: 'CB Getafe',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-003',
    date: nextSaturday,
    time: '16:00',
    venueId: 'venue-003',
    competitionId: 'comp-002',
    homeTeam: 'CB Getafe Femenino',
    awayTeam: 'Baloncesto Leganés Fem.',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-004',
    date: nextSunday,
    time: '10:00',
    venueId: 'venue-004',
    competitionId: 'comp-003',
    homeTeam: 'CB Leganés Junior',
    awayTeam: 'CB Fuenlabrada Junior',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-005',
    date: nextSunday,
    time: '12:00',
    venueId: 'venue-005',
    competitionId: 'comp-001',
    homeTeam: 'CB Móstoles',
    awayTeam: 'CB Madrid Centro',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-006',
    date: nextSaturday,
    time: '18:00',
    venueId: 'venue-001',
    competitionId: 'comp-002',
    homeTeam: 'Vallekas Basket Fem.',
    awayTeam: 'CB Alcorcón Femenino',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-007',
    date: nextSunday,
    time: '16:00',
    venueId: 'venue-003',
    competitionId: 'comp-003',
    homeTeam: 'Getafe Junior',
    awayTeam: 'CB Vallecas Junior',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-008',
    date: nextSaturday,
    time: '20:00',
    venueId: 'venue-005',
    competitionId: 'comp-001',
    homeTeam: 'Móstoles Basket',
    awayTeam: 'AD Fuenlabrada',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-009',
    date: nextSunday,
    time: '18:00',
    venueId: 'venue-002',
    competitionId: 'comp-002',
    homeTeam: 'Alcorcón Femenino B',
    awayTeam: 'CB Madrid Fem.',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
  {
    id: 'match-010',
    date: nextSunday,
    time: '20:00',
    venueId: 'venue-004',
    competitionId: 'comp-001',
    homeTeam: 'CB Leganés',
    awayTeam: 'Baloncesto Torrejón',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
  },
]

// ── Designaciones ───────────────────────────────────────────────────────────

type DesignationStatus = 'pending' | 'notified' | 'confirmed' | 'rejected' | 'completed'

interface MockDesignation {
  id: string
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  travelCost: string
  distanceKm: string
  status: DesignationStatus
  notifiedAt: Date | null
  confirmedAt: Date | null
  createdAt: Date
}

export const mockDesignations: MockDesignation[] = [
  {
    id: 'desig-001',
    matchId: 'match-001',
    personId: 'person-001',
    role: 'arbitro' as const,
    travelCost: '3.00',
    distanceKm: '0.0',
    status: 'confirmed' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    confirmedAt: new Date('2025-03-05T14:30:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-002',
    matchId: 'match-001',
    personId: 'person-002',
    role: 'arbitro' as const,
    travelCost: '3.00',
    distanceKm: '0.0',
    status: 'confirmed' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    confirmedAt: new Date('2025-03-05T15:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-003',
    matchId: 'match-001',
    personId: 'person-004',
    role: 'anotador' as const,
    travelCost: '4.50',
    distanceKm: '15.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    confirmedAt: null,
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-004',
    matchId: 'match-002',
    personId: 'person-001',
    role: 'arbitro' as const,
    travelCost: '2.40',
    distanceKm: '24.0',
    status: 'pending' as const,
    notifiedAt: null,
    confirmedAt: null,
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-005',
    matchId: 'match-003',
    personId: 'person-002',
    role: 'arbitro' as const,
    travelCost: '1.50',
    distanceKm: '15.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-06T08:00:00'),
    confirmedAt: null,
    createdAt: new Date('2025-03-06T07:00:00'),
  },
  {
    id: 'desig-006',
    matchId: 'match-004',
    personId: 'person-003',
    role: 'arbitro' as const,
    travelCost: '3.80',
    distanceKm: '38.0',
    status: 'rejected' as const,
    notifiedAt: new Date('2025-03-06T08:00:00'),
    confirmedAt: null,
    createdAt: new Date('2025-03-06T07:00:00'),
  },
  {
    id: 'desig-007',
    matchId: 'match-006',
    personId: 'person-001',
    role: 'arbitro' as const,
    travelCost: '3.00',
    distanceKm: '0.0',
    status: 'confirmed' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    confirmedAt: new Date('2025-03-05T16:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-008',
    matchId: 'match-008',
    personId: 'person-005',
    role: 'anotador' as const,
    travelCost: '4.20',
    distanceKm: '42.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-06T10:00:00'),
    confirmedAt: null,
    createdAt: new Date('2025-03-06T09:00:00'),
  },
]

// ── Disponibilidades de ejemplo ─────────────────────────────────────────────

function getCurrentWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export const mockAvailabilities = [
  // Carlos (person-001) - disponible sábado mañana y tarde, domingo mañana
  {
    id: 'avail-001',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 5,
    startTime: '09:00',
    endTime: '10:00',
  },
  {
    id: 'avail-002',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 5,
    startTime: '10:00',
    endTime: '11:00',
  },
  {
    id: 'avail-003',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 5,
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    id: 'avail-004',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 5,
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    id: 'avail-005',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 5,
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    id: 'avail-006',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 5,
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    id: 'avail-007',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 5,
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    id: 'avail-008',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 6,
    startTime: '09:00',
    endTime: '10:00',
  },
  {
    id: 'avail-009',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 6,
    startTime: '10:00',
    endTime: '11:00',
  },
  {
    id: 'avail-010',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 6,
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    id: 'avail-011',
    personId: 'person-001',
    weekStart: getCurrentWeekStart(),
    dayOfWeek: 6,
    startTime: '12:00',
    endTime: '13:00',
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getMockVenue(venueId: string) {
  return mockVenues.find((v) => v.id === venueId)
}

export function getMockMatch(matchId: string) {
  return mockMatches.find((m) => m.id === matchId)
}

export function getMockPerson(personId: string) {
  return mockPersons.find((p) => p.id === personId)
}

export function getMockCompetition(competitionId: string) {
  return mockCompetitions.find((c) => c.id === competitionId)
}

export function getMockMunicipality(municipalityId: string) {
  return mockMunicipalities.find((m) => m.id === municipalityId)
}

export function getMockDesignationsForPerson(personId: string) {
  return mockDesignations
    .filter((d) => d.personId === personId)
    .map((d) => {
      const match = getMockMatch(d.matchId)
      const venue = match ? getMockVenue(match.venueId) : undefined
      const competition = match ? getMockCompetition(match.competitionId) : undefined
      return { ...d, match, venue, competition }
    })
}

export function getMockAvailabilitiesForPerson(personId: string, weekStart: string) {
  return mockAvailabilities.filter((a) => a.personId === personId && a.weekStart === weekStart)
}

// Usuario demo por defecto (Carlos Martínez)
export const DEMO_PERSON_ID = 'person-001'
