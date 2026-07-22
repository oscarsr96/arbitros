#!/usr/bin/env node
// Igual que fetch-overpass.mjs fase 'boundaries' pero en UNA sola query
// Overpass (unión de las N relaciones pendientes) en vez de 1 por municipio:
// muchísima menos exposición a rate-limit (429) que aporreaba la versión
// secuencial. Sigue siendo resumible: solo pide los municipios que aún no
// tienen fichero en cache/boundaries/.
//
// Uso: node scripts/geo/fetch-boundaries-bulk.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractOuterRings } from './point-in-polygon.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const boundariesDir = path.join(__dirname, 'cache', 'boundaries')
fs.mkdirSync(boundariesDir, { recursive: true })

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const UA = 'fbm-arbitros-geocode/1.0 (internal one-time data gen; javiersr1996@gmail.com)'

const MUNICIPALITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'municipalities.json'), 'utf8'))
const pending = MUNICIPALITIES.filter((m) => !fs.existsSync(path.join(boundariesDir, `${m.id}.json`)))

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// BBOX de la Comunidad de Madrid (south,west,north,east). Restringe la búsqueda
// por nombre a la región: sin él, nombres ambiguos ("Madrid", "Pinto",
// "Arroyomolinos") casan homónimos de otros países/provincias (Madrid=Iowa,
// Pinto=Argentina, Arroyomolinos=Cáceres) y traen un boundary equivocado.
const CM_BBOX = '39.8,-4.7,41.2,-3.0'

function buildQuery(munis) {
  const blocks = munis
    .map((m) => `  rel["name"="${m.name.replace(/"/g, '\\"')}"]["boundary"="administrative"]["admin_level"="8"](${CM_BBOX});`)
    .join('\n')
  return `[out:json][timeout:180];\n(\n${blocks}\n);\nout geom;`
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
    if (text.trim().startsWith('<')) throw new Error(`Overpass HTML error: ${text.slice(0, 300)}`)
    return JSON.parse(text)
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  if (pending.length === 0) {
    console.log('Nada pendiente, todos los municipios ya tienen boundary cacheado.')
    return
  }
  console.log(`Pendientes: ${pending.length} municipios en 1 query combinada`)

  const backoffs = [5000, 15000, 30000, 60000, 90000]
  let data
  let lastErr
  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    const mirror = MIRRORS[attempt % MIRRORS.length]
    try {
      console.log(`intento ${attempt + 1} vía ${mirror}`)
      data = await fetchOnce(mirror, buildQuery(pending), 200_000)
      break
    } catch (err) {
      lastErr = err
      console.warn(`fallo: ${err.message}`)
      await sleep(backoffs[attempt])
    }
  }
  if (!data) throw new Error(`Agotados los reintentos: ${lastErr?.message}`)

  const relations = data.elements.filter((e) => e.type === 'relation')
  console.log(`Respuesta: ${relations.length} relaciones de ${pending.length} pedidas`)

  // Aviso si el bbox devolviera dos relaciones admin_level=8 con el mismo nombre
  // (homónimo dentro de la CM): el Map se quedaría con la última en silencio.
  const nameCounts = new Map()
  for (const r of relations) nameCounts.set(r.tags?.name, (nameCounts.get(r.tags?.name) ?? 0) + 1)
  for (const [name, count] of nameCounts) {
    if (count > 1) console.warn(`AVISO: ${count} relaciones con nombre "${name}"; se conserva la última`)
  }
  const byName = new Map(relations.map((r) => [r.tags?.name, r]))
  let ok = 0
  const missing = []
  for (const muni of pending) {
    const rel = byName.get(muni.name)
    if (!rel) {
      missing.push(muni.name)
      continue
    }
    const rings = extractOuterRings(rel)
    if (rings.length === 0) {
      missing.push(`${muni.name} (sin anillos outer)`)
      continue
    }
    fs.writeFileSync(
      path.join(boundariesDir, `${muni.id}.json`),
      JSON.stringify({ elements: [rel] }),
    )
    ok++
  }
  console.log(`\nGuardados: ${ok}/${pending.length}`)
  if (missing.length > 0) {
    console.log(`Sin resolver (${missing.length}):`, missing.join(', '))
  }
}

main()
