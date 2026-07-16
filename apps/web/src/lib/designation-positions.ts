// Posiciones nombradas de una designación (Feature B, Tanda 2).
//
// Módulo HOJA: sin imports de mock-data, fs ni ningún módulo server-only.
// Lo importan tanto componentes cliente (slots de asignación) como código
// server (route handlers, validación). Todo es puro y determinista: nada de
// Math.random()/Date.now() (se importa desde cliente; ver lección de
// hidratación SSR en CLAUDE.md).
//
// El slot i del rol r ES la posición `positionForSlot(r, i)`. Las
// designaciones legacy (las ~90 reales del piloto) no llevan `position`:
// nunca se les inventa una — `mapDesignationsToSlots` las recoloca en los
// huecos libres sin perderlas y la UI no les pinta badge de posición.

export const REFEREE_POSITIONS = ['principal', 'auxiliar'] as const
export const SCORER_POSITIONS = ['anotador', 'cronometrador', 'veinticuatro'] as const

export type DesignationPosition =
  | (typeof REFEREE_POSITIONS)[number]
  | (typeof SCORER_POSITIONS)[number]

export const POSITION_LABELS: Record<DesignationPosition, string> = {
  principal: 'Principal',
  auxiliar: 'Auxiliar',
  anotador: 'Anotador',
  cronometrador: 'Cronometrador',
  veinticuatro: '24"',
}

export function positionsForRole(role: 'arbitro' | 'anotador'): readonly DesignationPosition[] {
  return role === 'arbitro' ? REFEREE_POSITIONS : SCORER_POSITIONS
}

/** Posición que corresponde al slot `slotIndex` del rol. Fuera de rango → undefined. */
export function positionForSlot(
  role: 'arbitro' | 'anotador',
  slotIndex: number,
): DesignationPosition | undefined {
  return positionsForRole(role)[slotIndex]
}

export function isValidPositionForRole(position: string, role: 'arbitro' | 'anotador'): boolean {
  return (positionsForRole(role) as readonly string[]).includes(position)
}

/**
 * Auto-fill determinista para designaciones creadas SIN posición explícita
 * (aplicar propuesta del solver, re-optimizar slot, llamadores legacy):
 * primera posición de `positionsForRole(role)` no reclamada explícitamente
 * por las designaciones existentes de ese partido+rol. Las legacy sin
 * `position` NO reclaman ninguna. Si todas están reclamadas → undefined
 * (la sobre-cobertura ya la corta el conflicto por rol).
 */
export function autoFillPosition(
  existing: readonly { matchId: string; role: string; position?: DesignationPosition }[],
  matchId: string,
  role: 'arbitro' | 'anotador',
): DesignationPosition | undefined {
  const claimed = new Set<DesignationPosition>()
  for (const d of existing) {
    if (d.matchId === matchId && d.role === role && d.position !== undefined) {
      claimed.add(d.position)
    }
  }
  return positionsForRole(role).find((p) => !claimed.has(p))
}

/**
 * Reconcilia designaciones ↔ slots nombrados (el punto delicado con datos
 * legacy sin `position`). Dos pasadas:
 *
 *  1ª: una designación con `position` válida para el rol reclama SU slot
 *      (índice = orden de la posición en `positionsForRole(role)`). Si dos
 *      reclaman la misma, la primera en orden de llegada gana y la otra pasa
 *      a la 2ª pasada.
 *  2ª: las designaciones sin `position` (o con position duplicada/inválida
 *      para el rol) rellenan los huecos restantes en orden de llegada.
 *
 * Sobrantes (> needed, datos raros): se anexan al final para no ocultar
 * designaciones existentes. Longitud devuelta = max(needed, ocupadas).
 * Pura y determinista.
 */
export function mapDesignationsToSlots<T extends { role: string; position?: DesignationPosition }>(
  designations: T[],
  role: 'arbitro' | 'anotador',
  needed: number,
): (T | undefined)[] {
  const positions = positionsForRole(role)
  const ofRole = designations.filter((d) => d.role === role)
  const slotCount = Math.max(0, needed)
  const slots: (T | undefined)[] = Array.from({ length: slotCount }, () => undefined)

  // 1ª pasada: la position válida reclama su slot.
  const unplaced: T[] = []
  for (const d of ofRole) {
    const idx = d.position === undefined ? -1 : positions.indexOf(d.position)
    if (idx >= 0 && idx < slotCount && slots[idx] === undefined) {
      slots[idx] = d
    } else {
      unplaced.push(d)
    }
  }

  // 2ª pasada: legacy/duplicadas/inválidas rellenan huecos; sobrantes al final.
  let cursor = 0
  for (const d of unplaced) {
    while (cursor < slotCount && slots[cursor] !== undefined) cursor++
    if (cursor < slotCount) {
      slots[cursor] = d
      cursor++
    } else {
      slots.push(d)
    }
  }

  return slots
}
