#!/usr/bin/env node
// Falla si el seed de partidos vuelve a colarse en el bundle de cliente.
//
// Contexto: `mock-data.ts` importa `fbm-calendar/fbm-seed.json`, que con el
// calendario real de temporada pesa ~10 MB. Cuando un componente `'use client'`
// importaba un helper de ahí, webpack arrastraba el módulo entero y el seed
// acababa en un chunk COMPARTIDO de 9,65 MB que cargaban 5 rutas (asignacion,
// partidos, personal, designaciones, disponibilidad).
//
// Se comprueba sobre TODO `static/chunks/`, no solo `static/chunks/app/`: en un
// build de producción el seed no cae en el chunk de la ruta sino en uno
// compartido fuera de `app/`, así que mirar solo `app/` da un falso verde.
// Y siempre sobre `next build` (producción): en dev el layout de chunks es otro.
//
// `import 'server-only'` en mock-data.ts ya hace fallar el build ante el caso
// evidente (un cliente importando mock-data). Este script cubre lo que aquello
// no ve: que el seed llegue por una vía indirecta, por ejemplo un módulo de lib
// sin marcar que acabe alcanzándose desde la capa cliente.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chunksDir = path.join(webRoot, '.next', 'static', 'chunks')

// Marcadores que NO pueden aparecer en ningún chunk de cliente. `fbm-match-` es
// el prefijo de los ids de partido del seed: si está, el calendario viajó entero.
const FORBIDDEN = ['fbm-match-']

if (!fs.existsSync(chunksDir)) {
  console.error(`✗ No existe ${path.relative(webRoot, chunksDir)}`)
  console.error('  Ejecuta `next build` (producción) antes de este script.')
  process.exit(1)
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

const files = walk(chunksDir)
if (files.length === 0) {
  console.error('✗ No se encontró ningún chunk .js. ¿El build terminó bien?')
  process.exit(1)
}

const offenders = []
let totalBytes = 0

for (const file of files) {
  const size = fs.statSync(file).size
  totalBytes += size
  const content = fs.readFileSync(file, 'utf8')
  const hits = FORBIDDEN.filter((marker) => content.includes(marker))
  if (hits.length > 0) {
    offenders.push({ file: path.relative(chunksDir, file), size, hits })
  }
}

const totalMb = (totalBytes / 1024 / 1024).toFixed(2)

if (offenders.length > 0) {
  console.error(`✗ El seed de partidos está en el bundle de cliente (${offenders.length} chunk(s)):`)
  for (const o of offenders) {
    console.error(`    ${(o.size / 1024).toFixed(0).padStart(8)} KB  ${o.file}  [${o.hits.join(', ')}]`)
  }
  console.error('')
  console.error('  Causa habitual: un componente cliente importa un helper que depende de')
  console.error('  mockMatches / mockAvailabilities / mockDesignations. Lo que necesite el')
  console.error('  cliente va en src/lib/mock-data-client.ts, o llega por fetch de la API.')
  process.exit(1)
}

console.log(`✓ Sin seed de partidos en el bundle de cliente (${files.length} chunks, ${totalMb} MB)`)
