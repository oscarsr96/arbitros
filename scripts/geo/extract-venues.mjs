#!/usr/bin/env node
// Extrae los 394 pabellones reales (108 demoVenues + 286 fbmSeed.venues, ambos
// dentro de `mockVenues` en mock-data.ts) a un JSON plano para geocodificar.
// demoVenues vive como literal TS; se extrae con un eval acotado al array
// (solo literales string/number, sin llamadas), igual que se hizo para
// mockMunicipalities.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')

const mockDataPath = path.join(repoRoot, 'apps/web/src/lib/mock-data.ts')
const src = fs.readFileSync(mockDataPath, 'utf8')

const startMarker = 'const demoVenues: MockVenue[] = ['
const start = src.indexOf(startMarker)
if (start === -1) throw new Error('No se encontró demoVenues en mock-data.ts')
const arrStart = start + startMarker.length - 1 // incluir el '['
// Busca el cierre `\n]` que termina el array (la siguiente línea que es solo "]")
const closeIdx = src.indexOf('\n]', arrStart)
if (closeIdx === -1) throw new Error('No se encontró el cierre de demoVenues')
const arrText = src.slice(arrStart, closeIdx + 2)
// eslint-disable-next-line no-eval
const demoVenues = eval(arrText)

const seedPath = path.join(repoRoot, 'apps/web/src/lib/fbm-calendar/fbm-seed.json')
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
const fbmVenues = seed.venues ?? []

const municipalities = JSON.parse(fs.readFileSync(path.join(__dirname, 'municipalities.json'), 'utf8'))
const muniById = new Map(municipalities.map((m) => [m.id, m.name]))

const all = [...demoVenues, ...fbmVenues].map((v) => ({
  id: v.id,
  name: v.name,
  address: v.address,
  municipalityId: v.municipalityId,
  municipalityName: muniById.get(v.municipalityId) ?? '',
}))

console.log(`demoVenues: ${demoVenues.length}, fbmSeed.venues: ${fbmVenues.length}, total: ${all.length}`)
const dupIds = all.map((v) => v.id).filter((id, i, arr) => arr.indexOf(id) !== i)
if (dupIds.length > 0) console.warn('IDs duplicados:', dupIds)

fs.writeFileSync(path.join(__dirname, 'venues-all.json'), JSON.stringify(all, null, 2))
console.log('Escrito scripts/geo/venues-all.json')
