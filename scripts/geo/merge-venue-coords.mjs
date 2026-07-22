#!/usr/bin/env node
// Fusiona los resultados de geocode-venues (cache/nominatim/<id>.json) en el
// dataset compacto que consume la app: apps/web/src/lib/data/venue-coords.json
//
// Por venue (de venues-all.json):
//   1. Si tiene geocode real (cache/nominatim/<id>.json sin `failed`) → usa su
//      lat/lon exacto de OSM.
//   2. Si no (fallo de Nominatim o sin fichero) → cae al CENTROIDE del municipio
//      del venue (de addresses-cm.json), marcado `approx: true`, para no dejar
//      NINGÚN venue sin coordenada.
//   3. Si el municipio tampoco tiene centroide (sin boundary) → se queda fuera
//      del JSON y se reporta (lo cubrirá el propio MockVenue sin lat/lon; se
//      anota como cabo).
//
// Salida: { [venueId]: { lat, lon, approx? } }. Determinista (no red, no azar):
// solo relee ficheros de caché ya escritos.
//
// Uso: node scripts/geo/merge-venue-coords.mjs   (tras geocode-venues + build-address-dataset)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nominatimDir = path.join(__dirname, 'cache', 'nominatim')
const outDir = path.resolve(__dirname, '..', '..', 'apps/web/src/lib/data')
fs.mkdirSync(outDir, { recursive: true })

const venues = JSON.parse(fs.readFileSync(path.join(__dirname, 'venues-all.json'), 'utf8'))

// Centroides por municipio (red de seguridad). Puede no existir aún si no se
// ha corrido build-address-dataset; en ese caso solo se usan geocodes reales.
const addressesPath = path.join(outDir, 'addresses-cm.json')
const addressesByMuni = fs.existsSync(addressesPath)
  ? JSON.parse(fs.readFileSync(addressesPath, 'utf8'))
  : {}

const result = {}
let real = 0
let centroid = 0
const missing = []

for (const venue of venues) {
  const cacheFile = path.join(nominatimDir, `${venue.id}.json`)
  let coord = null
  if (fs.existsSync(cacheFile)) {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    if (!c.failed && Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
      coord = { lat: c.lat, lon: c.lon }
    }
  }

  if (coord) {
    result[venue.id] = { lat: coord.lat, lon: coord.lon }
    real++
    continue
  }

  // Fallback: centroide del municipio del venue.
  const muniCentroid = addressesByMuni[venue.municipalityId]?.centroid
  if (muniCentroid && Number.isFinite(muniCentroid.lat) && Number.isFinite(muniCentroid.lon)) {
    result[venue.id] = { lat: muniCentroid.lat, lon: muniCentroid.lon, approx: true }
    centroid++
    continue
  }

  missing.push({ id: venue.id, name: venue.name, muni: venue.municipalityName })
}

fs.writeFileSync(path.join(outDir, 'venue-coords.json'), JSON.stringify(result))

const bytes = fs.statSync(path.join(outDir, 'venue-coords.json')).size
console.log(`Escrito apps/web/src/lib/data/venue-coords.json (${(bytes / 1024).toFixed(0)} KB)`)
console.log(`  geocode real: ${real}`)
console.log(`  centroide (approx): ${centroid}`)
console.log(`  sin coordenada (fuera del JSON): ${missing.length}`)
if (missing.length > 0) {
  console.log('  ' + missing.map((m) => `${m.name} [${m.muni}]`).join('\n  '))
}
