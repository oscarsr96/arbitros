#!/usr/bin/env node
// Geocodifica los 394 pabellones (venues-all.json) vía Nominatim, 1 req/seg,
// User-Agent identificativo, resumible por caché en disco (1 fichero por
// venue). NO inventa ni cambia direcciones: solo añade lat/lon a la dirección
// real ya existente.
//
// Estrategia por venue (se detiene en el primer intento que da resultado):
//   1. "<address>, <municipio>, Comunidad de Madrid, España"
//   2. Igual pero con la address recortada en el primer separador ambiguo
//      ("esquina", " / ", " s/n", " S/N") — Nominatim suele fallar con eso.
//   3. Solo "<municipio>, Comunidad de Madrid, España" + nombre del pabellón
//      como búsqueda libre (a veces el POI está mapeado por nombre).
// Si las 3 fallan, el venue queda marcado como fallo (sin lat/lon inventada).
//
// Uso: node scripts/geo/geocode-venues.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cacheDir = path.join(__dirname, 'cache', 'nominatim')
fs.mkdirSync(cacheDir, { recursive: true })

const UA = 'fbm-arbitros-geocode/1.0 (internal one-time data gen; javiersr1996@gmail.com)'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

const venues = JSON.parse(fs.readFileSync(path.join(__dirname, 'venues-all.json'), 'utf8'))

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function cleanAddress(address) {
  return address
    .split(/\s+esquina\s+/i)[0]
    .split(' / ')[0]
    .replace(/\bs\/n\b/gi, '')
    .replace(/,\s*$/, '')
    .trim()
}

async function nominatimSearch(q) {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=es&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const arr = await res.json()
  return arr[0] ?? null
}

async function geocodeVenue(venue) {
  const attempts = [
    `${venue.address}, ${venue.municipalityName}, Comunidad de Madrid, España`,
    `${cleanAddress(venue.address)}, ${venue.municipalityName}, Comunidad de Madrid, España`,
    `${venue.name}, ${venue.municipalityName}, Comunidad de Madrid, España`,
  ]
  // Dedup (a veces limpiar no cambia nada)
  const seen = new Set()
  for (const q of attempts) {
    if (seen.has(q)) continue
    seen.add(q)
    const hit = await nominatimSearch(q)
    await sleep(1100) // Nominatim: máx 1 req/seg
    if (hit) {
      return {
        id: venue.id,
        lat: Number(hit.lat),
        lon: Number(hit.lon),
        query: q,
        osmDisplayName: hit.display_name,
        tier: attempts.indexOf(q) + 1,
      }
    }
  }
  return { id: venue.id, failed: true, attempts }
}

async function main() {
  let done = 0
  let cached = 0
  let ok = 0
  let failed = 0
  for (const venue of venues) {
    const outFile = path.join(cacheDir, `${venue.id}.json`)
    if (fs.existsSync(outFile)) {
      cached++
      const cachedResult = JSON.parse(fs.readFileSync(outFile, 'utf8'))
      if (cachedResult.failed) failed++
      else ok++
      continue
    }
    try {
      const result = await geocodeVenue(venue)
      fs.writeFileSync(outFile, JSON.stringify(result, null, 2))
      if (result.failed) {
        failed++
        console.error(`✗ [${venue.id}] ${venue.name} — sin resultado tras 3 intentos`)
      } else {
        ok++
        console.log(`✓ [${venue.id}] ${venue.name} → ${result.lat},${result.lon} (tier ${result.tier})`)
      }
    } catch (err) {
      failed++
      console.error(`✗ [${venue.id}] ${venue.name} — error: ${err.message}`)
      fs.writeFileSync(outFile, JSON.stringify({ id: venue.id, failed: true, error: err.message }, null, 2))
    }
    done++
  }
  console.log(`\nHecho. total=${venues.length} ya-cacheados=${cached} nuevos=${done} ok=${ok} fallidos=${failed}`)
}

main()
