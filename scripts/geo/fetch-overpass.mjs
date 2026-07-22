#!/usr/bin/env node
// Descarga (una sola vez, cacheado en disco, resumible) datos OSM de cada
// municipio de la Comunidad de Madrid vía Overpass API:
//   Fase 1: geometría del límite administrativo (relation admin_level=8).
//           Query barata: sin filtro de área, solo la relation con `out geom`.
//   Fase 2: nodos de dirección (addr:housenumber + addr:street) dentro del
//           BBOX del municipio (rápido: Overpass indexa por bbox de forma
//           directa; el filtro por polígono real de qué nodo cae DENTRO del
//           municipio se hace luego en local con point-in-polygon.mjs, que
//           además es exactamente lo que exige la verificación de coherencia).
//
// Motivo del split: el filtro `area["name"=...]["boundary"=administrative]`
// de Overpass es carísimo para municipios grandes (Madrid capital daba 504
// timeout en las 3 mirrors probadas). Bbox es barato siempre.
//
// Uso: node scripts/geo/fetch-overpass.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractOuterRings, boundsOfRings } from './point-in-polygon.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const boundariesDir = path.join(__dirname, 'cache', 'boundaries')
const rawDir = path.join(__dirname, 'cache', 'raw')
fs.mkdirSync(boundariesDir, { recursive: true })
fs.mkdirSync(rawDir, { recursive: true })

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const UA = 'fbm-arbitros-geocode/1.0 (internal one-time data gen; javiersr1996@gmail.com)'

const MUNICIPALITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'municipalities.json'), 'utf8'))

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchOnce(url, query, timeoutMs) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    if (text.trim().startsWith('<')) throw new Error(`Overpass devolvió HTML (error): ${text.slice(0, 300)}`)
    return JSON.parse(text)
  } finally {
    clearTimeout(t)
  }
}

async function fetchWithRetry(label, query, timeoutMs) {
  const backoffs = [3000, 8000, 20000, 40000, 60000]
  let lastErr
  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    const mirror = MIRRORS[attempt % MIRRORS.length]
    try {
      console.log(`  [${label}] intento ${attempt + 1} vía ${mirror}`)
      return await fetchOnce(mirror, query, timeoutMs)
    } catch (err) {
      lastErr = err
      console.warn(`  [${label}] fallo: ${err.message}`)
      await sleep(backoffs[attempt])
    }
  }
  throw new Error(`[${label}] agotados los reintentos: ${lastErr?.message}`)
}

// BBOX de la Comunidad de Madrid (south,west,north,east): restringe la búsqueda
// por nombre a la región para no casar homónimos de otros países/provincias
// (Madrid=Iowa, Pinto=Argentina, Arroyomolinos=Cáceres).
const CM_BBOX = '39.8,-4.7,41.2,-3.0'

function boundaryQuery(name) {
  const escaped = name.replace(/"/g, '\\"')
  return `[out:json][timeout:90];
rel["name"="${escaped}"]["boundary"="administrative"]["admin_level"="8"](${CM_BBOX});
out geom;`
}

function addressBboxQuery(bbox) {
  // bbox Overpass = (south,west,north,east) = (minLat,minLon,maxLat,maxLon)
  const bboxStr = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
  return `[out:json][timeout:120];
node["addr:housenumber"]["addr:street"](${bboxStr});
out center 20000;`
}

async function main() {
  const phase = process.argv[2] // 'boundaries' | 'addresses' | undefined = both
  let ok = 0
  let skipped = 0
  const failed = []

  if (!phase || phase === 'boundaries') {
    console.log('=== Fase 1: límites administrativos ===')
    for (const muni of MUNICIPALITIES) {
      const outFile = path.join(boundariesDir, `${muni.id}.json`)
      if (fs.existsSync(outFile)) {
        skipped++
        continue
      }
      try {
        const data = await fetchWithRetry(`boundary:${muni.name}`, boundaryQuery(muni.name), 100_000)
        const rel = data.elements.find((e) => e.type === 'relation')
        if (!rel) throw new Error('sin relation admin_level=8 en la respuesta')
        fs.writeFileSync(outFile, JSON.stringify(data))
        const rings = extractOuterRings(rel)
        console.log(`✓ ${muni.name}: ${rings.length} anillo(s) outer`)
        ok++
        await sleep(1000)
      } catch (err) {
        console.error(`✗ boundary ${muni.name}: ${err.message}`)
        failed.push(`boundary:${muni.name}`)
      }
    }
  }

  if (!phase || phase === 'addresses') {
    console.log('=== Fase 2: nodos de dirección (bbox) ===')
    for (const muni of MUNICIPALITIES) {
      const outFile = path.join(rawDir, `${muni.id}.json`)
      const boundaryFile = path.join(boundariesDir, `${muni.id}.json`)
      if (fs.existsSync(outFile)) {
        skipped++
        continue
      }
      if (!fs.existsSync(boundaryFile)) {
        console.error(`✗ addresses ${muni.name}: falta boundary, ejecuta fase 'boundaries' primero`)
        failed.push(`addresses:${muni.name}`)
        continue
      }
      try {
        const boundaryData = JSON.parse(fs.readFileSync(boundaryFile, 'utf8'))
        const rel = boundaryData.elements.find((e) => e.type === 'relation')
        const rings = extractOuterRings(rel)
        const bbox = boundsOfRings(rings)
        const data = await fetchWithRetry(`addr:${muni.name}`, addressBboxQuery(bbox), 130_000)
        fs.writeFileSync(outFile, JSON.stringify(data))
        const nodeCount = data.elements.filter((e) => e.type === 'node').length
        console.log(`✓ ${muni.name}: ${nodeCount} nodos dirección (bbox, sin filtrar aún por polígono)`)
        ok++
        await sleep(1200)
      } catch (err) {
        console.error(`✗ addresses ${muni.name}: ${err.message}`)
        failed.push(`addresses:${muni.name}`)
      }
    }
  }

  console.log(`\nHecho [${phase ?? 'boundaries+addresses'}]. OK=${ok} skip=${skipped} fallidos=${failed.length}`)
  if (failed.length > 0) {
    console.log('Fallidos:', failed.join(', '))
    process.exitCode = 1
  }
}

main()
