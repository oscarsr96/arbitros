#!/usr/bin/env node
// Procesa la caché cruda de Overpass (cache/boundaries + cache/raw) en el
// dataset compacto que consume la app: apps/web/src/lib/data/addresses-cm.json
//
// Por municipio:
//   1. Filtra los nodos de dirección del bbox a los que caen DENTRO del
//      polígono real (point-in-polygon, mismo criterio que la verificación
//      de coherencia pedida).
//   2. Normaliza a {street, number, postalCode, lat, lon}.
//   3. Si un nodo no tiene addr:postcode, se le asigna el postcode más
//      frecuente de ESE municipio (si existe alguno); si el municipio no
//      tiene ningún postcode real, queda ''.
//   4. Deduplica por (street, number) y recorta a MAX_PER_MUNI (determinista:
//      se ordena por id de nodo OSM antes de recortar, no al azar) para no
//      disparar el tamaño del JSON en municipios con cobertura enorme
//      (Madrid capital).
//
// Reporta al final qué municipios se quedan con 0 direcciones reales (para
// decidir si hace falta una fase 3 de fallback sobre `highway` con nombre).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractOuterRings, pointInMultiPolygon } from './point-in-polygon.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const boundariesDir = path.join(__dirname, 'cache', 'boundaries')
const rawDir = path.join(__dirname, 'cache', 'raw')
const outDir = path.resolve(__dirname, '..', '..', 'apps/web/src/lib/data')
fs.mkdirSync(outDir, { recursive: true })

const MAX_PER_MUNI = 600

const MUNICIPALITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'municipalities.json'), 'utf8'))

const result = {}
const stats = []

for (const muni of MUNICIPALITIES) {
  const boundaryFile = path.join(boundariesDir, `${muni.id}.json`)
  const rawFile = path.join(rawDir, `${muni.id}.json`)
  if (!fs.existsSync(boundaryFile) || !fs.existsSync(rawFile)) {
    stats.push({ id: muni.id, name: muni.name, raw: 0, inside: 0, unique: 0, kept: 0, missing: true })
    continue
  }

  const boundaryData = JSON.parse(fs.readFileSync(boundaryFile, 'utf8'))
  const rel = boundaryData.elements.find((e) => e.type === 'relation')
  const rings = extractOuterRings(rel)

  const rawData = JSON.parse(fs.readFileSync(rawFile, 'utf8'))
  const nodes = rawData.elements.filter((e) => e.type === 'node')

  const inside = nodes.filter((n) => pointInMultiPolygon(n.lon, n.lat, rings))

  // Postcode más frecuente del municipio (para nodos sin addr:postcode). Solo
  // se cuentan CP de la Comunidad de Madrid (empiezan por 28): algún nodo OSM
  // trae mal el CP de otra provincia (p. ej. 13200 de Ciudad Real en Manzanares
  // el Real), que no debe contaminar ni el modo ni las direcciones generadas.
  const pcCounts = new Map()
  for (const n of inside) {
    const pc = n.tags['addr:postcode']
    if (pc && pc.startsWith('28')) pcCounts.set(pc, (pcCounts.get(pc) ?? 0) + 1)
  }
  let modePostcode = ''
  let modeCount = 0
  for (const [pc, count] of pcCounts) {
    if (count > modeCount) {
      modePostcode = pc
      modeCount = count
    }
  }

  const seen = new Set()
  const records = []
  // Orden determinista por id de nodo OSM (no depende de la respuesta HTTP)
  const sortedInside = [...inside].sort((a, b) => a.id - b.id)
  for (const n of sortedInside) {
    const street = n.tags['addr:street']
    const number = n.tags['addr:housenumber']
    if (!street || !number) continue
    const key = `${street}|${number}`
    if (seen.has(key)) continue
    seen.add(key)
    // CP fuera de la CM (empieza distinto de 28) = tagging erróneo de OSM → se
    // sustituye por el CP modal del municipio (siempre 28xxx).
    const rawPc = n.tags['addr:postcode']
    const postalCode = rawPc && rawPc.startsWith('28') ? rawPc : modePostcode
    records.push({
      street,
      number,
      postalCode,
      lat: n.lat,
      lon: n.lon,
    })
  }

  const kept = records.slice(0, MAX_PER_MUNI)
  // Centroide del municipio (media de los vértices del anillo outer): red de
  // seguridad para lat/lon cuando `points` queda vacío (no debería pasar tras
  // el fallback de fase 3, pero así nunca se emite una persona sin coordenada).
  const allVerts = rings.flat()
  const centroid = allVerts.length
    ? {
        lat: allVerts.reduce((s, [, lat]) => s + lat, 0) / allVerts.length,
        lon: allVerts.reduce((s, [lon]) => s + lon, 0) / allVerts.length,
      }
    : null
  result[muni.id] = { centroid, points: kept }
  stats.push({
    id: muni.id,
    name: muni.name,
    raw: nodes.length,
    inside: inside.length,
    unique: records.length,
    kept: kept.length,
  })
}

fs.writeFileSync(path.join(outDir, 'addresses-cm.json'), JSON.stringify(result))

const bytes = fs.statSync(path.join(outDir, 'addresses-cm.json')).size
console.log(`Escrito apps/web/src/lib/data/addresses-cm.json (${(bytes / 1024).toFixed(0)} KB)`)
console.log('\nCobertura por municipio (raw=nodos bbox, inside=dentro del polígono, kept=final):')
for (const s of stats.sort((a, b) => a.kept - b.kept)) {
  const flag = s.missing ? ' [SIN DATOS RAW]' : s.kept === 0 ? ' [¡CERO DIRECCIONES!]' : ''
  console.log(
    `  ${s.name.padEnd(30)} raw=${String(s.raw).padStart(6)} inside=${String(s.inside).padStart(6)} kept=${String(s.kept).padStart(4)}${flag}`,
  )
}
const zeroCoverage = stats.filter((s) => s.kept === 0)
console.log(`\nMunicipios con 0 direcciones: ${zeroCoverage.length} de ${stats.length}`)
if (zeroCoverage.length > 0) {
  console.log(zeroCoverage.map((s) => s.name).join(', '))
}
