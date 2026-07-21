import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  mockDesignations,
  mockMatches,
  mockPersons,
  getMockDesignationsForMatch,
} from '@/lib/mock-data'

// El route importa estáticamente designation-persistence, que lee
// FBM_DATA_DIR UNA vez al evaluar el módulo: hay que fijar la env var a un
// directorio temporal ANTES de importarlo (import dinámico en beforeAll)
// para no escribir en el `.fbm-data` real del repo.
const dataDir = mkdtempSync(join(tmpdir(), 'fbm-designations-route-test-'))
process.env.FBM_DATA_DIR = dataDir
const FILE = join(dataDir, 'designations.json')

let route: typeof import('../route')

beforeAll(async () => {
  route = await import('../route')
})

afterAll(() => {
  delete process.env.FBM_DATA_DIR
  rmSync(dataDir, { recursive: true, force: true })
})

// Fixture propio del test, no el partido real del índice 0: con 24.508 partidos
// agrupados por competición, qué categoría cae primera (y su scorersNeeded)
// cambia con cada regeneración del seed (ver mock-data.ts, fbmSeed.matches).
// Se clona un partido real solo para heredar venueId/competitionId válidos y se
// fijan refereesNeeded/scorersNeeded a los valores que estos tests necesitan,
// luego se registra en mockMatches para que getMockMatch(matchId) lo resuelva
// como un partido cualquiera.
const match = {
  ...mockMatches[0],
  id: 'test-match-fixture-001',
  refereesNeeded: 2,
  scorersNeeded: 3,
}
mockMatches.push(match)
const referees = ['person-001', 'person-002', 'person-003'] // demo, role arbitro
const scorers = mockPersons
  .filter((p) => p.role === 'anotador')
  .slice(0, 3)
  .map((p) => p.id)

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/designations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockDesignations.length = 0
  if (existsSync(FILE)) rmSync(FILE)
})

describe('POST unitario con position', () => {
  it('guarda y devuelve la designación con la posición pedida', async () => {
    const res = await route.POST(
      postRequest({
        matchId: match.id,
        personId: 'person-001',
        role: 'arbitro',
        position: 'auxiliar',
      }),
    )
    expect(res.status).toBe(201)
    const { designation } = await res.json()
    expect(designation.position).toBe('auxiliar')
    expect(mockDesignations).toHaveLength(1)
    expect(mockDesignations[0].position).toBe('auxiliar')
    // Persistida a disco con la posición incluida.
    const persisted = JSON.parse(readFileSync(FILE, 'utf-8'))
    expect(persisted[0].position).toBe('auxiliar')
  })

  it('posición inválida para el rol → 400 con motivo', async () => {
    const res = await route.POST(
      postRequest({
        matchId: match.id,
        personId: 'person-001',
        role: 'arbitro',
        position: 'cronometrador',
      }),
    )
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error).toContain('no válida')
    expect(mockDesignations).toHaveLength(0)
  })

  it('posición ya ocupada en el partido → 409', async () => {
    await route.POST(
      postRequest({
        matchId: match.id,
        personId: 'person-001',
        role: 'arbitro',
        position: 'principal',
      }),
    )
    const res = await route.POST(
      postRequest({
        matchId: match.id,
        personId: 'person-002',
        role: 'arbitro',
        position: 'principal',
      }),
    )
    expect(res.status).toBe(409)
    const { error } = await res.json()
    expect(error).toContain('ya está ocupada')
    expect(mockDesignations).toHaveLength(1)
  })
})

describe('POST unitario sin position (auto-fill determinista)', () => {
  it("primer árbitro → 'principal', segundo → 'auxiliar'", async () => {
    const res1 = await route.POST(
      postRequest({ matchId: match.id, personId: 'person-001', role: 'arbitro' }),
    )
    expect(res1.status).toBe(201)
    expect((await res1.json()).designation.position).toBe('principal')

    const res2 = await route.POST(
      postRequest({ matchId: match.id, personId: 'person-002', role: 'arbitro' }),
    )
    expect(res2.status).toBe(201)
    expect((await res2.json()).designation.position).toBe('auxiliar')
  })

  it('auto-fill salta las posiciones reclamadas explícitamente', async () => {
    await route.POST(
      postRequest({
        matchId: match.id,
        personId: 'person-001',
        role: 'arbitro',
        position: 'principal',
      }),
    )
    const res = await route.POST(
      postRequest({ matchId: match.id, personId: 'person-002', role: 'arbitro' }),
    )
    expect((await res.json()).designation.position).toBe('auxiliar')
  })

  it('anotadores: anotador → cronometrador → veinticuatro', async () => {
    const got: string[] = []
    for (const personId of scorers) {
      const res = await route.POST(postRequest({ matchId: match.id, personId, role: 'anotador' }))
      expect(res.status).toBe(201)
      got.push((await res.json()).designation.position)
    }
    expect(got).toEqual(['anotador', 'cronometrador', 'veinticuatro'])
  })

  it('las legacy sin position no reclaman: el auto-fill sigue dando principal', async () => {
    // Designación legacy (hidratada del piloto): sin position.
    mockDesignations.push({
      id: 'legacy-1',
      matchId: match.id,
      personId: 'person-003',
      role: 'arbitro',
      travelCost: '3.00',
      distanceKm: '0',
      status: 'pending',
      notifiedAt: null,
      createdAt: new Date('2026-07-01T10:00:00.000Z'),
    })
    const res = await route.POST(
      postRequest({ matchId: match.id, personId: 'person-001', role: 'arbitro' }),
    )
    expect(res.status).toBe(201)
    expect((await res.json()).designation.position).toBe('principal')
  })
})

describe('POST en lote con position', () => {
  it('aplica posiciones explícitas y auto-fill mezclados', async () => {
    const res = await route.POST(
      postRequest({
        assignments: [
          { matchId: match.id, personId: 'person-001', role: 'arbitro', position: 'auxiliar' },
          { matchId: match.id, personId: 'person-002', role: 'arbitro' },
        ],
      }),
    )
    const body = await res.json()
    expect(body.applied).toBe(2)
    expect(body.failed).toBe(0)
    expect(body.designations.map((d: { position?: string }) => d.position)).toEqual([
      'auxiliar',
      'principal', // auto-fill: la única no reclamada
    ])
  })

  it('unicidad de posición DENTRO del propio lote: la segunda entra en conflicts', async () => {
    const res = await route.POST(
      postRequest({
        assignments: [
          { matchId: match.id, personId: 'person-001', role: 'arbitro', position: 'principal' },
          { matchId: match.id, personId: 'person-002', role: 'arbitro', position: 'principal' },
        ],
      }),
    )
    const body = await res.json()
    expect(body.applied).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.conflicts[0].reason).toContain('ya está ocupada')
  })

  it('posición inválida en el lote no se aplica y reporta el motivo', async () => {
    const res = await route.POST(
      postRequest({
        assignments: [
          { matchId: match.id, personId: 'person-001', role: 'arbitro', position: 'veinticuatro' },
        ],
      }),
    )
    const body = await res.json()
    expect(body.applied).toBe(0)
    expect(body.conflicts[0].reason).toContain('no válida')
  })
})

describe('getMockDesignationsForMatch propaga nick y refereeLevel', () => {
  it('persona con nick → person.nick relleno; sin refereeLevel → null', async () => {
    await route.POST(postRequest({ matchId: match.id, personId: 'person-001', role: 'arbitro' }))
    const [enriched] = getMockDesignationsForMatch(match.id)
    expect(enriched.person?.nick).toBe('DECANO')
    // person-001 (demo) no tiene refereeLevel → null, nunca undefined.
    expect(enriched.person?.refereeLevel).toBeNull()
  })

  it('árbitro del roster con refereeLevel → se propaga como string', async () => {
    const rosterRef = mockPersons.find((p) => p.role === 'arbitro' && p.refereeLevel)
    expect(rosterRef).toBeDefined()
    await route.POST(postRequest({ matchId: match.id, personId: rosterRef!.id, role: 'arbitro' }))
    const [enriched] = getMockDesignationsForMatch(match.id)
    expect(enriched.person?.refereeLevel).toBe(rosterRef!.refereeLevel)
    expect(typeof enriched.person?.nick).toBe('string')
  })

  it('designación legacy sin position se enriquece sin inventarle posición', () => {
    mockDesignations.push({
      id: 'legacy-2',
      matchId: match.id,
      personId: 'person-002',
      role: 'arbitro',
      travelCost: '3.00',
      distanceKm: '0',
      status: 'pending',
      notifiedAt: null,
      createdAt: new Date('2026-07-01T10:00:00.000Z'),
    })
    const [enriched] = getMockDesignationsForMatch(match.id)
    expect(enriched.position).toBeUndefined()
    expect(enriched.person?.nick).toBe('JEFA')
  })
})

// Los referees del fixture deben existir y ser árbitros (guard del propio test).
describe('fixture', () => {
  it('los person-00X demo usados son árbitros y hay 3 anotadores en el roster', () => {
    for (const id of referees) {
      expect(mockPersons.find((p) => p.id === id)?.role).toBe('arbitro')
    }
    expect(scorers).toHaveLength(3)
  })
})
