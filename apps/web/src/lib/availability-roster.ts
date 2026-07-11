// ── Generador determinista de disponibilidad de temporada (datos mock) ──────
//
// Genera la disponibilidad de TODA la temporada 2025-26 para cada persona del
// roster (árbitros y anotadores), directamente como slots de `mockAvailabilities`
// (sin pasar por ~28.000 registros matchday intermedios), más una muestra de
// ~40 registros de disponibilidad de jornada (para el badge de notas del picker).
//
// Módulo HOJA: sin imports de `./mock-data` ni `./matchday-availability` (evita
// el ciclo mock-data → availability-roster → matchday-availability → mock-data).
// Recibe `persons` y `matchDates` por parámetro; deriva los sábados de jornada
// internamente (sábado = la propia fecha si ya es sábado, fecha-1 si es domingo).
//
// DETERMINISTA a propósito (mismo patrón que referee-roster.ts): PRNG mulberry32
// sembrado con un hash del `personId`. Sin `Math.random()` ni `Date.now()`/
// `new Date()` sin argumento — mock-data se importa desde componentes cliente y
// cualquier no-determinismo rompe la hidratación SSR.

// ── Tipos (estructuralmente compatibles con los de mock-data.ts, sin import) ─

export interface RosterPerson {
  id: string
}

export interface AvailabilitySlot {
  personId: string
  weekStart: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface GeneratedAvailabilitySlot extends AvailabilitySlot {
  id: string
}

export interface MatchdayAvailability {
  id: string
  personId: string
  saturdayDate: string
  saturdayMorning: boolean
  saturdayAfternoon: boolean
  sundayMorning: boolean
  sundayAfternoon: boolean
  weekdayDays: number[]
  notes: string | null
  updatedAt: string
}

export interface GenerateSeasonAvailabilityResult {
  slots: GeneratedAvailabilitySlot[]
  matchdayRecords: MatchdayAvailability[]
  // Metadato para tests de distribución (id de arquetipo → nº de personas asignadas).
  archetypeCounts: Record<number, number>
}

// ── Franjas horarias fijas (mismas que matchday-availability.ts; constantes
// LOCALES para no importar ese módulo — ver test anti-drift en
// availability-roster.test.ts) ────────────────────────────────────────────────

export const ROSTER_MORNING = { startTime: '09:00', endTime: '15:30' } as const
export const ROSTER_AFTERNOON = { startTime: '15:30', endTime: '22:00' } as const
export const ROSTER_WEEKDAY_HIGH = { startTime: '17:30', endTime: '22:00' } as const

// ── PRNG determinista (mulberry32, mismo algoritmo que referee-roster.ts) ───

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hash determinista de string (FNV-1a) → semilla numérica por personId.
function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// ── Helpers de fecha (mismo criterio que mock-data.ts/matchday-availability.ts:
// lunes = inicio de semana, sin UTC shift) ──────────────────────────────────

function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatLocalDate(d)
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const jsDay = d.getDay() // 0=domingo..6=sabado
  const diff = d.getDate() - jsDay + (jsDay === 0 ? -6 : 1)
  d.setDate(diff)
  return formatLocalDate(d)
}

// weekday: 0=lunes..4=viernes (misma convención que MatchdayAvailability.weekdayDays).
// Viernes cae en la MISMA semana ISO que el fin de semana; lunes..jueves caen en la
// semana ISO SIGUIENTE (mismo criterio que getMatchdayWindow de matchday-availability.ts).
function weekdayDateForSaturday(saturdayDate: string, weekday: number): string {
  if (weekday === 4) return addDays(saturdayDate, -1)
  return addDays(saturdayDate, 2 + weekday)
}

/**
 * Deriva los sábados de jornada a partir de las fechas de los partidos: sábado =
 * la propia fecha si ya es sábado, fecha-1 si es domingo. Ignora fechas entre
 * semana (no deberían existir en el calendario FBM real, pero no se asume).
 */
function getJornadaSaturdays(matchDates: string[]): string[] {
  const saturdays = new Set<string>()
  for (const date of matchDates) {
    const d = new Date(date + 'T00:00:00')
    const jsDay = d.getDay() // 0=domingo..6=sabado
    if (jsDay === 6) saturdays.add(date)
    else if (jsDay === 0) saturdays.add(addDays(date, -1))
  }
  return [...saturdays].sort()
}

// ── Materialización: registro de jornada (booleanos) → slots horarios ───────

interface RosterRecordCore {
  saturdayDate: string
  saturdayMorning: boolean
  saturdayAfternoon: boolean
  sundayMorning: boolean
  sundayAfternoon: boolean
  weekdayDays: number[]
}

function makeSlot(
  personId: string,
  weekStart: string,
  dayOfWeek: number,
  range: { startTime: string; endTime: string },
): GeneratedAvailabilitySlot {
  return {
    id: `avail-fbm-${personId}-${weekStart}-${dayOfWeek}-${range.startTime}`,
    personId,
    weekStart,
    dayOfWeek,
    startTime: range.startTime,
    endTime: range.endTime,
  }
}

function materializeRecord(
  personId: string,
  record: RosterRecordCore,
): GeneratedAvailabilitySlot[] {
  const slots: GeneratedAvailabilitySlot[] = []
  const weekendWeekStart = mondayOf(record.saturdayDate)

  if (record.saturdayMorning) slots.push(makeSlot(personId, weekendWeekStart, 5, ROSTER_MORNING))
  if (record.saturdayAfternoon)
    slots.push(makeSlot(personId, weekendWeekStart, 5, ROSTER_AFTERNOON))
  if (record.sundayMorning) slots.push(makeSlot(personId, weekendWeekStart, 6, ROSTER_MORNING))
  if (record.sundayAfternoon) slots.push(makeSlot(personId, weekendWeekStart, 6, ROSTER_AFTERNOON))

  for (const weekday of record.weekdayDays) {
    const date = weekdayDateForSaturday(record.saturdayDate, weekday)
    slots.push(makeSlot(personId, mondayOf(date), weekday, ROSTER_WEEKDAY_HIGH))
  }

  return slots
}

function pattern(
  saturdayDate: string,
  saturdayMorning: boolean,
  saturdayAfternoon: boolean,
  sundayMorning: boolean,
  sundayAfternoon: boolean,
  weekdayDays: number[] = [],
): RosterRecordCore {
  return {
    saturdayDate,
    saturdayMorning,
    saturdayAfternoon,
    sundayMorning,
    sundayAfternoon,
    weekdayDays,
  }
}

function fullDay(saturdayDate: string): RosterRecordCore {
  return pattern(saturdayDate, true, true, true, true)
}

// Elige `count` índices distintos de [0, poolSize) de forma determinista.
function pickDistinctIndices(rand: () => number, poolSize: number, count: number): number[] {
  const n = Math.min(count, poolSize)
  const chosen = new Set<number>()
  while (chosen.size < n) {
    chosen.add(Math.floor(rand() * poolSize))
  }
  return [...chosen]
}

type TardeSlot = 'saturdayAfternoon' | 'sundayAfternoon'
type MananaSlot = 'saturdayMorning' | 'sundayMorning'

// Arquetipo 10 (Esporádico): elige `count` franjas (1-2) con sesgo tarde 70%.
function pickEsporadicoSlots(
  rand: () => number,
  count: number,
): Pick<
  RosterRecordCore,
  'saturdayMorning' | 'saturdayAfternoon' | 'sundayMorning' | 'sundayAfternoon'
> {
  const flags = {
    saturdayMorning: false,
    saturdayAfternoon: false,
    sundayMorning: false,
    sundayAfternoon: false,
  }
  const chosen = new Set<TardeSlot | MananaSlot>()
  while (chosen.size < count) {
    const isTarde = rand() < 0.7
    const pool: (TardeSlot | MananaSlot)[] = isTarde
      ? ['saturdayAfternoon', 'sundayAfternoon']
      : ['saturdayMorning', 'sundayMorning']
    chosen.add(pool[Math.floor(rand() * pool.length)])
  }
  for (const c of chosen) flags[c] = true
  return flags
}

// ── Los 12 arquetipos (pesos que suman 100) ─────────────────────────────────

interface Archetype {
  id: number
  name: string
  weight: number
  generate: (saturdays: string[], rand: () => number) => RosterRecordCore[]
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 1,
    name: 'Todoterreno',
    weight: 10,
    generate: (saturdays, rand) => saturdays.filter(() => rand() < 0.95).map(fullDay),
  },
  {
    id: 2,
    name: 'Finde de tarde',
    weight: 18,
    generate: (saturdays, rand) =>
      saturdays.filter(() => rand() < 0.9).map((sd) => pattern(sd, false, true, false, true)),
  },
  {
    id: 3,
    name: 'Sábado completo',
    weight: 10,
    generate: (saturdays, rand) =>
      saturdays.filter(() => rand() < 0.9).map((sd) => pattern(sd, true, true, false, false)),
  },
  {
    id: 4,
    name: 'Domingo completo',
    weight: 8,
    generate: (saturdays, rand) =>
      saturdays.filter(() => rand() < 0.9).map((sd) => pattern(sd, false, false, true, true)),
  },
  {
    id: 5,
    name: 'Solo sábado tarde',
    weight: 12,
    generate: (saturdays, rand) =>
      saturdays.filter(() => rand() < 0.85).map((sd) => pattern(sd, false, true, false, false)),
  },
  {
    id: 6,
    name: 'Solo domingo tarde',
    weight: 8,
    generate: (saturdays, rand) =>
      saturdays.filter(() => rand() < 0.85).map((sd) => pattern(sd, false, false, false, true)),
  },
  {
    id: 7,
    name: 'Mañanas',
    weight: 6,
    generate: (saturdays, rand) =>
      saturdays.filter(() => rand() < 0.85).map((sd) => pattern(sd, true, false, true, false)),
  },
  {
    id: 8,
    name: 'Alterno quincenal',
    weight: 8,
    generate: (saturdays, rand) => {
      const offset = rand() < 0.5 ? 0 : 1
      return saturdays.filter((_, i) => (i + offset) % 2 === 0).map(fullDay)
    },
  },
  {
    id: 9,
    name: 'Media temporada',
    weight: 6,
    generate: (saturdays, rand) => {
      const mid = Math.ceil(saturdays.length / 2)
      const half = rand() < 0.5 ? saturdays.slice(0, mid) : saturdays.slice(mid)
      return half.filter(() => rand() < 0.9).map((sd) => pattern(sd, false, true, false, true))
    },
  },
  {
    id: 10,
    name: 'Esporádico',
    weight: 8,
    generate: (saturdays, rand) => {
      const records: RosterRecordCore[] = []
      for (const sd of saturdays) {
        if (rand() >= 0.4) continue
        const count = rand() < 0.5 ? 1 : 2
        const slots = pickEsporadicoSlots(rand, count)
        records.push({ saturdayDate: sd, ...slots, weekdayDays: [] })
      }
      return records
    },
  },
  {
    id: 11,
    name: 'Entre semana + finde tarde',
    weight: 4,
    generate: (saturdays, rand) => {
      const records: RosterRecordCore[] = []
      for (const sd of saturdays) {
        if (rand() >= 0.85) continue
        const wdCount = 1 + Math.floor(rand() * 3) // 1..3
        const wdIndices = pickDistinctIndices(rand, 5, wdCount)
        records.push(pattern(sd, false, true, false, true, wdIndices))
      }
      return records
    },
  },
  {
    id: 12,
    name: 'Fantasma',
    weight: 2,
    generate: (saturdays, rand) => {
      if (saturdays.length === 0) return []
      const count = rand() < 0.5 ? 2 : 3
      const indices = pickDistinctIndices(rand, saturdays.length, count)
      return indices.map((i) => pattern(saturdays[i], false, true, false, true))
    },
  },
]

const TOTAL_WEIGHT = ARCHETYPES.reduce((sum, a) => sum + a.weight, 0) // = 100

function pickArchetypeId(rand: () => number): number {
  const r = rand() * TOTAL_WEIGHT
  let cumulative = 0
  for (const a of ARCHETYPES) {
    cumulative += a.weight
    if (r < cumulative) return a.id
  }
  return ARCHETYPES[ARCHETYPES.length - 1].id
}

const ARCHETYPES_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]))

// Los 9 demo (person-001..009) reciben arquetipos fijos hand-picked variados
// (predecibilidad del demo), cubriendo un espectro amplio (todoterreno, tarde,
// alterno quincenal, esporádico, entre-semana, fantasma...).
const DEMO_ARCHETYPE_OVERRIDES: Record<string, number> = {
  'person-001': 1, // Todoterreno
  'person-002': 2, // Finde de tarde
  'person-003': 5, // Solo sábado tarde
  'person-004': 8, // Alterno quincenal
  'person-005': 10, // Esporádico
  'person-006': 3, // Sábado completo
  'person-007': 11, // Entre semana + finde tarde
  'person-008': 7, // Mañanas
  'person-009': 12, // Fantasma
}

// ── Pool de notas para la muestra de registros matchday (~12 textos) ───────

const NOTES_POOL = [
  'Solo disponible por la tarde esta jornada.',
  'Fuera de viaje el sábado, disponible el domingo.',
  'Coincide con guardia de trabajo el domingo.',
  'Disponible también entre semana si hace falta.',
  'Prefiero partidos cercanos a mi municipio.',
  'Jornada de exámenes, disponibilidad reducida.',
  'Vuelvo de vacaciones, disponibilidad limitada.',
  'Solo mañanas por compromiso familiar por la tarde.',
  'Sin coche esta semana, mejor partidos cercanos.',
  'Disponible todo el fin de semana sin restricciones.',
  'Aviso con antelación si hay cambios de horario.',
  'Posible sustitución de última hora, confirmar antes.',
]

// Timestamp fijo (sin Date.now()) + offset determinista por muestra.
const MATCHDAY_SAMPLE_BASE_MS = Date.parse('2025-09-01T09:00:00.000Z')
const MATCHDAY_SAMPLE_TARGET = 40

function sampleMatchdayRecords(
  allPairs: { personId: string; record: RosterRecordCore }[],
): MatchdayAvailability[] {
  if (allPairs.length === 0) return []
  const step = Math.max(1, Math.floor(allPairs.length / MATCHDAY_SAMPLE_TARGET))

  const result: MatchdayAvailability[] = []
  let sampleIndex = 0
  let pairIndex = 0
  while (pairIndex < allPairs.length && result.length < MATCHDAY_SAMPLE_TARGET) {
    const { personId, record } = allPairs[pairIndex]
    result.push({
      id: `matchday-fbm-${personId}-${record.saturdayDate}`,
      personId,
      saturdayDate: record.saturdayDate,
      saturdayMorning: record.saturdayMorning,
      saturdayAfternoon: record.saturdayAfternoon,
      sundayMorning: record.sundayMorning,
      sundayAfternoon: record.sundayAfternoon,
      weekdayDays: record.weekdayDays,
      notes: NOTES_POOL[sampleIndex % NOTES_POOL.length],
      updatedAt: new Date(MATCHDAY_SAMPLE_BASE_MS + sampleIndex * 3_600_000).toISOString(),
    })
    sampleIndex++
    pairIndex += step
  }
  return result
}

// ── Generador principal ─────────────────────────────────────────────────────

/**
 * Genera la disponibilidad de temporada completa para `persons` sobre las
 * jornadas derivadas de `matchDates`. Determinista: dos invocaciones con los
 * mismos argumentos devuelven un resultado idéntico (deep equal).
 */
export function generateSeasonAvailability(
  persons: RosterPerson[],
  matchDates: string[],
): GenerateSeasonAvailabilityResult {
  const saturdays = getJornadaSaturdays(matchDates)
  const slots: GeneratedAvailabilitySlot[] = []
  const archetypeCounts: Record<number, number> = {}
  const allPairs: { personId: string; record: RosterRecordCore }[] = []

  for (const person of persons) {
    const rand = mulberry32(hashString(person.id))
    const archetypeId = DEMO_ARCHETYPE_OVERRIDES[person.id] ?? pickArchetypeId(rand)
    archetypeCounts[archetypeId] = (archetypeCounts[archetypeId] ?? 0) + 1

    const archetype = ARCHETYPES_BY_ID.get(archetypeId)
    if (!archetype) continue

    let records = archetype.generate(saturdays, rand)

    // Toda persona tiene ALGUNA disponibilidad en la temporada: failsafe
    // determinista (sin aleatoriedad) si el arquetipo no produjo nada.
    if (records.length === 0 && saturdays.length > 0) {
      records = [pattern(saturdays[Math.floor(saturdays.length / 2)], false, true, false, false)]
    }

    for (const record of records) {
      slots.push(...materializeRecord(person.id, record))
      allPairs.push({ personId: person.id, record })
    }
  }

  const matchdayRecords = sampleMatchdayRecords(allPairs)

  return { slots, matchdayRecords, archetypeCounts }
}
