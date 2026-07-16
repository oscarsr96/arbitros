import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mockDesignations, mockMatches, resetMockData, type MockDesignation } from '../mock-data'

// Directorio temporal exclusivo de esta suite. `designation-persistence.ts`
// lee `process.env.FBM_DATA_DIR` UNA vez, al evaluar el módulo — hay que
// fijar la env var ANTES de importarlo. Como los imports estáticos se
// evalúan antes que el resto del cuerpo del fichero (hoisting de ES
// modules), el módulo bajo test se importa dinámicamente en `beforeAll`,
// después de fijar la env var aquí arriba.
const dataDir = mkdtempSync(join(tmpdir(), 'fbm-designations-test-'))
process.env.FBM_DATA_DIR = dataDir
const FILE = join(dataDir, 'designations.json')

let persistence: typeof import('../designation-persistence')

beforeAll(async () => {
  persistence = await import('../designation-persistence')
})

afterAll(() => {
  delete process.env.FBM_DATA_DIR
  rmSync(dataDir, { recursive: true, force: true })
})

interface FbmMockStoreShape {
  designations?: MockDesignation[]
  designationsHydrated?: boolean
}

function getStore(): FbmMockStoreShape | undefined {
  return (globalThis as unknown as { __fbmMockStore?: FbmMockStoreShape }).__fbmMockStore
}

function resetHydrationFlag() {
  const store = getStore()
  if (store) store.designationsHydrated = false
}

// matchId/personId resolubles contra el seed real (la hidratación descarta
// designaciones huérfanas cuyo matchId/personId no exista).
const sample: MockDesignation = {
  id: 'test-desig-001',
  matchId: mockMatches[0].id,
  personId: 'person-001',
  role: 'arbitro',
  travelCost: '3.00',
  distanceKm: '0',
  status: 'notified',
  notifiedAt: new Date('2025-01-10T10:00:00.000Z'),
  createdAt: new Date('2025-01-01T09:00:00.000Z'),
}

beforeEach(() => {
  mockDesignations.length = 0
  resetHydrationFlag()
  if (existsSync(FILE)) rmSync(FILE)
})

afterEach(() => {
  mockDesignations.length = 0
  resetHydrationFlag()
  if (existsSync(FILE)) rmSync(FILE)
})

describe('persistDesignations', () => {
  it('escribe el fichero JSON con el contenido de mockDesignations', () => {
    mockDesignations.push(sample)

    persistence.persistDesignations()

    expect(existsSync(FILE)).toBe(true)
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8'))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe(sample.id)
    expect(parsed[0].matchId).toBe(sample.matchId)
  })

  it('round-trip: el fichero leído manualmente coincide con mockDesignations', () => {
    mockDesignations.push(sample)

    persistence.persistDesignations()

    const parsed = JSON.parse(readFileSync(FILE, 'utf-8'))
    expect(parsed).toEqual([
      {
        ...sample,
        notifiedAt: sample.notifiedAt!.toISOString(),
        createdAt: sample.createdAt.toISOString(),
      },
    ])
  })
})

describe('ensureDesignationsHydrated', () => {
  it('revive notifiedAt/createdAt como instancias de Date', () => {
    mockDesignations.push(sample)
    persistence.persistDesignations()

    // Simular reinicio del server: array compartido vacío + flag sin marcar.
    mockDesignations.length = 0
    resetHydrationFlag()

    persistence.ensureDesignationsHydrated()

    expect(mockDesignations).toHaveLength(1)
    const [revived] = mockDesignations
    expect(revived.notifiedAt).toBeInstanceOf(Date)
    expect(revived.createdAt).toBeInstanceOf(Date)
    expect(revived.notifiedAt?.toISOString()).toBe(sample.notifiedAt!.toISOString())
    expect(revived.createdAt.toISOString()).toBe(sample.createdAt.toISOString())
  })

  it('revive notifiedAt null como null (no como Date inválida)', () => {
    const noNotified: MockDesignation = { ...sample, id: 'test-desig-002', notifiedAt: null }
    mockDesignations.push(noNotified)
    persistence.persistDesignations()

    mockDesignations.length = 0
    resetHydrationFlag()

    persistence.ensureDesignationsHydrated()

    expect(mockDesignations[0].notifiedAt).toBeNull()
  })

  it('es idempotente: llamarla dos veces no duplica designaciones', () => {
    mockDesignations.push(sample)
    persistence.persistDesignations()
    mockDesignations.length = 0
    resetHydrationFlag()

    persistence.ensureDesignationsHydrated()
    persistence.ensureDesignationsHydrated()

    expect(mockDesignations).toHaveLength(1)
  })

  it('no relee el fichero si el flag ya está marcado como hidratado', () => {
    // mockDesignations solo tiene lo que empujamos a mano; el fichero en
    // disco está vacío (nunca se llamó a persistDesignations en este test).
    // Si ensureDesignationsHydrated ignorase el flag, mockDesignations
    // quedaría en 1 igualmente (no hay fichero que leer), así que forzamos
    // un fichero con datos que NO deberían aplicarse.
    mockDesignations.push(sample)
    persistence.persistDesignations() // fichero con 1 designación
    mockDesignations.push({ ...sample, id: 'test-desig-003' }) // estado en memoria diverge del fichero
    const store = getStore()
    if (store) store.designationsHydrated = true // ya "hidratado": no debe releer

    persistence.ensureDesignationsHydrated()

    expect(mockDesignations).toHaveLength(2) // sin cambios: no releyó el fichero
  })

  it('descarta designaciones huérfanas (matchId/personId que no resuelven) al hidratar', () => {
    const orphan: MockDesignation = {
      ...sample,
      id: 'test-desig-orphan',
      matchId: 'match-inexistente',
      personId: 'person-inexistente',
    }
    mockDesignations.push(sample, orphan)
    persistence.persistDesignations()

    mockDesignations.length = 0
    resetHydrationFlag()

    persistence.ensureDesignationsHydrated()

    expect(mockDesignations).toHaveLength(1)
    expect(mockDesignations[0].id).toBe(sample.id)
  })

  it('fichero inexistente: marca hidratado sin lanzar y sin tocar mockDesignations', () => {
    expect(existsSync(FILE)).toBe(false)

    expect(() => persistence.ensureDesignationsHydrated()).not.toThrow()

    expect(mockDesignations).toHaveLength(0)
    expect(getStore()?.designationsHydrated).toBe(true)
  })

  // ── position (campo opcional, Feature B) ──────────────────────────────────

  it('round-trip CON position: se persiste y revive tal cual', () => {
    const withPosition: MockDesignation = {
      ...sample,
      id: 'test-desig-pos',
      position: 'principal',
    }
    mockDesignations.push(withPosition)
    persistence.persistDesignations()

    mockDesignations.length = 0
    resetHydrationFlag()

    persistence.ensureDesignationsHydrated()

    expect(mockDesignations).toHaveLength(1)
    expect(mockDesignations[0].position).toBe('principal')
  })

  it('round-trip SIN position (legacy del piloto): revive sin inventarle posición', () => {
    // `sample` no lleva position, como las ~90 designaciones reales del piloto.
    mockDesignations.push(sample)
    persistence.persistDesignations()

    // El JSON en disco tampoco la lleva (JSON.stringify omite undefined).
    const raw = JSON.parse(readFileSync(FILE, 'utf-8'))
    expect('position' in raw[0]).toBe(false)

    mockDesignations.length = 0
    resetHydrationFlag()

    persistence.ensureDesignationsHydrated()

    expect(mockDesignations).toHaveLength(1)
    expect(mockDesignations[0].position).toBeUndefined()
  })

  it('round-trip mixto: conviven designaciones con y sin position', () => {
    const withPosition: MockDesignation = {
      ...sample,
      id: 'test-desig-mix',
      personId: 'person-002',
      position: 'auxiliar',
    }
    mockDesignations.push(sample, withPosition)
    persistence.persistDesignations()

    mockDesignations.length = 0
    resetHydrationFlag()

    persistence.ensureDesignationsHydrated()

    expect(mockDesignations).toHaveLength(2)
    expect(mockDesignations.find((d) => d.id === sample.id)?.position).toBeUndefined()
    expect(mockDesignations.find((d) => d.id === 'test-desig-mix')?.position).toBe('auxiliar')
  })
})

describe('store de globalThis', () => {
  it('respalda la misma instancia de mockDesignations (identidad, no solo igualdad)', () => {
    expect(getStore()?.designations).toBe(mockDesignations)
  })

  it('resetMockData() deja mockDesignations en el seed (longitud 0) tras un push', () => {
    mockDesignations.push(sample)
    expect(mockDesignations.length).toBeGreaterThan(0)

    resetMockData()

    expect(mockDesignations).toHaveLength(0)
  })
})
