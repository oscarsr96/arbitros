import { describe, it, expect } from 'vitest'
import { haversineKm, roadKm, roadKmBetween, getMuniCentroid, ROAD_FACTOR } from '../geo-distance'

// Puerta del Sol (Madrid) y Plaza de Cervantes (Alcalá de Henares): coordenadas
// reales de dos puntos conocidos, independientes del dataset de direcciones
// (que promedia muestras y puede desplazar el centroide dentro del término
// municipal). Sirven para fijar la fórmula en sí, no la matriz muni→muni.
const SOL = { lat: 40.4168, lon: -3.7038 }
const TORREJON_ARDOZ = { lat: 40.4599, lon: -3.477 }
const ALCALA_CERVANTES = { lat: 40.4819, lon: -3.363 }

describe('haversineKm', () => {
  it('distancia de un punto consigo mismo es 0', () => {
    expect(haversineKm(SOL, SOL)).toBe(0)
  })

  it('es simétrica', () => {
    expect(haversineKm(SOL, ALCALA_CERVANTES)).toBeCloseTo(haversineKm(ALCALA_CERVANTES, SOL), 10)
  })

  it('Alcalá de Henares–Torrejón de Ardoz (par real conocido) cae en rango carretera esperado', () => {
    // Bases_Generales / tasks/todo.md (2026-07-23): rango de referencia 8-15 km.
    const km = roadKm(ALCALA_CERVANTES, TORREJON_ARDOZ)
    expect(km).toBeGreaterThanOrEqual(8)
    expect(km).toBeLessThanOrEqual(15)
  })
})

describe('roadKm', () => {
  it('aplica el factor carretera sobre la línea recta', () => {
    const straight = haversineKm(SOL, ALCALA_CERVANTES)
    expect(roadKm(SOL, ALCALA_CERVANTES)).toBeCloseTo(straight * ROAD_FACTOR, 10)
  })

  it('es simétrica', () => {
    expect(roadKm(SOL, TORREJON_ARDOZ)).toBeCloseTo(roadKm(TORREJON_ARDOZ, SOL), 10)
  })
})

describe('roadKmBetween', () => {
  it('coordenada NaN cae a undefined (fallback muni→muni)', () => {
    expect(
      roadKmBetween(
        { latitude: NaN, longitude: SOL.lon },
        { latitude: ALCALA_CERVANTES.lat, longitude: ALCALA_CERVANTES.lon },
      ),
    ).toBeUndefined()
    expect(
      roadKmBetween(
        { latitude: SOL.lat, longitude: SOL.lon },
        { latitude: ALCALA_CERVANTES.lat, longitude: NaN },
      ),
    ).toBeUndefined()
  })

  it('coordenada ausente cae a undefined (comportamiento previo, sin regresión)', () => {
    expect(
      roadKmBetween(undefined, { latitude: ALCALA_CERVANTES.lat, longitude: ALCALA_CERVANTES.lon }),
    ).toBeUndefined()
    expect(roadKmBetween({ latitude: SOL.lat, longitude: SOL.lon }, {})).toBeUndefined()
  })

  it('coords válidas devuelven roadKm redondeado a 1 decimal', () => {
    const km = roadKmBetween(
      { latitude: SOL.lat, longitude: SOL.lon },
      { latitude: ALCALA_CERVANTES.lat, longitude: ALCALA_CERVANTES.lon },
    )
    expect(km).toBeCloseTo(roadKm(SOL, ALCALA_CERVANTES), 1)
  })
})

describe('getMuniCentroid', () => {
  it('devuelve el centroide real de un municipio con dataset (Madrid)', () => {
    const centroid = getMuniCentroid('muni-001')
    expect(centroid).toBeDefined()
    expect(centroid!.lat).toBeGreaterThan(39.7)
    expect(centroid!.lat).toBeLessThan(41.3)
  })

  it('Griñón (muni-041, sin boundary OSM) tiene centroide manual', () => {
    expect(getMuniCentroid('muni-041')).toEqual({ lat: 40.2160138, lon: -3.8530756, approx: true })
  })

  it('municipio desconocido (sin centroide) cae limpio a undefined', () => {
    expect(getMuniCentroid('muni-does-not-exist')).toBeUndefined()
  })
})
