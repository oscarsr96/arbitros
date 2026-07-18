// Tipos compartidos para el panel de administracion

import type { DesignationPosition } from './designation-positions'
import type { DesignationStatus } from './mock-data'
import type { CompetitionCategory } from './referee-eligibility'

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
  courtId?: string | null
  venue?: {
    id: string
    name: string
    address: string
    municipalityId: string
    postalCode: string
    municipalityName?: string
    district?: string
    metro?: string
    bus?: string
    observations?: string
  }
  court?: {
    id: string
    venueId: string
    name: string
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
    // Categoría fina de la matriz de elegibilidad (T1, tasks/todo-solver-7niveles.md).
    // null/ausente = sin tag → fallback legacy (`meetsMinCategory`, D2).
    fineCategory?: CompetitionCategory | null
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
  // Posición nombrada dentro del rol (Principal/Auxiliar, Anotador/Crono/24").
  // Opcional: las designaciones legacy del piloto no la llevan.
  position?: DesignationPosition
  travelCost: string
  distanceKm: string
  status: DesignationStatus
  notifiedAt: Date | null
  createdAt: Date
  person?: {
    id: string
    name: string
    role: string
    category: string | null
    nick?: string | null
    refereeLevel?: string | null
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
  refereeLevel?: string | null
  nick?: string | null
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

// ── Importación XLSX de jornada ─────────────────────────────────────────────

export interface ParsedXlsxMatch {
  date: string // YYYY-MM-DD (hora local)
  time: string // HH:MM
  venueName: string
  courtName: string | null // null = pista implícita (pabellón sin sufijo)
  district: string
  category: string
  group: string
  homeTeam: string
  awayTeam: string
  refereesNeeded: number
  sheet: string // hoja de origen (SABADO, DOMINGO, ENTRE SEMANA, MOSTOLES...)
}

export interface ParsedCamposVenue {
  district: string
  name: string
  address: string
  metro: string
  bus: string
  observations: string
}

export interface XlsxImportResult {
  matches: ParsedXlsxMatch[]
  camposVenues: ParsedCamposVenue[]
  warnings: string[]
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

// Body aceptado por POST /api/optimize. dateFrom/dateTo acotan el solve a un rango de
// fechas (YYYY-MM-DD); categories acota a las categorías de competición seleccionadas
// (vacío/ausente = todas); partial acota el solve a un único partido+rol (re-optimización
// de un slot concreto) e ignora dateFrom/dateTo y categories.
export interface OptimizeRequestBody {
  costWeight?: number
  balanceWeight?: number
  maxMatchesPerPerson?: number
  forceExisting?: boolean
  numProposals?: number
  dateFrom?: string
  dateTo?: string
  categories?: string[]
  partial?: { matchId: string; role: 'arbitro' | 'anotador' }
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
  // Posición nombrada del slot que cubre (Principal/Auxiliar, Anotador/Crono/24").
  // La rellena el solver (T4); ausente en llamadores que aún no la calculan.
  position?: DesignationPosition
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
