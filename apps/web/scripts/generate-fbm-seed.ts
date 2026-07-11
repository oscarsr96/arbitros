// Genera el seed de partidos a partir del CSV oficial de calendario de la FBM.
//
// Reutiliza el MISMO pipeline que el import por UI (parseCalendarCsv +
// materializeImport) para que los ids (fbm-match-*, fbm-comp-*, fbm-venue-*)
// sean idénticos a los que produce la aplicación. Vuelca el resultado a
// `src/lib/fbm-calendar/fbm-seed.json`, que consume `mock-data.ts` como datos
// por defecto (solo Liga VIPS Masculina + Junior Masculino ORO: son las únicas
// categorías del CSV del piloto).
//
// Regenerar tras actualizar el CSV (desde apps/web):
//   npx tsx scripts/generate-fbm-seed.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseCalendarCsv } from '@/lib/fbm-calendar/parse-calendar-csv'
import { materializeImport } from '@/lib/fbm-calendar/materialize-import'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const csvPath = resolve(repoRoot, 'calendario_piloto_fbm_horas.csv')
const outPath = resolve(here, '../src/lib/fbm-calendar/fbm-seed.json')

// El CSV llega en windows-1252/latin1 (igual que en la ruta de import).
const text = new TextDecoder('windows-1252').decode(readFileSync(csvPath))

const { matches: parsed, warnings } = parseCalendarCsv(text)
const { matches, venues, competitions, summary } = materializeImport(parsed, warnings, 1)

writeFileSync(outPath, JSON.stringify({ matches, venues, competitions }, null, 2) + '\n', 'utf8')

console.log(JSON.stringify(summary, null, 2))
console.log(
  `\nEscrito: ${matches.length} partidos, ${venues.length} pabellones, ${competitions.length} competiciones`,
)
console.log(`  → ${outPath}`)
