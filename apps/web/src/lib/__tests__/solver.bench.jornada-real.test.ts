// Arnés de equivalencia del solver sobre datos REALES de producción (P6b,
// tasks/todo-import-temporada.md). Complementa a solver.bench.test.ts: aquel
// usa un escenario sintético (buildScenario) con mocks O(1) de mock-data que
// NO reproducen los costes reales de producción (mockVenues.find lineal,
// getMockDesignationsForMatch escaneando 122.670 designaciones, etc.).
//
// Este fichero importa mock-data.ts SIN mockear (vi.mock) para correr solve()
// contra el seed real de temporada (fbm-seed.json, 24.508 partidos, 1.279
// personas) — de ahí que viva en un fichero aparte: solver.bench.test.ts hace
// vi.mock('../mock-data', ...) a nivel de módulo, y ese mock se aplicaría a
// TODOS los tests del fichero, incompatible con usar los datos reales aquí.
//
// Jornada elegida: la ventana viernes→jueves que contiene el 2025-10-25
// (jornada punta del calendario real), resuelta con los helpers existentes
// de matchday-availability.ts / match-query.ts (NO se reimplementa la
// ventana). Mide ~1.309 partidos / 3.686 slots.
//
// Cómo correrlo (NO entra en la suite por defecto: coste medido ~15-20 s hoy,
// pero es el arnés pensado para cuando el solver aún tardaba minutos, así que
// queda tras la misma guarda BENCH que solver.bench.test.ts):
//   BENCH=1 pnpm vitest run src/lib/__tests__/solver.bench.jornada-real.test.ts
//
// Para regenerar la baseline (solo tras confirmar que el cambio de
// asignaciones es intencional, sobre árbol limpio):
//   BENCH=1 UPDATE_BASELINE=1 pnpm vitest run src/lib/__tests__/solver.bench.jornada-real.test.ts

import { describe, it, expect } from 'vitest'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { solve } from '../solver'
import type { SolverInput, EnrichedMatch, EnrichedPerson } from '../types'
import {
  mockMatches,
  mockPersons,
  mockDesignations,
  mockCompetitions,
  mockVenues,
  getMockMunicipality,
  getMockDesignationsForMatch,
} from '../mock-data'
import { resolveFineCategory } from '../competition-fine-category'
import { getMatchdayWindow, getJornadaSaturdayForDate } from '../matchday-availability'
import { filterMatchesByRange } from '../match-query'

// Sábado de la jornada punta (ver tasks/todo-import-temporada.md, sección P6).
const JORNADA_ANCHOR_DATE = '2025-10-25'

/** Enriquecido idéntico al de POST /api/optimize (app/api/optimize/route.ts):
 *  venue con sus coords reales (venue-coords.json) y persona con lat/lon
 *  reales de mockPersons, para que roadKmBetween use distancia real igual
 *  que en producción (antes este arnés pisaba el venue con 0,0 y omitía las
 *  coords de la persona, cayendo siempre al fallback muni→muni). */
function buildSolverInput(): SolverInput {
  const saturday = getJornadaSaturdayForDate(JORNADA_ANCHOR_DATE)
  const window = getMatchdayWindow(saturday)
  const scopedMatches = filterMatchesByRange(mockMatches, {
    from: window.friday,
    to: window.thursday,
  })

  const matches: EnrichedMatch[] = scopedMatches.map((m) => {
    const venue = mockVenues.find((v) => v.id === m.venueId)
    const competition = mockCompetitions.find((c) => c.id === m.competitionId)
    const designations = getMockDesignationsForMatch(m.id)
    const refereesAssigned = designations.filter((d) => d.role === 'arbitro').length
    const scorersAssigned = designations.filter((d) => d.role === 'anotador').length

    return {
      ...m,
      // MockVenue ya trae lat/lon reales (venue-coords.json); se pasan tal
      // cual, igual que api/optimize/route.ts.
      venue,
      competition: competition
        ? { ...competition, fineCategory: resolveFineCategory(competition) }
        : undefined,
      designations,
      refereesAssigned,
      scorersAssigned,
      isCovered: refereesAssigned >= m.refereesNeeded && scorersAssigned >= m.scorersNeeded,
    }
  })

  const persons: EnrichedPerson[] = mockPersons
    .filter((p) => p.active)
    .map((p) => {
      const municipality = getMockMunicipality(p.municipalityId)
      const personDesigs = mockDesignations.filter((d) => d.personId === p.id)
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        category: p.category,
        refereeLevel: p.refereeLevel ?? null,
        address: p.address,
        postalCode: p.postalCode,
        municipalityId: p.municipalityId,
        latitude: p.latitude,
        longitude: p.longitude,
        active: p.active,
        hasCar: p.hasCar,
        municipality,
        matchesAssigned: personDesigs.length,
        totalCost: personDesigs.reduce((sum, d) => sum + parseFloat(d.travelCost), 0),
        hasAvailability: true,
      }
    })

  return {
    matches,
    persons,
    parameters: {
      costWeight: 0.7,
      balanceWeight: 0.3,
      maxMatchesPerPerson: 3,
      forceExisting: true,
      numProposals: 1,
    },
  }
}

// ── Fingerprint para equivalencia (misma forma que solver.bench.test.ts;
// duplicado a propósito para no acoplar los dos ficheros de test) ──────────

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

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__')
const BASELINE_FILE = path.join(FIXTURES_DIR, 'solver-fingerprint-jornada-real.json')

// Coste medido: ver informe de P6 en tasks/todo-import-temporada.md. Margen
// amplio (15 min) porque este arnés se pensó para el solver SIN optimizar
// (objetivo de la tanda de rendimiento es bajarlo, no que este test se rompa
// al mejorar).
const TEST_TIMEOUT_MS = 900_000

describe.skipIf(!process.env.BENCH)('solver bench — jornada real (BENCH=1)', () => {
  it(
    'equivalencia de salida sobre la jornada punta real (2025-10-25, ~1309 partidos)',
    () => {
      const input = buildSolverInput()
      const t0 = performance.now()
      const out = solve(input)
      const ms = performance.now() - t0
      const totalSlots = input.matches.reduce(
        (sum, m) => sum + m.refereesNeeded + m.scorersNeeded,
        0,
      )
      console.log(
        `\n=== JORNADA REAL 2025-10-25 === ${input.matches.length} partidos, ` +
          `${input.persons.length} personas activas, ${totalSlots} slots, ` +
          `${(ms / 1000).toFixed(2)}s, cobertura ${out.metrics.coverage}%, coste ${out.metrics.totalCost}`,
      )

      const actual = fingerprint(out)

      if (process.env.UPDATE_BASELINE === '1') {
        mkdirSync(FIXTURES_DIR, { recursive: true })
        writeFileSync(BASELINE_FILE, JSON.stringify(actual, null, 2) + '\n')
        console.log(`Baseline regenerada: ${BASELINE_FILE}`)
        return
      }

      expect(
        existsSync(BASELINE_FILE),
        `Falta la baseline commiteada (${BASELINE_FILE}). Generarla con ` +
          `BENCH=1 UPDATE_BASELINE=1 pnpm vitest run src/lib/__tests__/solver.bench.jornada-real.test.ts`,
      ).toBe(true)
      const expected = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as ReturnType<
        typeof fingerprint
      >

      const diffs = diffFingerprints(expected, actual)
      expect(diffs, 'Divergencia en la jornada real respecto a la baseline').toEqual([])
      console.log(
        `EQUIV OK  jornada-real (${actual.assignments.length} asignaciones, ${actual.unassigned.length} huecos)`,
      )
    },
    TEST_TIMEOUT_MS,
  )
})
