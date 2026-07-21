// Genera el seed de partidos a partir de uno o varios CSV oficiales de
// calendario de la FBM.
//
// Reutiliza el MISMO pipeline que el import por UI (parseCalendarCsv +
// materializeImport) para que los ids (fbm-match-*, fbm-comp-*, fbm-venue-*)
// sean idénticos a los que produce la aplicación. Vuelca el resultado a
// `src/lib/fbm-calendar/fbm-seed.json`, que consume `mock-data.ts` como datos
// por defecto.
//
// Multi-CSV: cada fichero se parsea por separado (los warnings se prefijan
// con su nombre, igual que hace la ruta de import), pero el dedup por
// IDENTIFICADOR se hace UNA sola vez sobre el conjunto acumulado dentro de
// materializeImport, exactamente como en import-csv-fbm/route.ts. No se
// reimplementa el dedup aquí.
//
// Regenerar (desde apps/web):
//   npx tsx scripts/generate-fbm-seed.ts [csv...]
// Sin argumentos, usa el calendario de temporada completa por defecto.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseCalendarCsv, type ParsedCsvMatch } from '@/lib/fbm-calendar/parse-calendar-csv'
import { materializeImport } from '@/lib/fbm-calendar/materialize-import'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const outPath = resolve(here, '../src/lib/fbm-calendar/fbm-seed.json')

const cliArgs = process.argv.slice(2)
const csvPaths =
  cliArgs.length > 0
    ? cliArgs.map((p) => resolve(process.cwd(), p))
    : [resolve(repoRoot, 'calendario_temporada_fbm.csv')]

// El CSV llega en windows-1252/latin1 (igual que en la ruta de import).
const allParsed: ParsedCsvMatch[] = []
const allWarnings: string[] = []
for (const csvPath of csvPaths) {
  const text = new TextDecoder('windows-1252').decode(readFileSync(csvPath))
  const { matches, warnings } = parseCalendarCsv(text)
  allParsed.push(...matches)
  allWarnings.push(...warnings.map((w) => `${csvPath}: ${w}`))
}

const { matches, venues, competitions, summary } = materializeImport(
  allParsed,
  allWarnings,
  csvPaths.length,
)

writeFileSync(outPath, JSON.stringify({ matches, venues, competitions }, null, 2) + '\n', 'utf8')

console.log(JSON.stringify(summary, null, 2))
console.log(
  `\nEscrito: ${matches.length} partidos, ${venues.length} pabellones, ${competitions.length} competiciones`,
)
console.log(`  → ${outPath}`)
