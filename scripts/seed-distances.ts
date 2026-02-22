/**
 * seed-distances.ts
 *
 * Generates DEMO distance data between all municipality pairs.
 * For every (origin, dest) pair where origin !== dest it inserts
 * a random distance between 5 km and 80 km.
 *
 * NOTE: This is demo/development data only. Production data should
 * be seeded via scripts/seed-distances-google.ts using the Google
 * Distance Matrix API (see CLAUDE.md).
 *
 * Run from repo root:
 *   pnpm db:seed:distances
 *
 * Expected duration: a few seconds for ~150 municipalities (~22 500 pairs)
 * at 500 rows per batch insert.
 */

import { db } from '../apps/web/src/lib/db'
import { distances, municipalities } from '../apps/web/src/lib/db/schema'

const CHUNK_SIZE = 500

function randomDistanceKm(): string {
  // Random float between 5 and 80, rounded to 1 decimal place
  const km = 5 + Math.random() * 75
  return km.toFixed(1)
}

async function main(): Promise<void> {
  // 1. Fetch all municipalities from the DB
  console.log('Fetching municipalities from database...')
  const allMunicipalities = await db
    .select({ id: municipalities.id, name: municipalities.name })
    .from(municipalities)

  if (allMunicipalities.length === 0) {
    console.error('No municipalities found. Run seed-municipalities.ts first.')
    process.exit(1)
  }

  console.log(`Found ${allMunicipalities.length} municipalities.`)

  const totalPairs = allMunicipalities.length * (allMunicipalities.length - 1)
  console.log(`Generating ${totalPairs} directional pairs (origin != dest)...`)

  // 2. Build all pairs
  type DistanceRow = {
    originId: string
    destId: string
    distanceKm: string
  }

  const rows: DistanceRow[] = []

  for (const origin of allMunicipalities) {
    for (const dest of allMunicipalities) {
      if (origin.id === dest.id) continue
      rows.push({
        originId: origin.id,
        destId: dest.id,
        distanceKm: randomDistanceKm(),
      })
    }
  }

  console.log(`Built ${rows.length} rows. Inserting in batches of ${CHUNK_SIZE}...`)

  // 3. Insert in batches, skipping pairs that already exist
  let processed = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)

    await db.insert(distances).values(chunk).onConflictDoNothing()

    processed += chunk.length

    if (processed % 5000 === 0 || processed === rows.length) {
      const pct = ((processed / rows.length) * 100).toFixed(1)
      console.log(`  ${processed}/${rows.length} rows (${pct}%)`)
    }
  }

  console.log('Done seeding distances.')
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Error seeding distances:', err)
    process.exit(1)
  })
