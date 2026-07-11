import { describe, it, expect } from 'vitest'
import { generateReferees, generateScorers } from '../referee-roster'
import { mockPersons } from '../mock-data'
import {
  REFEREE_LEVEL_DISTRIBUTION,
  LEGACY_CATEGORY_BY_LEVEL,
  REFEREE_LEVELS,
  canOfficiate,
} from '../referee-eligibility'

const MUNIS = [
  { id: 'muni-001', name: 'Madrid' },
  { id: 'muni-002', name: 'Alcorcón' },
  { id: 'muni-003', name: 'Getafe' },
  { id: 'muni-011', name: 'Las Rozas' },
]

describe('generateReferees', () => {
  const roster = generateReferees(MUNIS)

  it('genera 770 árbitros (suma de la distribución)', () => {
    const total = Object.values(REFEREE_LEVEL_DISTRIBUTION).reduce((a, b) => a + b, 0)
    expect(total).toBe(770)
    expect(roster).toHaveLength(770)
  })

  it('respeta la distribución exacta por nivel', () => {
    for (const level of REFEREE_LEVELS) {
      const n = roster.filter((p) => p.refereeLevel === level).length
      expect(n).toBe(REFEREE_LEVEL_DISTRIBUTION[level])
    }
  })

  it('todos son árbitros con id y nick únicos', () => {
    expect(roster.every((p) => p.role === 'arbitro')).toBe(true)
    expect(new Set(roster.map((p) => p.id)).size).toBe(770)
    expect(new Set(roster.map((p) => p.nick)).size).toBe(770)
    expect(roster.every((p) => (p.nick ?? '').length > 0)).toBe(true)
  })

  it('ningún nick lleva sufijo numérico ni romano (I, II, III...)', () => {
    const romanSuffix = / (I{1,3}|IV|VI{0,3}|IX|XI{0,2}|X)$/
    const offenders = roster.filter(
      (p) => romanSuffix.test(p.nick ?? '') || /\d/.test(p.nick ?? ''),
    )
    expect(offenders.map((p) => p.nick)).toEqual([])
  })

  it('mapea category legacy coherente con el nivel fino', () => {
    for (const p of roster) {
      expect(p.category).toBe(LEGACY_CATEGORY_BY_LEVEL[p.refereeLevel!])
      expect(['provincial', 'autonomico', 'nacional', 'feb']).toContain(p.category)
    }
  })

  it('es determinista (dos ejecuciones idénticas)', () => {
    const a = generateReferees(MUNIS)
    const b = generateReferees(MUNIS)
    expect(a.map((p) => `${p.id}|${p.nick}|${p.municipalityId}|${p.name}`)).toEqual(
      b.map((p) => `${p.id}|${p.nick}|${p.municipalityId}|${p.name}`),
    )
  })

  it('asigna municipios válidos con sesgo a Madrid', () => {
    const ids = new Set(MUNIS.map((m) => m.id))
    expect(roster.every((p) => ids.has(p.municipalityId))).toBe(true)
    const madrid = roster.filter((p) => p.municipalityId === 'muni-001').length
    expect(madrid).toBeGreaterThan(770 * 0.3) // sesgo ~45%
  })
})

describe('generateScorers', () => {
  const scorers = generateScorers(MUNIS)

  it('genera 500 anotadores', () => {
    expect(scorers).toHaveLength(500)
    expect(scorers.every((p) => p.role === 'anotador')).toBe(true)
  })

  it('categorías solo escuela/autonómica/nacional (distribución exacta)', () => {
    const counts = { escuela: 0, autonomico: 0, nacional: 0 } as Record<string, number>
    for (const p of scorers) counts[p.category]++
    expect(counts).toEqual({ escuela: 250, autonomico: 160, nacional: 90 })
  })

  it('todos con nick único y sin refereeLevel', () => {
    expect(scorers.every((p) => (p.nick ?? '').length > 0)).toBe(true)
    expect(new Set(scorers.map((p) => p.nick)).size).toBe(500)
    expect(scorers.every((p) => p.refereeLevel === undefined)).toBe(true)
  })

  it('nicks disjuntos de los de los árbitros (roster global sin colisión)', () => {
    const refNicks = new Set(generateReferees(MUNIS).map((p) => p.nick))
    expect(scorers.some((p) => refNicks.has(p.nick))).toBe(false)
  })

  it('es determinista', () => {
    const a = generateScorers(MUNIS)
    const b = generateScorers(MUNIS)
    expect(a.map((p) => `${p.id}|${p.nick}|${p.category}|${p.name}`)).toEqual(
      b.map((p) => `${p.id}|${p.nick}|${p.category}|${p.name}`),
    )
  })
})

describe('mockPersons (integración roster + seed)', () => {
  it('concatena 9 seed + 770 árbitros + 500 anotadores = 1279, con ids y nicks únicos', () => {
    expect(mockPersons).toHaveLength(1279)
    expect(new Set(mockPersons.map((p) => p.id)).size).toBe(1279)
    // Ahora TODOS llevan nick (los 9 seed también).
    const nicks = mockPersons.map((p) => p.nick).filter(Boolean)
    expect(nicks).toHaveLength(1279)
    expect(new Set(nicks).size).toBe(1279)
  })

  it('tiene ≥500 anotadores; los generados llevan categoría escuela/autonómica/nacional', () => {
    const scorers = mockPersons.filter((p) => p.role === 'anotador')
    expect(scorers.length).toBeGreaterThanOrEqual(500)
    const generated = scorers.filter((p) => p.id.startsWith('person-s'))
    expect(generated).toHaveLength(500)
    expect(generated.every((p) => ['escuela', 'autonomico', 'nacional'].includes(p.category))).toBe(
      true,
    )
  })

  it('ningún árbitro se queda sin nick', () => {
    const refs = mockPersons.filter((p) => p.role === 'arbitro')
    expect(refs.every((p) => (p.nick ?? '').length > 0)).toBe(true)
  })

  it('mantiene los 9 seed originales intactos al frente', () => {
    expect(mockPersons.slice(0, 9).map((p) => p.id)).toEqual([
      'person-001',
      'person-002',
      'person-003',
      'person-004',
      'person-005',
      'person-006',
      'person-007',
      'person-008',
      'person-009',
    ])
  })
})

describe('canOfficiate (matriz de elegibilidad)', () => {
  it('nacional pita nacional pero NO 1ª autonómica', () => {
    expect(canOfficiate('nacional', 'nacional', 'principal')).toBe(true)
    expect(canOfficiate('nacional', 'primera_aut')).toBe(false)
  })

  it('1ª aut es exclusiva de primera_aut y escuela no la pita', () => {
    expect(canOfficiate('primera_aut', 'primera_aut', 'principal')).toBe(true)
    expect(canOfficiate('feb', 'primera_aut')).toBe(false)
    expect(canOfficiate('escuela', 'primera_aut')).toBe(false)
  })

  it('feb no pita nacional ni escuela (no va solo)', () => {
    expect(canOfficiate('feb', 'nacional')).toBe(false)
    expect(canOfficiate('feb', 'minibasket')).toBe(false)
    expect(canOfficiate('feb', 'cadete_pref')).toBe(false)
  })

  it('escuela pita solo minibasket/infantil/cadete y auxilia en junior pref', () => {
    expect(canOfficiate('escuela', 'minibasket', 'principal')).toBe(true)
    expect(canOfficiate('escuela', 'junior_pref', 'auxiliar')).toBe(true)
    expect(canOfficiate('escuela', 'junior_pref', 'principal')).toBe(false)
  })

  it('autónomico oro es exclusiva en 2ª aut oro', () => {
    expect(canOfficiate('autonomico_oro', 'segunda_aut_oro', 'principal')).toBe(true)
    expect(canOfficiate('autonomico_bronce', 'segunda_aut_oro')).toBe(false)
  })
})
