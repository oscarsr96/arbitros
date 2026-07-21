// Arnés PERMANENTE de rendimiento y equivalencia del solver. Demuestra que
// una optimización de rendimiento en solver.ts no cambia ni una sola
// asignación producida. Dos piezas:
//
// 1. "barrido de escala" — mide ms de solve() en tamaños crecientes hasta el
//    pico real de producción (1309 partidos x 1279 personas). El caso más
//    grande tarda minutos, así que solo corre con BENCH=1:
//      BENCH=1 pnpm vitest run src/lib/__tests__/solver.bench.test.ts
//
// 2. "equivalencia de salida" — compara el fingerprint() de solve() contra
//    la baseline COMMITEADA en __fixtures__/solver-fingerprint-baseline.json.
//    Corre siempre, sin variables de entorno (casos 200x120 en la suite
//    normal; los de 400x240, ~15s cada uno, se añaden solo con BENCH=1). Si
//    el fingerprint no coincide con la baseline, el test FALLA: es la señal
//    de que un cambio movió una asignación real, no solo un tiempo. Nunca se
//    regenera en silencio.
//
//    Para regenerar la baseline (solo tras confirmar que el cambio de
//    asignaciones es intencional, sobre árbol limpio):
//      UPDATE_BASELINE=1 pnpm vitest run src/lib/__tests__/solver.bench.test.ts
//
// Reutiliza la cabecera de mocks de solver.test.ts, pero con la MISMA
// complejidad algoritmica que mock-data.ts real (indice de disponibilidad
// O(1), distancias en Map) para que las medidas reflejen produccion.

import { describe, it, expect, vi } from 'vitest'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SolverInput, EnrichedMatch, EnrichedPerson } from '../types'
import type { DesignationPosition } from '../designation-positions'
import type { CompetitionCategory, RefereeLevel } from '../referee-eligibility'

// ── Estado mockeado ────────────────────────────────────────────────────────

interface Avail {
  id: string
  personId: string
  weekStart: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

const mockAvailabilities: Avail[] = []
const mockIncompatibilities: { id: string; personId: string; teamName: string; reason: string }[] =
  []
const mockDesignations: {
  id: string
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  position?: DesignationPosition
  travelCost: string
  distanceKm: string
  status: string
  notifiedAt: Date | null
  createdAt: Date
}[] = []
const mockMatches: { id: string; date: string; time: string; venueId?: string }[] = []

const municipalityNames = new Map<string, string>()
const venueMuni = new Map<string, string>()
const distances = new Map<string, number>()

// ── Mock con la complejidad de produccion ──────────────────────────────────

function toMinutesOfDay(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const dateInfoCache = new Map<string, { dayOfWeek: number; weekStart: string }>()
function getDateInfo(date: string): { dayOfWeek: number; weekStart: string } {
  let info = dateInfoCache.get(date)
  if (!info) {
    const d = new Date(date + 'T00:00:00')
    const jsDay = d.getDay()
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
    d.setDate(d.getDate() - jsDay + (jsDay === 0 ? -6 : 1))
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    info = { dayOfWeek, weekStart: `${y}-${mo}-${da}` }
    dateInfoCache.set(date, info)
  }
  return info
}

let availabilityIndex: Map<string, Avail[]> | null = null
let availabilityIndexLength = -1
function getAvailabilityIndex(): Map<string, Avail[]> {
  if (availabilityIndex === null || availabilityIndexLength !== mockAvailabilities.length) {
    const index = new Map<string, Avail[]>()
    for (const a of mockAvailabilities) {
      const key = `${a.personId}|${a.weekStart}|${a.dayOfWeek}`
      const list = index.get(key)
      if (list) list.push(a)
      else index.set(key, [a])
    }
    availabilityIndex = index
    availabilityIndexLength = mockAvailabilities.length
  }
  return availabilityIndex
}

const NO_AVAIL: Avail[] = []
function localIsPersonAvailable(personId: string, date: string, time: string): boolean {
  const { dayOfWeek, weekStart } = getDateInfo(date)
  const avails = getAvailabilityIndex().get(`${personId}|${weekStart}|${dayOfWeek}`) ?? NO_AVAIL
  const matchMin = toMinutesOfDay(time)
  for (let i = 0; i < avails.length; i++) {
    const a = avails[i]
    if (matchMin >= toMinutesOfDay(a.startTime) && matchMin < toMinutesOfDay(a.endTime)) return true
  }
  return false
}

function localGetMockDistance(originId: string, destId: string): number {
  if (originId === destId) return 0
  return distances.get(`${originId}|${destId}`) ?? 35
}

function localCalculateDailyTravelCost(
  personMuniId: string,
  venueMunicipalityIds: string[],
): { cost: number; km: number } {
  if (venueMunicipalityIds.length === 0) return { cost: 0, km: 0 }
  const awayMunis = [...new Set(venueMunicipalityIds)].filter((id) => id !== personMuniId)
  if (awayMunis.length > 0) {
    const km = awayMunis.reduce(
      (sum, destId) => sum + localGetMockDistance(personMuniId, destId),
      0,
    )
    return { cost: Number((km * 0.26).toFixed(2)), km: Number(km.toFixed(1)) }
  }
  return {
    cost: municipalityNames.get(personMuniId)?.toLowerCase() === 'madrid' ? 3 : 2,
    km: 0,
  }
}

vi.mock('../mock-data', () => ({
  get mockAvailabilities() {
    return mockAvailabilities
  },
  get mockIncompatibilities() {
    return mockIncompatibilities
  },
  get mockDesignations() {
    return mockDesignations
  },
  get mockMatches() {
    return mockMatches
  },
  getMockDistance: localGetMockDistance,
  calculateDailyTravelCost: localCalculateDailyTravelCost,
  getMockMunicipality: (id: string) =>
    municipalityNames.has(id) ? { id, name: municipalityNames.get(id) } : undefined,
  getMockVenue: (venueId?: string) =>
    venueId && venueMuni.has(venueId)
      ? { id: venueId, municipalityId: venueMuni.get(venueId) }
      : undefined,
  isPersonAvailable: localIsPersonAvailable,
}))

import { solve } from '../solver'

// ── Generador determinista ─────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const N_MUNIS = 180
const N_VENUES = 400
// Jornada FBM viernes -> jueves.
const DATES = [
  '2026-03-06', // vie
  '2026-03-07', // sab
  '2026-03-08', // dom
  '2026-03-09', // lun
  '2026-03-10', // mar
  '2026-03-11', // mie
  '2026-03-12', // jue
]
const DATE_WEIGHTS = [0.08, 0.45, 0.33, 0.03, 0.03, 0.04, 0.04]
const TIMES: string[] = []
for (let h = 9; h <= 21; h++) {
  TIMES.push(`${String(h).padStart(2, '0')}:00`)
  TIMES.push(`${String(h).padStart(2, '0')}:30`)
}

const FINE_CATEGORIES: CompetitionCategory[] = [
  'nacional',
  'primera_aut_oro',
  'primera_aut_plata',
  'primera_aut_fem',
  'segunda_aut_oro',
  'segunda_aut_plata',
  'segunda_aut_bronce',
  'junior_pref',
  'junior_especial_oro',
  'junior_especial_plata',
  'junior_especial_bronce',
  'sub22_oro',
  'sub22_plata',
  'sub22_bronce',
  'cadete_pref',
  'infantil_pref',
  'minibasket',
]
// Peso ~ frecuencia real: escuela domina el calendario.
const FINE_WEIGHTS = [
  0.02, 0.02, 0.02, 0.02, 0.04, 0.06, 0.07, 0.09, 0.03, 0.05, 0.05, 0.03, 0.05, 0.05, 0.13, 0.13,
  0.14,
]

const LEVELS: RefereeLevel[] = [
  'nacional',
  'feb',
  'primera_aut',
  'autonomico_oro',
  'autonomico_plata',
  'autonomico_bronce',
  'escuela',
]
const LEVEL_COUNTS = [60, 40, 70, 50, 100, 150, 300] // suma 770
const LEGACY_BY_LEVEL: Record<RefereeLevel, string> = {
  nacional: 'nacional',
  feb: 'feb',
  primera_aut: 'autonomico',
  autonomico_oro: 'autonomico',
  autonomico_plata: 'autonomico',
  autonomico_bronce: 'autonomico',
  escuela: 'provincial',
}

function pickWeighted<T>(items: T[], weights: number[], r: number): T {
  let acc = 0
  for (let i = 0; i < items.length; i++) {
    acc += weights[i]
    if (r < acc) return items[i]
  }
  return items[items.length - 1]
}

function weekStartOf(date: string): string {
  return getDateInfo(date).weekStart
}

/** Rellena el estado mockeado y devuelve el SolverInput. Determinista. */
function buildScenario(nMatches: number, nPersons: number): SolverInput {
  mockAvailabilities.length = 0
  mockIncompatibilities.length = 0
  mockDesignations.length = 0
  mockMatches.length = 0
  municipalityNames.clear()
  venueMuni.clear()
  distances.clear()
  availabilityIndex = null
  availabilityIndexLength = -1

  const rnd = mulberry32(20260721)

  // Municipios: muni-0 es Madrid (destino y origen dominante).
  for (let i = 0; i < N_MUNIS; i++) {
    municipalityNames.set(`muni-${i}`, i === 0 ? 'Madrid' : `Municipio ${i}`)
  }
  // Matriz de distancias simetrica y determinista (2..56 km).
  for (let i = 0; i < N_MUNIS; i++) {
    for (let j = 0; j < N_MUNIS; j++) {
      if (i === j) continue
      const lo = Math.min(i, j)
      const hi = Math.max(i, j)
      distances.set(`muni-${i}|muni-${j}`, ((lo * 31 + hi * 17) % 55) + 2)
    }
  }
  for (let v = 0; v < N_VENUES; v++) {
    // 35% de los pabellones en Madrid capital.
    venueMuni.set(
      `v-${v}`,
      rnd() < 0.35 ? 'muni-0' : `muni-${1 + Math.floor(rnd() * (N_MUNIS - 1))}`,
    )
  }

  // ── Personas ──
  const nReferees = Math.max(1, Math.round((nPersons * 770) / 1279))
  const nScorers = Math.max(1, nPersons - nReferees)
  const persons: EnrichedPerson[] = []

  // Reparto de niveles proporcional a LEVEL_COUNTS.
  const totalLevelWeight = LEVEL_COUNTS.reduce((a, b) => a + b, 0)
  const levelPool: RefereeLevel[] = []
  for (let i = 0; i < LEVELS.length; i++) {
    const n = Math.max(1, Math.round((LEVEL_COUNTS[i] / totalLevelWeight) * nReferees))
    for (let k = 0; k < n; k++) levelPool.push(LEVELS[i])
  }

  for (let i = 0; i < nReferees; i++) {
    const level = levelPool[i % levelPool.length]
    persons.push({
      id: `ref-${i}`,
      name: `Referee ${i}`,
      email: `ref${i}@test.com`,
      phone: '600000000',
      role: 'arbitro',
      category: LEGACY_BY_LEVEL[level],
      refereeLevel: level,
      address: '',
      postalCode: '',
      // 40% viven en Madrid capital.
      municipalityId: rnd() < 0.4 ? 'muni-0' : `muni-${1 + Math.floor(rnd() * (N_MUNIS - 1))}`,
      active: rnd() < 0.97,
      hasCar: rnd() < 0.85,
      matchesAssigned: 0,
      totalCost: 0,
      hasAvailability: true,
    })
  }
  for (let i = 0; i < nScorers; i++) {
    persons.push({
      id: `sco-${i}`,
      name: `Scorer ${i}`,
      email: `sco${i}@test.com`,
      phone: '600000000',
      role: 'anotador',
      category: null,
      address: '',
      postalCode: '',
      municipalityId: rnd() < 0.45 ? 'muni-0' : `muni-${1 + Math.floor(rnd() * (N_MUNIS - 1))}`,
      active: rnd() < 0.97,
      hasCar: rnd() < 0.8,
      matchesAssigned: 0,
      totalCost: 0,
      hasAvailability: true,
    })
  }

  // ── Disponibilidad: una franja amplia por (persona, dia) con prob. 0.65 ──
  for (const p of persons) {
    for (let d = 0; d < DATES.length; d++) {
      if (rnd() > 0.65) continue
      const { dayOfWeek } = getDateInfo(DATES[d])
      mockAvailabilities.push({
        id: `av-${mockAvailabilities.length}`,
        personId: p.id,
        weekStart: weekStartOf(DATES[d]),
        dayOfWeek,
        startTime: rnd() < 0.5 ? '09:00' : '15:00',
        endTime: '22:00',
      })
    }
  }

  // ── Incompatibilidades: 8% de personas, 1 club ──
  for (const p of persons) {
    if (rnd() < 0.08) {
      mockIncompatibilities.push({
        id: `inc-${mockIncompatibilities.length}`,
        personId: p.id,
        teamName: `CLUB-${Math.floor(rnd() * 200)}`,
        reason: 'socio',
      })
    }
  }

  // ── Partidos ──
  const matches: EnrichedMatch[] = []
  for (let i = 0; i < nMatches; i++) {
    const date = pickWeighted(DATES, DATE_WEIGHTS, rnd())
    const time = TIMES[Math.floor(rnd() * TIMES.length)]
    const venueId = `v-${Math.floor(rnd() * N_VENUES)}`
    const fine = pickWeighted(FINE_CATEGORIES, FINE_WEIGHTS, rnd())
    // 25% de partidos sin categoria fina -> fallback legacy.
    const hasFine = rnd() < 0.75
    const minRef =
      fine === 'nacional'
        ? 'nacional'
        : fine.startsWith('primera_aut') || fine.startsWith('segunda_aut')
          ? 'autonomico'
          : 'provincial'
    matches.push({
      id: `m-${i}`,
      date,
      time,
      venueId,
      competitionId: `c-${fine}`,
      homeTeam: `CLUB-${Math.floor(rnd() * 200)} A`,
      awayTeam: `CLUB-${Math.floor(rnd() * 200)} B`,
      refereesNeeded: 2,
      scorersNeeded: 2,
      status: 'scheduled',
      seasonId: 's1',
      matchday: 20,
      venue: {
        id: venueId,
        name: `Pabellon ${venueId}`,
        address: '',
        municipalityId: venueMuni.get(venueId)!,
        postalCode: '',
      },
      competition: {
        id: `c-${fine}`,
        name: fine,
        category: fine,
        gender: 'male',
        refereesNeeded: 2,
        scorersNeeded: 2,
        minRefCategory: minRef,
        seasonId: 's1',
        fineCategory: hasFine ? fine : null,
      },
      designations: [],
      refereesAssigned: 0,
      scorersAssigned: 0,
      isCovered: false,
    })
    mockMatches.push({ id: `m-${i}`, date, time, venueId })
  }

  return {
    matches,
    persons,
    parameters: {
      costWeight: 0.7,
      balanceWeight: 0.3,
      maxMatchesPerPerson: 3,
      forceExisting: false,
      numProposals: 1,
    },
  }
}

// ── Fingerprint para equivalencia ──────────────────────────────────────────

function fingerprint(out: ReturnType<typeof solve>) {
  return {
    status: out.status,
    metrics: { ...out.metrics, resolutionTimeMs: 0 },
    assignments: out.assignments.map(
      (a) =>
        `${a.matchId}|${a.personId}|${a.role}|${a.position ?? '-'}|${a.travelCost}|${a.distanceKm}|${a.isNew ? 1 : 0}`,
    ),
    unassigned: out.unassigned.map((u) => `${u.matchId}|${u.role}|${u.slotIndex}|${u.reason}`),
  }
}

// Directorio de volcado para inspección manual (p.ej. comparar a ojo dos
// ejecuciones con BENCH_LABEL distinto). NO es la garantía del test: la
// garantía es solo la baseline commiteada en __fixtures__, comparada abajo.
const BENCH_DIR = process.env.BENCH_DIR ?? os.tmpdir()
const LABEL = process.env.BENCH_LABEL ?? 'run'

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__')
const BASELINE_FILE = path.join(FIXTURES_DIR, 'solver-fingerprint-baseline.json')

// ── Suites ─────────────────────────────────────────────────────────────────

const SIZES: [number, number][] = [
  [50, 30],
  [100, 60],
  [200, 120],
  [400, 240],
  [800, 480],
  [1309, 1279],
]

/** Compara dos fingerprints y devuelve las diferencias legibles (vacio = iguales). */
function diffFingerprints(
  expected: ReturnType<typeof fingerprint>,
  actual: ReturnType<typeof fingerprint>,
): string[] {
  const diffs: string[] = []
  if (expected.status !== actual.status) {
    diffs.push(`status: ${expected.status} -> ${actual.status}`)
  }
  if (JSON.stringify(expected.metrics) !== JSON.stringify(actual.metrics)) {
    diffs.push(`metrics: ${JSON.stringify(expected.metrics)} -> ${JSON.stringify(actual.metrics)}`)
  }
  const maxA = Math.max(expected.assignments.length, actual.assignments.length)
  for (let i = 0; i < maxA; i++) {
    if (expected.assignments[i] !== actual.assignments[i]) {
      diffs.push(`assign[${i}]: ${expected.assignments[i]} -> ${actual.assignments[i]}`)
      if (diffs.length > 8) break
    }
  }
  const maxU = Math.max(expected.unassigned.length, actual.unassigned.length)
  for (let i = 0; i < maxU; i++) {
    if (expected.unassigned[i] !== actual.unassigned[i]) {
      diffs.push(`unassigned[${i}]: ${expected.unassigned[i]} -> ${actual.unassigned[i]}`)
      if (diffs.length > 16) break
    }
  }
  return diffs
}

describe('solver bench', () => {
  // Barrido completo hasta el pico de produccion: minutos de duracion, solo
  // bajo BENCH=1. La suite normal lo salta por completo.
  describe.skipIf(!process.env.BENCH)('barrido de escala (BENCH=1)', () => {
    it('mide ms de solve() por tamaño', () => {
      const rows: string[] = []
      let prev = 0
      for (const [nm, np] of SIZES) {
        const input = buildScenario(nm, np)
        const t0 = performance.now()
        const out = solve(input)
        const ms = performance.now() - t0
        const factor = prev > 0 ? (ms / prev).toFixed(2) + 'x' : '-'
        prev = ms
        rows.push(
          `${String(nm).padStart(6)} x ${String(np).padStart(6)} | ${(ms / 1000).toFixed(2).padStart(8)}s | ${factor.padStart(7)} | cobertura ${out.metrics.coverage}% | coste ${out.metrics.totalCost}`,
        )
      }
      console.log(`\n=== BENCH [${LABEL}] ===\n` + rows.join('\n') + '\n')
    }, 1_800_000)
  })

  it('equivalencia de salida (fingerprint estable vs baseline commiteada)', () => {
    const scenarios: [number, number, number | undefined][] = [
      [200, 120, undefined],
      [200, 120, 1],
    ]
    // Casos grandes (~15s cada uno): solo bajo BENCH, para no inflar la
    // suite normal.
    if (process.env.BENCH) {
      scenarios.push([400, 240, undefined], [400, 240, 7])
    }

    const cases: Record<string, ReturnType<typeof fingerprint>> = {}
    for (const [nm, np, seed] of scenarios) {
      const input = buildScenario(nm, np)
      const out = seed === undefined ? solve(input) : solve(input, seed)
      cases[`${nm}x${np}#${seed ?? 'noseed'}`] = fingerprint(out)
    }

    // Volcado de inspección manual, no forma parte de la garantía.
    const dumpFile = path.join(BENCH_DIR, `solver-fingerprint-${LABEL}.json`)
    writeFileSync(dumpFile, JSON.stringify(cases, null, 2))
    console.log(`fingerprint escrito (inspección manual): ${dumpFile}`)

    if (process.env.UPDATE_BASELINE === '1') {
      mkdirSync(FIXTURES_DIR, { recursive: true })
      writeFileSync(BASELINE_FILE, JSON.stringify(cases, null, 2) + '\n')
      console.log(`Baseline regenerada: ${BASELINE_FILE}`)
      return
    }

    expect(
      existsSync(BASELINE_FILE),
      `Falta la baseline commiteada (${BASELINE_FILE}). Generarla con ` +
        `UPDATE_BASELINE=1 pnpm vitest run src/lib/__tests__/solver.bench.test.ts`,
    ).toBe(true)
    const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as Record<
      string,
      ReturnType<typeof fingerprint>
    >

    for (const [key, actual] of Object.entries(cases)) {
      const expected = baseline[key]
      expect(
        expected,
        `Falta el caso "${key}" en la baseline. Regenerarla con UPDATE_BASELINE=1.`,
      ).toBeDefined()
      const diffs = diffFingerprints(expected, actual)
      expect(diffs, `Divergencia en ${key} respecto a la baseline`).toEqual([])
      console.log(
        `EQUIV OK  ${key} (${actual.assignments.length} asignaciones, ${actual.unassigned.length} huecos)`,
      )
    }
  }, 600_000)
})
