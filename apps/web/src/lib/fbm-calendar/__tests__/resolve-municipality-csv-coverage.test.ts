import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Papa from 'papaparse'
import { describe, it, expect } from 'vitest'
import { resolveMunicipality } from '../resolve-municipality'

// Fuente real: CSV de calendario de temporada exportado por el backend de
// competición FBM (~24.500 partidos, cp1252, delimitador ';'). Vive en la raíz
// del monorepo y NO está commiteado (7 MB, artefacto local del piloto que otra
// tanda regenera) — si no existe en este checkout, la suite se salta en vez de
// fallar en falso; el recuento de filas puede variar entre regeneraciones, la
// prueba solo depende del CONJUNTO de valores de POBLACIÓN, no de filas concretas.
const CSV_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../calendario_temporada_fbm.csv',
)

describe.skipIf(!existsSync(CSV_PATH))(
  'resolveMunicipality — cobertura del calendario real de temporada',
  () => {
    it('resuelve TODOS los valores de POBLACIÓN distintos del CSV (0 sin resolver)', () => {
      const buf = readFileSync(CSV_PATH)
      const text = new TextDecoder('windows-1252').decode(buf)
      const result = Papa.parse<Record<string, string>>(text, {
        delimiter: ';',
        header: true,
        skipEmptyLines: true,
        quoteChar: '\0',
      })

      const poblaciones = new Set<string>()
      for (const row of result.data) {
        const p = (row['POBLACIÓN'] ?? '').trim()
        if (p) poblaciones.add(p)
      }
      // Sanity check: si esto es 0, el parseo del CSV se rompió (cabecera no
      // reconocida) y el test de abajo pasaría en falso por falta de datos.
      expect(poblaciones.size).toBeGreaterThan(0)

      const unresolved = [...poblaciones].filter((p) => !resolveMunicipality(p).matched)

      expect(unresolved, `POBLACIÓN sin resolver: ${unresolved.join(', ')}`).toEqual([])
    })
  },
)
