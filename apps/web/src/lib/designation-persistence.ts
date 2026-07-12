// Persistencia a disco de `mockDesignations` (server-only).
//
// `mock-data.ts` respalda sus arrays mutables en un store de globalThis para
// que todas las evaluaciones del módulo (HMR, rutas frías) compartan la
// MISMA instancia — ver el bloque "Store compartido en globalThis" al
// principio de ese archivo. Este módulo añade la segunda pata: durabilidad
// entre reinicios del servidor, escribiendo/leyendo un JSON en disco.
//
// PROHIBIDO importar este módulo desde componentes cliente: usa `node:fs` y
// `node:path`. Solo lo importan rutas server (route handlers) e
// `instrumentation.ts`.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import {
  mockDesignations,
  mockMatches,
  mockPersons,
  isDesignationsHydrated,
  markDesignationsHydrated,
  type MockDesignation,
} from './mock-data'

// Override por env obligatorio: los tests apuntan a un directorio temporal
// para no ensuciar (ni depender de) el `.fbm-data` real del repo.
const DATA_DIR = process.env.FBM_DATA_DIR ?? join(process.cwd(), '.fbm-data')
const FILE = join(DATA_DIR, 'designations.json')

/**
 * Serializa `mockDesignations` (el array compartido) a `FILE`. Idempotente,
 * no lanza si falla la escritura: la persistencia no debe tumbar una
 * request (se loguea el error y se continúa).
 *
 * Escritura ATÓMICA: escribe a `FILE.tmp` y renombra sobre `FILE`. En
 * Windows y POSIX el rename sobre el mismo directorio es atómico y
 * reemplaza el destino, así que un crash a mitad de escritura nunca deja
 * el JSON "bueno" truncado (a lo sumo un `.tmp` huérfano).
 */
export function persistDesignations(): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    const tmp = `${FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(mockDesignations), 'utf-8')
    renameSync(tmp, FILE)
  } catch (err) {
    console.error('[designation-persistence] Error al persistir designations.json:', err)
  }
}

// Forma del registro tal cual queda tras `JSON.parse` (fechas como string).
type SerializedDesignation = Omit<MockDesignation, 'notifiedAt' | 'createdAt'> & {
  notifiedAt: string | null
  createdAt: string
}

/**
 * Hidrata `mockDesignations` (el array compartido) desde disco, una única
 * vez por proceso. Idempotente: si ya está hidratado, no hace nada. Si no
 * existe fichero marca hidratado igualmente para no reintentar en cada
 * request ni bloquear el arranque.
 *
 * Robustez ante datos malos:
 * - Fichero CORRUPTO (JSON no parseable): se respalda a `FILE.bak` en vez
 *   de dejar que el siguiente `persistDesignations()` lo sobrescriba y se
 *   pierda para siempre; se arranca con memoria vacía (recuperable a mano).
 * - Designaciones HUÉRFANAS (matchId/personId que ya no resuelven, p. ej.
 *   datos de una sesión de demo generate borrada): se descartan al hidratar
 *   para no dejar fantasmas con `person`/`match` undefined en las vistas ni
 *   contarlas en "Publicar".
 */
export function ensureDesignationsHydrated(): void {
  if (isDesignationsHydrated()) return

  try {
    if (existsSync(FILE)) {
      const raw = readFileSync(FILE, 'utf-8')
      let parsed: SerializedDesignation[]
      try {
        parsed = JSON.parse(raw)
      } catch (parseErr) {
        try {
          renameSync(FILE, `${FILE}.bak`)
        } catch {
          /* si no se puede respaldar, al menos no se sobrescribe hasta el 1er persist */
        }
        console.error(
          '[designation-persistence] designations.json corrupto; respaldado a .bak, se arranca vacío:',
          parseErr,
        )
        return
      }

      const matchIds = new Set(mockMatches.map((m) => m.id))
      const personIds = new Set(mockPersons.map((p) => p.id))
      const revived: MockDesignation[] = []
      let skipped = 0
      for (const d of parsed) {
        if (!matchIds.has(d.matchId) || !personIds.has(d.personId)) {
          skipped++
          continue
        }
        revived.push({
          ...d,
          notifiedAt: d.notifiedAt === null ? null : new Date(d.notifiedAt),
          createdAt: new Date(d.createdAt),
        })
      }
      mockDesignations.push(...revived)
      if (skipped > 0) {
        console.warn(
          `[designation-persistence] ${skipped} designación(es) huérfana(s) descartada(s) al hidratar (matchId/personId no resuelve).`,
        )
      }
    }
  } catch (err) {
    console.error('[designation-persistence] Error al hidratar designations.json:', err)
  } finally {
    markDesignationsHydrated()
  }
}
