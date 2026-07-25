// Barrido de cobertura sobre TODAS las jornadas del calendario real, con el
// modelo de carga vigente (cap 3 POR FRANJA, separaciones mínimas y matriz de
// elegibilidad). Complementa a solver.bench.jornada-real.test.ts, que mide una
// sola jornada (la punta) y compara fingerprints; aquí no se compara nada: se
// MIDE cobertura jornada a jornada, que es como se designa en la FBM.
//
// No entra en la suite por defecto (coste ~7-10 min). Cómo correrlo:
//   SWEEP=1 npx vitest run src/lib/__tests__/coverage-sweep.bench.test.ts
// Escribe además un JSON con el detalle en la ruta que indique SWEEP_OUT.

import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { solve } from '../solver'
import type { SolverInput, EnrichedMatch, EnrichedPerson } from '../types'
import {
  mockMatches,
  mockPersons,
  mockDesignations,
  mockCompetitions,
  mockVenues,
  getMockMunicipality,
  enrichMatchDesignations,
} from '../mock-data'
import { resolveFineCategory } from '../competition-fine-category'
import { listJornadas, filterMatchesByRange } from '../match-query'

const RUN = process.env.SWEEP === '1'
const SEED = 1

// Índices por barrido: sin ellos el enriquecido es cuadrático sobre el seed real.
const venuesById = new Map(mockVenues.map((v) => [v.id, v]))
const competitionsById = new Map(mockCompetitions.map((c) => [c.id, c]))
const designationsByMatch = new Map<string, (typeof mockDesignations)[number][]>()
const designationsByPerson = new Map<string, (typeof mockDesignations)[number][]>()
for (const d of mockDesignations) {
  const byMatch = designationsByMatch.get(d.matchId)
  if (byMatch) byMatch.push(d)
  else designationsByMatch.set(d.matchId, [d])
  const byPerson = designationsByPerson.get(d.personId)
  if (byPerson) byPerson.push(d)
  else designationsByPerson.set(d.personId, [d])
}

/** Enriquecido idéntico al de POST /api/optimize (coords reales de venue y persona). */
function buildInput(from: string, to: string): SolverInput {
  const scopedMatches = filterMatchesByRange(mockMatches, { from, to })

  const matches: EnrichedMatch[] = scopedMatches.map((m) => {
    const venue = venuesById.get(m.venueId)
    const competition = competitionsById.get(m.competitionId)
    const designations = enrichMatchDesignations(m, designationsByMatch.get(m.id) ?? [])
    const refereesAssigned = designations.filter((d) => d.role === 'arbitro').length
    const scorersAssigned = designations.filter((d) => d.role === 'anotador').length
    return {
      ...m,
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
      const personDesigs = designationsByPerson.get(p.id) ?? []
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
        municipality: getMockMunicipality(p.municipalityId),
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

describe.runIf(RUN)('barrido de cobertura por jornada (cap por franja)', () => {
  it(
    'mide todas las jornadas del calendario real',
    () => {
      const jornadas = listJornadas(mockMatches)
      const rows: Record<string, unknown>[] = []

      for (const [i, j] of jornadas.entries()) {
        const input = buildInput(j.from, j.to)
        const refSlots = input.matches.reduce((s, m) => s + m.refereesNeeded, 0)
        const scoSlots = input.matches.reduce((s, m) => s + m.scorersNeeded, 0)

        const t0 = Date.now()
        const out = solve(input, SEED)
        const elapsed = Date.now() - t0

        const refAssigned = out.assignments.filter((a) => a.role === 'arbitro').length
        const scoAssigned = out.assignments.filter((a) => a.role === 'anotador').length

        const loadByPerson = new Map<string, number>()
        for (const a of out.assignments) {
          loadByPerson.set(a.personId, (loadByPerson.get(a.personId) ?? 0) + 1)
        }
        const loads = [...loadByPerson.values()]

        const byReason = new Map<string, number>()
        for (const u of out.unassigned) {
          byReason.set(u.reason, (byReason.get(u.reason) ?? 0) + 1)
        }
        const topReasons = [...byReason.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([r, n]) => `${r}:${n}`)
          .join(' ')

        const fullyCovered = input.matches.filter((m) => {
          const need = m.refereesNeeded + m.scorersNeeded
          const got = out.assignments.filter((a) => a.matchId === m.id).length
          return need > 0 && got >= need
        }).length

        const row = {
          j: i + 1,
          sabado: j.saturday,
          partidos: input.matches.length,
          slots: out.metrics.totalSlots,
          cobertura: Number(out.metrics.coverage.toFixed(1)),
          arbitro: refSlots ? Number(((refAssigned / refSlots) * 100).toFixed(1)) : 100,
          mesa: scoSlots ? Number(((scoAssigned / scoSlots) * 100).toFixed(1)) : 100,
          completos: input.matches.length
            ? Number(((fullyCovered / input.matches.length) * 100).toFixed(1))
            : 0,
          coste: Math.round(out.metrics.totalCost),
          personas: loads.length,
          cargaMax: loads.length ? Math.max(...loads) : 0,
          segundos: Number((elapsed / 1000).toFixed(1)),
          motivos: topReasons,
        }
        rows.push(row)
        // Progreso en vivo: el barrido entero dura minutos.
        console.log(JSON.stringify(row))
      }

      const out = process.env.SWEEP_OUT
      if (out) writeFileSync(out, JSON.stringify(rows, null, 2), 'utf-8')
    },
    30 * 60 * 1000,
  )
})
