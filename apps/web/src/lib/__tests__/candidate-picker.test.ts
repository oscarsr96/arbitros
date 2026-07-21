import { describe, it, expect, beforeEach } from 'vitest'
import { buildCandidates } from '../candidate-picker'
import { mockMatches, mockPersons, mockDesignations, resetMockData } from '../mock-data'

// buildCandidates centraliza la lógica que antes vivía duplicada en
// asignacion-view (`pickerPersons`) y substitution-panel (`getCandidates`).
// Estos tests fijan el contrato del que ahora dependen las dos vistas por fetch.

describe('buildCandidates', () => {
  beforeEach(() => {
    resetMockData()
  })

  it('devuelve null si el partido no existe', () => {
    expect(buildCandidates({ matchId: 'no-existe', role: 'arbitro' })).toBeNull()
  })

  it('devuelve TODAS las personas activas del rol pedido, válidas o no', () => {
    const match = mockMatches[0]
    const candidates = buildCandidates({ matchId: match.id, role: 'arbitro' })

    const expected = mockPersons.filter((p) => p.role === 'arbitro' && p.active).length
    expect(candidates).not.toBeNull()
    expect(candidates!).toHaveLength(expected)
    expect(candidates!.every((c) => c.role === 'arbitro')).toBe(true)
  })

  it('no mezcla roles: anotadores solo devuelve anotadores', () => {
    const match = mockMatches[0]
    const candidates = buildCandidates({ matchId: match.id, role: 'anotador' })!
    expect(candidates.every((c) => c.role === 'anotador')).toBe(true)
    expect(candidates.length).toBeGreaterThan(0)
  })

  it('cada candidato trae validación, coste y municipio resueltos', () => {
    const match = mockMatches[0]
    const candidate = buildCandidates({ matchId: match.id, role: 'arbitro' })![0]

    expect(candidate.validation).toHaveProperty('valid')
    expect(typeof candidate.travelCost).toBe('number')
    expect(typeof candidate.travelKm).toBe('number')
    expect(candidate.municipalityName).not.toBe('')
    // Los no válidos siempre explican por qué (la UI pinta el motivo).
    if (!candidate.validation.valid) expect(candidate.validation.reason).toBeTruthy()
  })

  it('marca como no válido a quien ya está designado en ese partido', () => {
    const match = mockMatches[0]
    const referee = mockPersons.find((p) => p.role === 'arbitro' && p.active)!

    mockDesignations.push({
      id: 'test-desig-1',
      matchId: match.id,
      personId: referee.id,
      role: 'arbitro',
      position: 'principal',
      travelCost: '0',
      distanceKm: '0',
      status: 'pending',
      notifiedAt: null,
      createdAt: new Date(),
    })

    const candidates = buildCandidates({ matchId: match.id, role: 'arbitro' })!
    const entry = candidates.find((c) => c.id === referee.id)!
    expect(entry.validation).toEqual({ valid: false, reason: 'Ya asignado a este partido' })
  })

  it('cuenta la carga por persona desde las designaciones reales de servidor', () => {
    const [matchA, matchB] = mockMatches
    const referee = mockPersons.find((p) => p.role === 'arbitro' && p.active)!

    mockDesignations.push({
      id: 'test-desig-2',
      matchId: matchB.id,
      personId: referee.id,
      role: 'arbitro',
      position: 'principal',
      travelCost: '0',
      distanceKm: '0',
      status: 'pending',
      notifiedAt: null,
      createdAt: new Date(),
    })

    const candidates = buildCandidates({ matchId: matchA.id, role: 'arbitro' })!
    expect(candidates.find((c) => c.id === referee.id)!.matchesAssigned).toBe(1)
  })
})
