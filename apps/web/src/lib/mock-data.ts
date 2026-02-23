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

// ── Distancias entre municipios ─────────────────────────────────────────────

export const mockDistances = [
  { originId: 'muni-001', destId: 'muni-002', distanceKm: 13 },
  { originId: 'muni-001', destId: 'muni-003', distanceKm: 15 },
  { originId: 'muni-001', destId: 'muni-004', distanceKm: 11 },
  { originId: 'muni-001', destId: 'muni-005', distanceKm: 25 },
  { originId: 'muni-001', destId: 'muni-006', distanceKm: 20 },
  { originId: 'muni-001', destId: 'muni-007', distanceKm: 30 },
  { originId: 'muni-001', destId: 'muni-008', distanceKm: 28 },
  { originId: 'muni-002', destId: 'muni-003', distanceKm: 10 },
  { originId: 'muni-002', destId: 'muni-004', distanceKm: 8 },
  { originId: 'muni-002', destId: 'muni-005', distanceKm: 12 },
  { originId: 'muni-002', destId: 'muni-006', distanceKm: 14 },
  { originId: 'muni-003', destId: 'muni-004', distanceKm: 6 },
  { originId: 'muni-003', destId: 'muni-005', distanceKm: 18 },
  { originId: 'muni-003', destId: 'muni-006', distanceKm: 10 },
  { originId: 'muni-004', destId: 'muni-005', distanceKm: 14 },
  { originId: 'muni-004', destId: 'muni-006', distanceKm: 9 },
  { originId: 'muni-005', destId: 'muni-006', distanceKm: 8 },
  { originId: 'muni-007', destId: 'muni-008', distanceKm: 15 },
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
    hasCar: true,
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
    hasCar: true,
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
    hasCar: false,
    authUserId: null,
    createdAt: new Date('2024-09-01'),
  },
  {
    id: 'person-004',
    name: 'Ana Belén Sánchez Díaz',
    email: 'anabelen.sanchez@email.com',
    phone: '645678901',
    role: 'anotador' as const,
    category: 'autonomico' as const,
    address: 'C/ Mayor 22, 28901 Getafe',
    postalCode: '28901',
    municipalityId: 'muni-003',
    bankIban: 'ES4234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-08-20'),
  },
  {
    id: 'person-005',
    name: 'David Fernández Moreno',
    email: 'david.fernandez@email.com',
    phone: '656789012',
    role: 'anotador' as const,
    category: 'provincial' as const,
    address: 'C/ Real 10, 28917 Leganés',
    postalCode: '28917',
    municipalityId: 'muni-004',
    bankIban: 'ES5234567890123456789012',
    active: true,
    hasCar: false,
    authUserId: null,
    createdAt: new Date('2024-09-10'),
  },
  {
    id: 'person-006',
    name: 'Raúl Jiménez Navarro',
    email: 'raul.jimenez@email.com',
    phone: '667890123',
    role: 'arbitro' as const,
    category: 'autonomico' as const,
    address: 'C/ Constitución 3, 28936 Móstoles',
    postalCode: '28936',
    municipalityId: 'muni-005',
    bankIban: 'ES6234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-09-05'),
  },
  {
    id: 'person-007',
    name: 'Patricia López Martín',
    email: 'patricia.lopez@email.com',
    phone: '678901234',
    role: 'arbitro' as const,
    category: 'nacional' as const,
    address: 'C/ Severo Ochoa 12, 28945 Fuenlabrada',
    postalCode: '28945',
    municipalityId: 'muni-006',
    bankIban: 'ES7234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-08-25'),
  },
  {
    id: 'person-008',
    name: 'Sofía Morales Vega',
    email: 'sofia.morales@email.com',
    phone: '689012345',
    role: 'anotador' as const,
    category: 'nacional' as const,
    address: 'C/ Toledo 40, 28922 Alcorcón',
    postalCode: '28922',
    municipalityId: 'muni-002',
    bankIban: 'ES8234567890123456789012',
    active: true,
    hasCar: false,
    authUserId: null,
    createdAt: new Date('2024-09-15'),
  },
  {
    id: 'person-009',
    name: 'Javier Romero Díaz',
    email: 'javier.romero@email.com',
    phone: '690123456',
    role: 'anotador' as const,
    category: 'autonomico' as const,
    address: 'Av. de Madrid 5, 28936 Móstoles',
    postalCode: '28936',
    municipalityId: 'muni-005',
    bankIban: 'ES9234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-10-01'),
  },
]

// ── Incompatibilidades ──────────────────────────────────────────────────────

export const mockIncompatibilities = [
  {
    id: 'incompat-001',
    personId: 'person-001',
    teamName: 'CB Vallecas',
    reason: 'Jugador del club',
  },
  {
    id: 'incompat-002',
    personId: 'person-003',
    teamName: 'AD Alcorcón Basket',
    reason: 'Entrenador de cantera',
  },
  {
    id: 'incompat-003',
    personId: 'person-006',
    teamName: 'CB Móstoles',
    reason: 'Familiar en directiva',
  },
]

// ── Helpers de fecha (local timezone, sin UTC shift) ────────────────────────

function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Partidos ────────────────────────────────────────────────────────────────

const nextSaturday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return formatLocalDate(d)
})()

const nextSunday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay() + 7) % 7 || 7))
  return formatLocalDate(d)
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

type DesignationStatus = 'pending' | 'notified' | 'completed'

interface MockDesignation {
  id: string
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  travelCost: string
  distanceKm: string
  status: DesignationStatus
  notifiedAt: Date | null
  createdAt: Date
}

export const mockDesignations: MockDesignation[] = [
  // match-001: 2 arbitros + 1 anotador (full)
  {
    id: 'desig-001',
    matchId: 'match-001',
    personId: 'person-002', // Laura (nacional) - Madrid
    role: 'arbitro' as const,
    travelCost: '3.00',
    distanceKm: '0.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-002',
    matchId: 'match-001',
    personId: 'person-006', // Raul (autonomico) - Mostoles
    role: 'arbitro' as const,
    travelCost: '2.50',
    distanceKm: '25.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-003',
    matchId: 'match-001',
    personId: 'person-004', // Ana Belen (anotador) - Getafe
    role: 'anotador' as const,
    travelCost: '1.50',
    distanceKm: '15.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  // match-002: 1 arbitro only (partial)
  {
    id: 'desig-004',
    matchId: 'match-002',
    personId: 'person-001', // Carlos (autonomico) - Madrid
    role: 'arbitro' as const,
    travelCost: '1.30',
    distanceKm: '13.0',
    status: 'pending' as const,
    notifiedAt: null,
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  // match-003: 1 arbitro (partial)
  {
    id: 'desig-005',
    matchId: 'match-003',
    personId: 'person-007', // Patricia (nacional) - Fuenlabrada
    role: 'arbitro' as const,
    travelCost: '1.00',
    distanceKm: '10.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-06T08:00:00'),
    createdAt: new Date('2025-03-06T07:00:00'),
  },
  // match-006: 1 arbitro (partial)
  {
    id: 'desig-006',
    matchId: 'match-006',
    personId: 'person-001', // Carlos (autonomico) - Madrid
    role: 'arbitro' as const,
    travelCost: '3.00',
    distanceKm: '0.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  // match-008: 1 anotador (partial)
  {
    id: 'desig-007',
    matchId: 'match-008',
    personId: 'person-005', // David (anotador) - Leganes
    role: 'anotador' as const,
    travelCost: '1.40',
    distanceKm: '14.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-06T10:00:00'),
    createdAt: new Date('2025-03-06T09:00:00'),
  },
]

// ── Disponibilidades de ejemplo ─────────────────────────────────────────────

function getCurrentWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return formatLocalDate(d)
}

function getNextWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 7
  d.setDate(diff)
  return formatLocalDate(d)
}

const weekStart = getCurrentWeekStart()
const nextWeek = getNextWeekStart()

// Generar disponibilidades para todas las personas en sabado/domingo
function generateAvailabilities() {
  const avails: {
    id: string
    personId: string
    weekStart: string
    dayOfWeek: number
    startTime: string
    endTime: string
  }[] = []
  let counter = 1

  const schedules: Record<string, { day: number; start: string; end: string }[]> = {
    'person-001': [
      // Carlos: sabado 09-13, 15-19; domingo 09-13
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '15:00', end: '16:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
    ],
    'person-002': [
      // Laura: sabado 10-14, 16-20; domingo 10-14
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-003': [
      // Miguel: sabado 09-13; domingo 09-13, 15-19
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '15:00', end: '16:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
    ],
    'person-004': [
      // Ana Belen: sabado 09-14; domingo 10-14
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-005': [
      // David: sabado 15-21; domingo 15-21
      { day: 5, start: '15:00', end: '16:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 5, start: '20:00', end: '21:00' },
      { day: 6, start: '15:00', end: '16:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
      { day: 6, start: '19:00', end: '20:00' },
      { day: 6, start: '20:00', end: '21:00' },
    ],
    'person-006': [
      // Raul: sabado 09-14, 16-21; domingo 10-14
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 5, start: '20:00', end: '21:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-007': [
      // Patricia: sabado 10-14, 16-20; domingo 09-14, 16-20
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
      { day: 6, start: '19:00', end: '20:00' },
    ],
    'person-008': [
      // Sofia: sabado 09-14; domingo 09-14
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-009': [
      // Javier: sabado 16-21; domingo 16-21
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 5, start: '20:00', end: '21:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
      { day: 6, start: '19:00', end: '20:00' },
      { day: 6, start: '20:00', end: '21:00' },
    ],
  }

  for (const [personId, slots] of Object.entries(schedules)) {
    for (const ws of [weekStart, nextWeek]) {
      for (const slot of slots) {
        avails.push({
          id: `avail-${String(counter++).padStart(3, '0')}`,
          personId,
          weekStart: ws,
          dayOfWeek: slot.day,
          startTime: slot.start,
          endTime: slot.end,
        })
      }
    }
  }

  return avails
}

export const mockAvailabilities = generateAvailabilities()

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

export function getMockDesignationsForMatch(matchId: string) {
  return mockDesignations
    .filter((d) => d.matchId === matchId)
    .map((d) => {
      const person = getMockPerson(d.personId)
      const municipality = person ? getMockMunicipality(person.municipalityId) : undefined
      return { ...d, person, municipality }
    })
}

export function getMockAvailabilitiesForPerson(personId: string, weekStart: string) {
  return mockAvailabilities.filter((a) => a.personId === personId && a.weekStart === weekStart)
}

export function getMockDistance(originId: string, destId: string): number {
  if (originId === destId) return 0
  const d = mockDistances.find(
    (d) =>
      (d.originId === originId && d.destId === destId) ||
      (d.originId === destId && d.destId === originId),
  )
  return d?.distanceKm ?? 35 // fallback for unknown pairs
}

export function calculateMockTravelCost(
  personMuniId: string,
  venueMuniId: string,
): { cost: number; km: number } {
  if (personMuniId === venueMuniId) {
    return { cost: 3.0, km: 0 }
  }
  const km = getMockDistance(personMuniId, venueMuniId)
  return { cost: Number((km * 0.1).toFixed(2)), km }
}

export function isPersonAvailable(personId: string, date: string, time: string): boolean {
  // Determine day of week from date (0=sunday, 1=monday... we need 5=saturday, 6=sunday)
  const d = new Date(date + 'T00:00:00')
  const jsDay = d.getDay() // 0=sun, 6=sat
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1 // convert to 0=mon, 5=sat, 6=sun

  // Get week start for the date (using local time, not UTC)
  const dateObj = new Date(date + 'T00:00:00')
  const dateDayOfWeek = dateObj.getDay()
  const diff = dateObj.getDate() - dateDayOfWeek + (dateDayOfWeek === 0 ? -6 : 1)
  dateObj.setDate(diff)
  const weekStartStr = formatLocalDate(dateObj)

  const avails = mockAvailabilities.filter(
    (a) => a.personId === personId && a.weekStart === weekStartStr && a.dayOfWeek === dayOfWeek,
  )

  // Check if the person has availability that covers the match time
  const matchHour = parseInt(time.split(':')[0])
  return avails.some((a) => {
    const availStart = parseInt(a.startTime.split(':')[0])
    const availEnd = parseInt(a.endTime.split(':')[0])
    return matchHour >= availStart && matchHour < availEnd
  })
}

export function getPersonIncompatibilities(personId: string) {
  return mockIncompatibilities.filter((i) => i.personId === personId)
}

export function hasTimeOverlap(personId: string, matchId: string): boolean {
  const targetMatch = getMockMatch(matchId)
  if (!targetMatch) return false

  const personDesignations = mockDesignations.filter(
    (d) => d.personId === personId && d.matchId !== matchId,
  )

  const targetHour = parseInt(targetMatch.time.split(':')[0])

  for (const desig of personDesignations) {
    const otherMatch = getMockMatch(desig.matchId)
    if (!otherMatch || otherMatch.date !== targetMatch.date) continue
    const otherHour = parseInt(otherMatch.time.split(':')[0])
    // 2h window for each match (game time + travel)
    if (Math.abs(targetHour - otherHour) < 2) return true
  }

  return false
}

// Jerarquia de categorias para validacion
const CATEGORY_RANK: Record<string, number> = {
  provincial: 1,
  autonomico: 2,
  nacional: 3,
  feb: 4,
}

export function meetsMinCategory(personCategory: string | null, requiredCategory: string): boolean {
  if (!personCategory) return false
  return (CATEGORY_RANK[personCategory] ?? 0) >= (CATEGORY_RANK[requiredCategory] ?? 0)
}

// ── Datos historicos de jornadas anteriores ─────────────────────────────

export interface HistoricalMatchday {
  matchday: number
  totalMatches: number
  totalCost: number
  designations: {
    personId: string
    role: 'arbitro' | 'anotador'
    travelCost: number
    distanceKm: number
    venueMunicipalityId: string
  }[]
}

export const mockHistoricalMatchdays: HistoricalMatchday[] = [
  {
    matchday: 13,
    totalMatches: 8,
    totalCost: 18.5,
    designations: [
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 1.3,
        distanceKm: 13,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-003',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 1.2,
        distanceKm: 12,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 1.5,
        distanceKm: 15,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-004',
        role: 'anotador',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 0.6,
        distanceKm: 6,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-008',
        role: 'anotador',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-009',
        role: 'anotador',
        travelCost: 1.8,
        distanceKm: 18,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 2.5,
        distanceKm: 25,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 2.0,
        distanceKm: 20,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 0.9,
        distanceKm: 9,
        venueMunicipalityId: 'muni-006',
      },
    ],
  },
  {
    matchday: 14,
    totalMatches: 9,
    totalCost: 22.3,
    designations: [
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 1.1,
        distanceKm: 11,
        venueMunicipalityId: 'muni-004',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-003',
        role: 'arbitro',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-005',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 2.0,
        distanceKm: 20,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 2.5,
        distanceKm: 25,
        venueMunicipalityId: 'muni-005',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 1.5,
        distanceKm: 15,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-003',
        role: 'arbitro',
        travelCost: 0.8,
        distanceKm: 8,
        venueMunicipalityId: 'muni-004',
      },
      {
        personId: 'person-004',
        role: 'anotador',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 1.4,
        distanceKm: 14,
        venueMunicipalityId: 'muni-005',
      },
      {
        personId: 'person-008',
        role: 'anotador',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-009',
        role: 'anotador',
        travelCost: 0.8,
        distanceKm: 8,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 1.4,
        distanceKm: 14,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-004',
        role: 'anotador',
        travelCost: 0.6,
        distanceKm: 6,
        venueMunicipalityId: 'muni-004',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 0.9,
        distanceKm: 9,
        venueMunicipalityId: 'muni-006',
      },
    ],
  },
]

// ── Snapshots iniciales para reset ────────────────────────────────────────

const INITIAL_MATCHES = [...mockMatches]
const INITIAL_PERSONS = [...mockPersons]
const INITIAL_DESIGNATIONS: MockDesignation[] = [...mockDesignations]
const INITIAL_AVAILABILITIES = [...mockAvailabilities]
const INITIAL_INCOMPATIBILITIES = [...mockIncompatibilities]

export function resetMockData() {
  mockMatches.length = 0
  mockMatches.push(...INITIAL_MATCHES)
  mockPersons.length = 0
  mockPersons.push(...INITIAL_PERSONS)
  mockDesignations.length = 0
  mockDesignations.push(...INITIAL_DESIGNATIONS)
  mockAvailabilities.length = 0
  mockAvailabilities.push(...INITIAL_AVAILABILITIES)
  mockIncompatibilities.length = 0
  mockIncompatibilities.push(...INITIAL_INCOMPATIBILITIES)
}

// ── Exports para generación demo ──────────────────────────────────────────

export { nextSaturday, nextSunday, weekStart, nextWeek, formatLocalDate }

// Usuario demo por defecto (Carlos Martínez)
export const DEMO_PERSON_ID = 'person-001'
