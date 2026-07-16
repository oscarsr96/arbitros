import { describe, it, expect } from 'vitest'
import {
  REFEREE_POSITIONS,
  SCORER_POSITIONS,
  POSITION_LABELS,
  positionsForRole,
  positionForSlot,
  isValidPositionForRole,
  autoFillPosition,
  mapDesignationsToSlots,
  type DesignationPosition,
} from '../designation-positions'

describe('positionsForRole', () => {
  it('árbitro → principal y auxiliar, en ese orden', () => {
    expect(positionsForRole('arbitro')).toEqual(['principal', 'auxiliar'])
    expect(positionsForRole('arbitro')).toBe(REFEREE_POSITIONS)
  })

  it('anotador → anotador, cronometrador y veinticuatro, en ese orden', () => {
    expect(positionsForRole('anotador')).toEqual(['anotador', 'cronometrador', 'veinticuatro'])
    expect(positionsForRole('anotador')).toBe(SCORER_POSITIONS)
  })
})

describe('POSITION_LABELS', () => {
  it('tiene etiqueta para todas las posiciones de ambos roles', () => {
    for (const p of [...REFEREE_POSITIONS, ...SCORER_POSITIONS]) {
      expect(POSITION_LABELS[p]).toBeTruthy()
    }
    expect(POSITION_LABELS.veinticuatro).toBe('24"')
  })
})

describe('positionForSlot', () => {
  it('mapea slot i → i-ésima posición del rol', () => {
    expect(positionForSlot('arbitro', 0)).toBe('principal')
    expect(positionForSlot('arbitro', 1)).toBe('auxiliar')
    expect(positionForSlot('anotador', 0)).toBe('anotador')
    expect(positionForSlot('anotador', 1)).toBe('cronometrador')
    expect(positionForSlot('anotador', 2)).toBe('veinticuatro')
  })

  it('fuera de rango → undefined', () => {
    expect(positionForSlot('arbitro', 2)).toBeUndefined()
    expect(positionForSlot('anotador', 3)).toBeUndefined()
    expect(positionForSlot('arbitro', -1)).toBeUndefined()
  })
})

describe('isValidPositionForRole', () => {
  it('acepta posiciones del propio rol', () => {
    expect(isValidPositionForRole('principal', 'arbitro')).toBe(true)
    expect(isValidPositionForRole('auxiliar', 'arbitro')).toBe(true)
    expect(isValidPositionForRole('veinticuatro', 'anotador')).toBe(true)
  })

  it('rechaza posiciones del otro rol', () => {
    expect(isValidPositionForRole('cronometrador', 'arbitro')).toBe(false)
    expect(isValidPositionForRole('principal', 'anotador')).toBe(false)
  })

  it('rechaza strings arbitrarios', () => {
    expect(isValidPositionForRole('portero', 'arbitro')).toBe(false)
    expect(isValidPositionForRole('', 'anotador')).toBe(false)
  })
})

// Fixture mínimo para autoFill/mapeo.
function desig(
  role: 'arbitro' | 'anotador',
  position?: DesignationPosition,
  id = 'd',
  matchId = 'm1',
) {
  return { id, matchId, role, position }
}

describe('autoFillPosition', () => {
  it('partido sin designaciones → primera posición del rol', () => {
    expect(autoFillPosition([], 'm1', 'arbitro')).toBe('principal')
    expect(autoFillPosition([], 'm1', 'anotador')).toBe('anotador')
  })

  it('principal reclamado → auxiliar', () => {
    const existing = [desig('arbitro', 'principal')]
    expect(autoFillPosition(existing, 'm1', 'arbitro')).toBe('auxiliar')
  })

  it('todas reclamadas → undefined', () => {
    const existing = [desig('arbitro', 'principal'), desig('arbitro', 'auxiliar')]
    expect(autoFillPosition(existing, 'm1', 'arbitro')).toBeUndefined()
  })

  it('las legacy sin position NO reclaman: sigue devolviendo principal', () => {
    const existing = [desig('arbitro'), desig('arbitro')]
    expect(autoFillPosition(existing, 'm1', 'arbitro')).toBe('principal')
  })

  it('ignora otros partidos y otros roles', () => {
    const existing = [
      desig('arbitro', 'principal', 'd1', 'm2'), // otro partido
      desig('anotador', 'anotador'), // otro rol
    ]
    expect(autoFillPosition(existing, 'm1', 'arbitro')).toBe('principal')
  })
})

describe('mapDesignationsToSlots', () => {
  it('legacy sin position → rellenan en orden de llegada', () => {
    const d1 = desig('arbitro', undefined, 'd1')
    const d2 = desig('arbitro', undefined, 'd2')
    expect(mapDesignationsToSlots([d1, d2], 'arbitro', 2)).toEqual([d1, d2])
  })

  it('position explícita reclama su slot aunque llegue después', () => {
    const legacy = desig('arbitro', undefined, 'legacy')
    const principal = desig('arbitro', 'principal', 'pri')
    expect(mapDesignationsToSlots([legacy, principal], 'arbitro', 2)).toEqual([principal, legacy])
  })

  it('solo auxiliar asignado → slot principal queda vacío', () => {
    const aux = desig('arbitro', 'auxiliar', 'aux')
    expect(mapDesignationsToSlots([aux], 'arbitro', 2)).toEqual([undefined, aux])
  })

  it('position duplicada: la primera gana, la segunda degrada a hueco', () => {
    const a = desig('arbitro', 'principal', 'a')
    const b = desig('arbitro', 'principal', 'b')
    expect(mapDesignationsToSlots([a, b], 'arbitro', 2)).toEqual([a, b])
  })

  it('position inválida para el rol degrada a hueco (no revienta)', () => {
    const raro = desig('arbitro', 'cronometrador', 'raro')
    const aux = desig('arbitro', 'auxiliar', 'aux')
    expect(mapDesignationsToSlots([raro, aux], 'arbitro', 2)).toEqual([raro, aux])
  })

  it('sobrantes (> needed) se anexan sin perderse: longitud = max(needed, ocupadas)', () => {
    const a = desig('arbitro', 'principal', 'a')
    const b = desig('arbitro', 'auxiliar', 'b')
    const c = desig('arbitro', undefined, 'c')
    const result = mapDesignationsToSlots([a, b, c], 'arbitro', 2)
    expect(result).toHaveLength(3)
    expect(result).toEqual([a, b, c])
  })

  it('filtra por rol: designaciones del otro rol no ocupan slots', () => {
    const ref = desig('arbitro', 'principal', 'ref')
    const scorer = desig('anotador', 'anotador', 'sco')
    expect(mapDesignationsToSlots([scorer, ref], 'arbitro', 2)).toEqual([ref, undefined])
  })

  it('sin designaciones → needed slots vacíos', () => {
    expect(mapDesignationsToSlots([], 'anotador', 3)).toEqual([undefined, undefined, undefined])
  })

  it('anotadores: mezcla legacy + posiciones explícitas respeta los slots nombrados', () => {
    const crono = desig('anotador', 'cronometrador', 'crono')
    const legacy = desig('anotador', undefined, 'legacy')
    const veinti = desig('anotador', 'veinticuatro', 'v24')
    expect(mapDesignationsToSlots([crono, legacy, veinti], 'anotador', 3)).toEqual([
      legacy,
      crono,
      veinti,
    ])
  })

  it('es pura: no muta el array de entrada', () => {
    const input = [desig('arbitro', 'auxiliar', 'aux')]
    const copy = [...input]
    mapDesignationsToSlots(input, 'arbitro', 2)
    expect(input).toEqual(copy)
  })
})
