// Capa client-safe de mock-data: SOLO lo que puede viajar al bundle de cliente.
//
// `mock-data.ts` importa estáticamente `fbm-calendar/fbm-seed.json`, que con el
// calendario real de temporada pesa ~10 MB. Cualquier componente `'use client'`
// que importe un helper de `mock-data` arrastra el módulo entero y, con él, el
// seed: medido en un build de producción, el seed acababa en un chunk
// COMPARTIDO de 9,65 MB que cargaban 5 rutas (asignacion, partidos, personal,
// designaciones, disponibilidad).
//
// Regla: este módulo NO puede importar `mock-data.ts` ni el seed, ni nada que
// dependa de partidos/designaciones/disponibilidades. Solo funciones puras y
// catálogos que no crecen con el calendario. `mock-data.ts` reexporta todo lo
// de aquí, así que los consumidores de servidor no se enteran del corte.
//
// Si un componente cliente necesita un dato que depende del calendario (coste
// de desplazamiento real, disponibilidad, solapamientos), ese valor debe venir
// del `fetch` de la API, no de un import.

// ── Store compartido en globalThis (ver cabecera de mock-data.ts) ───────────
//
// Misma instancia de `globalThis.__fbmMockStore` que usa `mock-data.ts`: cada
// módulo respalda con `??=` únicamente las claves que le pertenecen, así que
// las dos evaluaciones conviven sobre el mismo objeto sin pisarse.
interface FbmClientMockStore {
  courts?: MockCourt[]
}

const __fbmGlobal = globalThis as unknown as { __fbmMockStore?: FbmClientMockStore }
const __fbmStore: FbmClientMockStore = (__fbmGlobal.__fbmMockStore ??= {})

// ── Helpers de fecha ────────────────────────────────────────────────────────

export function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const nextSaturday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return formatLocalDate(d)
})()

export const nextSunday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay() + 7) % 7 || 7))
  return formatLocalDate(d)
})()

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

export const weekStart = getCurrentWeekStart()
export const nextWeek = getNextWeekStart()

// ── Pistas ──────────────────────────────────────────────────────────────────
// Catálogo fijo de 3 pistas: no crece con el calendario, así que puede viajar
// al cliente. `getMockCourt` lo consumen designation-card y match-detail-row.

export interface MockCourt {
  id: string
  venueId: string
  name: string
}

export const mockCourts: MockCourt[] = (__fbmStore.courts ??= [
  { id: 'court-001', venueId: 'venue-001', name: 'Pista 1' },
  { id: 'court-002', venueId: 'venue-001', name: 'Pista 2' },
  { id: 'court-003', venueId: 'venue-007', name: 'Pista Central' },
])

export function getMockCourt(courtId: string | null | undefined) {
  if (!courtId) return undefined
  return mockCourts.find((c) => c.id === courtId)
}

// ── Tipos de disponibilidad y designación ──────────────────────────────────
// Declaraciones puras (sin datos): viven aquí para que los módulos alcanzables
// desde cliente (matchday-availability, schedule-conflicts, formularios del
// portal) no tengan que nombrar a mock-data ni siquiera en un `import type`.

export type DesignationStatus = 'pending' | 'notified' | 'completed'

export interface AvailabilitySlot {
  personId: string
  weekStart: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface MatchdayAvailability {
  id: string
  personId: string
  saturdayDate: string // ISO YYYY-MM-DD, sabado de la jornada
  saturdayMorning: boolean
  saturdayAfternoon: boolean
  sundayMorning: boolean
  sundayAfternoon: boolean
  weekdayDays: number[] // 0=lunes..4=viernes, franja alta 17:30-22:00
  notes: string | null
  updatedAt: string
}

// ── Usuario demo por defecto (Carlos Martínez) ──────────────────────────────

export const DEMO_PERSON_ID = 'person-001'
