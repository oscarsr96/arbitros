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
  venue?: {
    id: string
    name: string
    address: string
    municipalityId: string
    postalCode: string
    municipalityName?: string
  }
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
  createdAt: Date
  person?: {
    id: string
    name: string
    role: string
    category: string | null
    municipalityId: string
    hasCar: boolean
    address: string
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
  hasCar: boolean
  municipality?: { id: string; name: string }
  matchesAssigned: number
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

// ── Solver types ────────────────────────────────────────────────────────────

export interface SolverParameters {
  costWeight: number // α — peso coste desplazamiento (0-1)
  balanceWeight: number // β — peso equilibrio carga (0-1)
  maxMatchesPerPerson: number
  forceExisting: boolean // no mover asignaciones manuales existentes
  numProposals: number // numero de ejecuciones independientes del solver (1-5)
}

export interface SolverInput {
  matches: EnrichedMatch[]
  persons: EnrichedPerson[]
  parameters: SolverParameters
}

export interface ProposedAssignment {
  matchId: string
  personId: string
  personName: string
  role: 'arbitro' | 'anotador'
  travelCost: number
  distanceKm: number
  isNew: boolean // true si es nueva, false si ya existía
  municipalityName: string
}

export interface UnassignedSlot {
  matchId: string
  matchLabel: string
  role: 'arbitro' | 'anotador'
  slotIndex: number
  reason: string
}

export interface SolverMetrics {
  totalCost: number
  coverage: number // 0-100
  coveredSlots: number
  totalSlots: number
  resolutionTimeMs: number
}

export interface SolverOutput {
  status: 'optimal' | 'feasible' | 'partial' | 'no_solution'
  assignments: ProposedAssignment[]
  metrics: SolverMetrics
  unassigned: UnassignedSlot[]
}

export interface Proposal {
  id: string
  label: string
  status: SolverOutput['status']
  assignments: ProposedAssignment[]
  metrics: SolverMetrics
  unassigned: UnassignedSlot[]
}

export type OptimizationState = 'idle' | 'running' | 'done' | 'error'
