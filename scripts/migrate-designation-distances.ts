/**
 * migrate-designation-distances.ts
 *
 * Migración ONE-OFF (tarea T6): recalcula `distanceKm` y `travelCost` de las
 * designaciones YA PERSISTIDAS en `.fbm-data/designations.json` usando las
 * coordenadas reales ACTUALES de personas y pabellones, y reescribe el
 * fichero con el mismo formato de serialización que usa
 * `persistDesignations()` (apps/web/src/lib/designation-persistence.ts).
 *
 * Reutiliza EXACTAMENTE la misma fórmula que `createDesignation` en
 * apps/web/src/app/api/admin/designations/route.ts:78-92:
 *   - travelCost = calculateMockTravelCost(personMuniId, venueMuniId).cost, fijado a 2 decimales.
 *   - distanceKm = roadKmBetween(person, venue) (persona→pabellón, coords reales),
 *     con fallback al km muni→muni de calculateMockTravelCost si falta alguna
 *     coordenada, fijado a 1 decimal.
 *
 * Por qué se importan las funciones en vez de reimplementarlas: `mock-data.ts`
 * hace `import 'server-only'`, un paquete marcador que LANZA si se resuelve
 * bajo la condición de exports por defecto (piensa que se está importando
 * desde un Client Component). Next.js lo resuelve a un módulo vacío bajo la
 * condición `react-server` en su capa de servidor; en Node a secas (este
 * script corriendo con tsx) hay que pedir esa misma condición explícitamente
 * con el flag `--conditions=react-server` — el mismo problema que ya resolvió
 * `apps/web/vitest.config.ts` (ver el comentario de ese fichero), solo que
 * allí se hace vía alias de resolución en vez de flag porque Vitest no expone
 * `--conditions`.
 *
 * Ejecutar (desde la raíz del repo):
 *   pnpm --filter @fbm/web exec tsx --conditions=react-server ../../scripts/migrate-designation-distances.ts
 *
 * Idempotente: correrlo dos veces con los mismos datos produce el mismo
 * resultado (la segunda pasada no cambia nada, porque recalcula con las
 * MISMAS coordenadas actuales).
 *
 * Si `.fbm-data/designations.json` no existe o está vacío: no-op limpio.
 *
 * Designaciones huérfanas (matchId/personId/venue que ya no resuelven con los
 * datos actuales): se dejan TAL CUAL (no se pueden recalcular de forma
 * fiable), preservando el número total de designaciones en el fichero.
 */

import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getMockPerson,
  getMockMatch,
  getMockVenue,
  calculateMockTravelCost,
} from '../apps/web/src/lib/mock-data'
import { roadKmBetween } from '../apps/web/src/lib/geo-distance'

// Mismo default que designation-persistence.ts: `FBM_DATA_DIR` o
// `<cwd>/.fbm-data`. Con `pnpm --filter @fbm/web ...` el cwd es apps/web, así
// que por defecto apunta a apps/web/.fbm-data/designations.json (el fichero real).
const DATA_DIR = process.env.FBM_DATA_DIR ?? join(process.cwd(), '.fbm-data')
const FILE = join(DATA_DIR, 'designations.json')
const BACKUP_FILE = `${FILE}.bak`

// Forma tal cual queda tras JSON.parse (fechas como string, igual que
// SerializedDesignation en designation-persistence.ts). No se tipa con
// `MockDesignation` completo a propósito: este script solo toca
// `distanceKm`/`travelCost` y debe preservar cualquier otro campo presente en
// el fichero sin conocerlo de antemano.
type SerializedDesignation = {
  id: string
  matchId: string
  personId: string
  travelCost: string
  distanceKm: string
  [key: string]: unknown
}

function main(): void {
  if (!existsSync(FILE)) {
    console.log(`[migrate-designation-distances] No existe ${FILE}. No-op: nada que migrar.`)
    return
  }

  const raw = readFileSync(FILE, 'utf-8')
  if (raw.trim() === '') {
    console.log(`[migrate-designation-distances] ${FILE} está vacío. No-op: nada que migrar.`)
    return
  }

  let designations: SerializedDesignation[]
  try {
    designations = JSON.parse(raw)
  } catch (err) {
    console.error(
      `[migrate-designation-distances] ${FILE} no es JSON válido, abortando sin tocar nada:`,
      err,
    )
    process.exitCode = 1
    return
  }

  if (!Array.isArray(designations)) {
    console.error(
      '[migrate-designation-distances] El contenido no es un array, abortando sin tocar nada.',
    )
    process.exitCode = 1
    return
  }

  if (designations.length === 0) {
    console.log(`[migrate-designation-distances] ${FILE} no tiene designaciones. No-op.`)
    return
  }

  const totalBefore = designations.length

  // Backup OBLIGATORIO antes de reescribir (sobrescribible en cada corrida).
  copyFileSync(FILE, BACKUP_FILE)
  console.log(`[migrate-designation-distances] Backup escrito en ${BACKUP_FILE}`)

  let changed = 0
  let orphaned = 0
  const examples: {
    id: string
    kmBefore: string
    kmAfter: string
    costBefore: string
    costAfter: string
  }[] = []

  const recalculated = designations.map((d) => {
    const person = getMockPerson(d.personId)
    const match = getMockMatch(d.matchId)
    const venue = match ? getMockVenue(match.venueId) : undefined

    if (!person || !match || !venue) {
      // Huérfana con los datos actuales: no se puede recalcular de forma
      // fiable. Se deja tal cual para no perder el registro ni falsear el
      // recuento total.
      orphaned++
      return d
    }

    const { cost, km } = calculateMockTravelCost(person.municipalityId, venue.municipalityId)
    const directKm = roadKmBetween(person, venue) ?? km

    const newTravelCost = cost.toFixed(2)
    const newDistanceKm = directKm.toFixed(1)

    if (newTravelCost === d.travelCost && newDistanceKm === d.distanceKm) {
      return d
    }

    changed++
    if (examples.length < 5) {
      examples.push({
        id: d.id,
        kmBefore: d.distanceKm,
        kmAfter: newDistanceKm,
        costBefore: d.travelCost,
        costAfter: newTravelCost,
      })
    }
    return { ...d, travelCost: newTravelCost, distanceKm: newDistanceKm }
  })

  const serialized = JSON.stringify(recalculated)

  // Validación POST: el JSON resultante es parseable y conserva el mismo
  // número de designaciones que antes.
  const reparsed: unknown = JSON.parse(serialized)
  if (!Array.isArray(reparsed) || reparsed.length !== totalBefore) {
    console.error(
      `[migrate-designation-distances] Validación post-escritura falló ` +
        `(${Array.isArray(reparsed) ? reparsed.length : 'n/a'} vs ${totalBefore} esperadas). ` +
        `Abortando SIN escribir el fichero final (el backup ya está a salvo en ${BACKUP_FILE}).`,
    )
    process.exitCode = 1
    return
  }

  // Escritura atómica: tmp + rename, mismo patrón que persistDesignations().
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, serialized, 'utf-8')
  renameSync(tmp, FILE)

  console.log(`[migrate-designation-distances] Total designaciones: ${totalBefore}`)
  console.log(`[migrate-designation-distances] Cambiadas: ${changed}`)
  if (orphaned > 0) {
    console.log(
      `[migrate-designation-distances] Huérfanas (sin recalcular, dejadas tal cual): ${orphaned}`,
    )
  }
  console.log(`[migrate-designation-distances] Backup: ${BACKUP_FILE}`)
  if (examples.length > 0) {
    console.log('[migrate-designation-distances] Ejemplos (antes -> después):')
    for (const ex of examples) {
      console.log(
        `  ${ex.id}: distanceKm ${ex.kmBefore} -> ${ex.kmAfter} · travelCost ${ex.costBefore} -> ${ex.costAfter}`,
      )
    }
  } else {
    console.log('[migrate-designation-distances] Ninguna designación cambió de valor.')
  }
}

main()
