// Distancia geográfica real entre dos coordenadas: haversine (línea recta
// sobre la esfera terrestre) corregida con un factor fijo de carretera. Ver
// tasks/todo.md, plan "Distancias reales en el solver" (2026-07-23):
// decisión B2 — haversine × 1.3 gana a haversine pura (B1, infraestima
// carretera ~1,2-1,4x) y a Google Distance Matrix (B3, de pago); mantiene la
// escala del mock sintético anterior, que ya usaba el mismo factor ×1.3.
//
// Módulo hoja: solo lee el dataset estático de direcciones, sin importar
// mock-data.ts (evita ciclos).

import addressesByMuni from './data/addresses-cm.json'

export interface LatLon {
  lat: number
  lon: number
}

const EARTH_RADIUS_KM = 6371

/** Factor carretera sobre línea recta (decisión B2, tasks/todo.md 2026-07-23). */
export const ROAD_FACTOR = 1.3

/** Distancia en línea recta (círculo máximo) entre dos coordenadas, en km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)))
}

/** Haversine corregida a distancia de carretera estimada (× ROAD_FACTOR). */
export function roadKm(a: LatLon, b: LatLon): number {
  return haversineKm(a, b) * ROAD_FACTOR
}

function isFiniteCoord(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * roadKm entre dos entidades con coordenadas OPCIONALES (persona, pabellón:
 * campos `latitude`/`longitude` de MockPerson/MockVenue y sus Enriched*).
 * Devuelve `undefined` si a alguna le falta lat o lon, o si alguna no es un
 * número finito (`NaN`/`Infinity`, p. ej. un geocode corrupto) — el llamador
 * decide el fallback (típicamente la matriz muni→muni de mock-data).
 * Redondeada a 1 decimal, coherente con el `distanceKm` persistido (`toFixed(1)`).
 */
export function roadKmBetween(
  a: { latitude?: number; longitude?: number } | undefined,
  b: { latitude?: number; longitude?: number } | undefined,
): number | undefined {
  const aLat = a?.latitude
  const aLon = a?.longitude
  const bLat = b?.latitude
  const bLon = b?.longitude
  if (
    !isFiniteCoord(aLat) ||
    !isFiniteCoord(aLon) ||
    !isFiniteCoord(bLat) ||
    !isFiniteCoord(bLon)
  ) {
    return undefined
  }
  const km = roadKm({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon })
  return Math.round(km * 10) / 10
}

// ── Centroides de municipio ──────────────────────────────────────────────

type MuniAddressData = { centroid: LatLon | null; points: unknown[] }
const ADDR = addressesByMuni as Record<string, MuniAddressData>

/**
 * Centroide real de un municipio: el de `addresses-cm.json` (promedio de las
 * direcciones OSM muestreadas dentro del término municipal). Griñón
 * (muni-041) no tenía boundary OSM para generarle direcciones y se añadió a
 * mano en ese mismo dataset (coordenada real de su pabellón municipal,
 * `approx: true`) — no hace falta ningún caso especial aquí.
 *
 * Si un municipio no tiene centroide (ninguno hoy, pero la matriz de
 * `generateDistances()` en mock-data.ts lo trata como dato que puede
 * faltar), devuelve `undefined` y el par se omite de la matriz precalculada:
 * `getMockDistance` cae limpio a su fallback fijo (35 km) sin romper nada.
 */
export function getMuniCentroid(muniId: string): LatLon | undefined {
  return ADDR[muniId]?.centroid ?? undefined
}
