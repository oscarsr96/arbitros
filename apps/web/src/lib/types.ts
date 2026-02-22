// Tipos compartidos para el panel de administracion

export interface EnrichedMatch {
  id: string
  date: string
  time: string
  venueId: string
  competitionId: string
  homeTeam: string
  awayTeam: string
  refereesNeeded: number
  scorersNeeded: number
  status: string
  seasonId: string
  matchday: number
  venue?: { id: string; name: string; address: string; municipalityId: string; postalCode: string }
  competition?: {
    id: string
    name: string
    category: string
    gender: string
    refereesNeeded: number
    scorersNeeded: number
    minRefCategory: string
    seasonId: string
  }
  designations: EnrichedDesignation[]
  refereesAssigned: number
  scorersAssigned: number
  isCovered: boolean
}

export interface EnrichedDesignation {
  id: string
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  travelCost: string
  distanceKm: string
  status: string
  notifiedAt: Date | null
  confirmedAt: Date | null
  createdAt: Date
  person?: {
    id: string
    name: string
    role: string
    category: string | null
    municipalityId: string
  }
  municipality?: { id: string; name: string }
}

export interface EnrichedPerson {
  id: string
  name: string
  email: string
  phone: string
  role: 'arbitro' | 'anotador'
  category: string | null
  address: string
  postalCode: string
  municipalityId: string
  active: boolean
  municipality?: { id: string; name: string }
  matchesAssigned: number
  matchesConfirmed: number
  totalCost: number
  hasAvailability: boolean
}

export interface DashboardStats {
  totalMatches: number
  coveredMatches: number
  partiallyCovered: number
  uncoveredMatches: number
  totalReferees: number
  totalScorers: number
  refereesAvailable: number
  scorersAvailable: number
  estimatedCost: number
  confirmationRate: number
}

export interface DashboardAlert {
  type: 'error' | 'warning' | 'info'
  message: string
  link?: string
}

export interface AssignmentValidation {
  valid: boolean
  reason?: string
}

export interface CSVMatchRow {
  fecha: string
  hora: string
  pabellon: string
  equipo_local: string
  equipo_visitante: string
  competicion: string
  jornada: string
}
