// Validación de conflictos al crear una designación. Función pura (sin acceso a
// mock-data ni a la request) para poder testearla con vitest; el route handler
// de `api/admin/designations` la invoca antes de insertar. Evita dos corrupciones
// que el POST no comprobaba y que el flujo de "aplicar propuesta" con "Mantener
// existentes" desactivado podía provocar:
//   1. La MISMA persona designada dos veces en el mismo partido (duplicado).
//   2. Más designaciones de un rol que las que el partido necesita (sobre-cobertura).
// Y, si se pide una posición nombrada concreta (Feature B):
//   3. Posición inválida para el rol u ocupada ya en ese partido+rol.

import {
  isValidPositionForRole,
  POSITION_LABELS,
  type DesignationPosition,
} from './designation-positions'

export interface DesignationConflict {
  ok: boolean
  reason?: string
}

export function checkDesignationConflict(
  existing: { matchId: string; personId: string; role: string; position?: DesignationPosition }[],
  match: { id: string; refereesNeeded: number; scorersNeeded: number },
  personId: string,
  role: 'arbitro' | 'anotador',
  position?: DesignationPosition,
): DesignationConflict {
  const forMatch = existing.filter((d) => d.matchId === match.id)

  // 1. Una persona no puede tener dos designaciones en el mismo partido (ni siquiera
  //    en roles distintos: solo se puede desempeñar un papel por partido).
  if (forMatch.some((d) => d.personId === personId)) {
    return { ok: false, reason: 'La persona ya está designada en este partido' }
  }

  // 2. El rol no puede superar lo que el partido necesita.
  const needed = role === 'arbitro' ? match.refereesNeeded : match.scorersNeeded
  const current = forMatch.filter((d) => d.role === role).length
  if (current >= needed) {
    return {
      ok: false,
      reason: `El partido ya tiene todos los ${role === 'arbitro' ? 'árbitros' : 'anotadores'} designados`,
    }
  }

  // 3. Posición nombrada (opcional): si se pide una concreta, debe ser válida
  //    para el rol y no estar ya reclamada en este partido+rol. Sin `position`
  //    el comportamiento es idéntico al anterior (las legacy no reclaman nada).
  if (position !== undefined) {
    if (!isValidPositionForRole(position, role)) {
      return {
        ok: false,
        reason: `La posición "${position}" no es válida para el rol ${role === 'arbitro' ? 'árbitro' : 'anotador'}`,
      }
    }
    if (forMatch.some((d) => d.role === role && d.position === position)) {
      return {
        ok: false,
        reason: `La posición "${POSITION_LABELS[position]}" ya está ocupada en este partido`,
      }
    }
  }

  return { ok: true }
}
