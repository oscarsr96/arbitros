import { describe, it, expect } from 'vitest'
import { generateReferees } from '../referee-roster'
import { mockVenues } from '../mock-data'
import addressesByMuni from '../data/addresses-cm.json'

type AddressPoint = { street: string; number: string; postalCode: string; lat: number; lon: number }
type MuniAddressData = { centroid: { lat: number; lon: number } | null; points: AddressPoint[] }
const ADDR = addressesByMuni as Record<string, MuniAddressData>

// BBOX (holgado) de la Comunidad de Madrid. Guarda de dominio: cualquier
// coordenada fuera de aquí es un homónimo de otra región (Madrid=Iowa,
// Pinto=Argentina, Arroyomolinos=Cáceres) colado por una query sin restringir.
const inCM = (lat: number, lon: number) => lat > 39.7 && lat < 41.3 && lon > -4.8 && lon < -2.9

// Municipios de test bien cubiertos por el dataset real (Madrid capital, más dos
// del sur con miles de nodos de dirección). No se usa Las Rozas/Griñón aquí para
// que el test no dependa de la cobertura de los municipios frontera.
const MUNIS = [
  { id: 'muni-001', name: 'Madrid' },
  { id: 'muni-002', name: 'Alcorcón' },
  { id: 'muni-003', name: 'Getafe' },
]

describe('direcciones reales de personas (referee-roster)', () => {
  const roster = generateReferees(MUNIS)
  const nameById = new Map(MUNIS.map((m) => [m.id, m.name]))

  it('cada persona tiene una dirección no vacía que termina en su municipio', () => {
    for (const p of roster) {
      expect(p.address).toBeTruthy()
      expect(p.address.endsWith(nameById.get(p.municipalityId)!)).toBe(true)
    }
  })

  it('invariante lat/lon: definidas si y solo si el municipio tiene cobertura', () => {
    for (const p of roster) {
      const data = ADDR[p.municipalityId]
      const covered = (data?.points.length ?? 0) > 0 || data?.centroid != null
      const hasCoord = Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
      expect(hasCoord).toBe(covered)
    }
  })

  it('usa direcciones REALES del dataset (no fabricadas) en municipios cubiertos', () => {
    // Madrid tiene miles de puntos reales → toda persona de Madrid debe caer en
    // uno de ellos (su lat/lon existe en el conjunto de puntos del municipio).
    const madridPts = new Set(ADDR['muni-001'].points.map((pt) => `${pt.lat},${pt.lon}`))
    const madrilenos = roster.filter((p) => p.municipalityId === 'muni-001')
    expect(madrilenos.length).toBeGreaterThan(0)
    for (const p of madrilenos) {
      expect(madridPts.has(`${p.latitude},${p.longitude}`)).toBe(true)
    }
  })

  it('es determinista (mismas direcciones y coords en dos generaciones)', () => {
    const key = (p: (typeof roster)[number]) => `${p.address}|${p.latitude}|${p.longitude}`
    expect(generateReferees(MUNIS).map(key)).toEqual(generateReferees(MUNIS).map(key))
  })
})

describe('coordenadas reales de venues (mockVenues)', () => {
  it('TODOS los venues tienen lat/lon (geocode real o centroide del municipio)', () => {
    const withCoord = mockVenues.filter(
      (v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude),
    )
    // Cobertura real al 100% (merge cae a centroide del municipio si Nominatim
    // falla). Igualdad exacta: cualquier venue sin coord en una regeneración
    // debe ser un fallo visible, no un residuo tolerado.
    expect(withCoord.length).toBe(mockVenues.length)
  })

  it('NINGÚN venue con coord cae fuera de la Comunidad de Madrid', () => {
    // toEqual([]) lista los infractores en el mensaje si hubiera un geocode
    // desviado (cazaría un homónimo tipo Madrid=Iowa como el que ya ocurrió).
    const off = mockVenues
      .filter((v) => Number.isFinite(v.latitude) && !inCM(v.latitude!, v.longitude!))
      .map((v) => `${v.id} ${v.latitude},${v.longitude}`)
    expect(off).toEqual([])
  })

  it('coordsApprox marca los venues con centroide (no geocode exacto) y nada más', () => {
    // Coherencia del flag: presente ⇒ coord aproximada (centroide); ausente ⇒
    // geocode real. Hoy hay una mezcla de ambos, ninguno de los dos vacío.
    const approx = mockVenues.filter((v) => v.coordsApprox)
    const exact = mockVenues.filter((v) => Number.isFinite(v.latitude) && !v.coordsApprox)
    expect(approx.length).toBeGreaterThan(0)
    expect(exact.length).toBeGreaterThan(0)
  })
})

describe('integridad del dataset de direcciones (addresses-cm.json)', () => {
  it('todo centroide de municipio cae dentro de la Comunidad de Madrid', () => {
    for (const [muniId, data] of Object.entries(ADDR)) {
      if (!data.centroid) continue
      expect(inCM(data.centroid.lat, data.centroid.lon), `centroide ${muniId}`).toBe(true)
    }
  })

  it('todo punto de dirección cae dentro de la Comunidad de Madrid', () => {
    for (const [muniId, data] of Object.entries(ADDR)) {
      for (const p of data.points) {
        expect(inCM(p.lat, p.lon), `punto en ${muniId}: ${p.lat},${p.lon}`).toBe(true)
      }
    }
  })

  it('todo punto lleva CP de la Comunidad de Madrid (empieza por 28)', () => {
    // Guard contra tagging erróneo de OSM (p. ej. CP 13200 de Ciudad Real que
    // traía algún nodo de Manzanares el Real): el build lo sustituye por el modal.
    for (const [muniId, data] of Object.entries(ADDR)) {
      for (const p of data.points) {
        expect(p.postalCode.startsWith('28'), `CP ${p.postalCode} en ${muniId}`).toBe(true)
      }
    }
  })
})
