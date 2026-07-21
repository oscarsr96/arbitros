// Construcción de la lista de candidatos para un hueco de designación.
//
// Vivía DUPLICADA en dos componentes cliente: `pickerPersons` (asignacion-view)
// y `getCandidates` (substitution-panel). Ambos validaban con `isPersonAvailable`
// y `hasTimeOverlap`, que dependen de `mockAvailabilities`/`mockMatches` y por
// tanto del seed de partidos: eso metía ~10 MB de calendario en el bundle de
// cliente. Además `mockAvailabilities` se genera a partir de las fechas de TODOS
// los partidos, así que en cliente se pagaba también el coste de generar la
// disponibilidad de temporada de 1.279 personas en el arranque.
//
// Al vivir en servidor, `hasTimeOverlap` pasa a ser correcto de verdad: en
// cliente leía la copia estática de `mockDesignations` (siempre vacía) y por eso
// nunca detectaba un solapamiento real.

import {
  mockPersons,
  calculateMockTravelCost,
  isPersonAvailable,
  hasTimeOverlap,
  getPersonIncompatibilities,
  getMockMunicipality,
  getMockVenue,
  getMockMatch,
  getMockCompetition,
  getMockDesignationsForMatch,
  mockDesignations,
  mockMatchdayAvailabilities,
} from './mock-data'
import { firstFreePosition, type DesignationPosition } from './designation-positions'
import { checkSlotEligibility, isRefereeLevel } from './referee-eligibility'
import { resolveFineCategory } from './competition-fine-category'
import { getJornadaSaturdayForDate } from './matchday-availability'

export interface CandidateValidation {
  valid: boolean
  reason?: string
}

export interface Candidate {
  id: string
  name: string
  role: 'arbitro' | 'anotador'
  category: string | null
  municipalityId: string
  municipalityName: string
  travelCost: number
  travelKm: number
  matchesAssigned: number
  validation: CandidateValidation
  matchdayNotes: string | null
}

export interface BuildCandidatesOptions {
  matchId: string
  role: 'arbitro' | 'anotador'
  /**
   * Posición del hueco. Si no se pasa, se deriva de las designaciones actuales
   * del partido con la misma regla que aplica el POST de designaciones
   * (`firstFreePosition`), que es lo que hacía `substitution-panel` para los
   * huecos legacy sin `position`.
   */
  position?: DesignationPosition
}

/**
 * Devuelve todas las personas del rol pedido con su validación para ese hueco.
 * No filtra: la UI muestra también los no válidos con el motivo, igual que antes.
 */
export function buildCandidates({
  matchId,
  role,
  position,
}: BuildCandidatesOptions): Candidate[] | null {
  const match = getMockMatch(matchId)
  if (!match) return null

  const venue = getMockVenue(match.venueId)
  const competition = getMockCompetition(match.competitionId)
  const designations = getMockDesignationsForMatch(matchId)
  const fineCategory = competition ? resolveFineCategory(competition) : null
  const saturdayDate = getJornadaSaturdayForDate(match.date)

  const needed = role === 'arbitro' ? match.refereesNeeded : match.scorersNeeded
  const effectivePosition = position ?? firstFreePosition(designations, role, needed)
  const slotPosition =
    effectivePosition === 'principal' || effectivePosition === 'auxiliar'
      ? effectivePosition
      : undefined

  // Carga por persona sobre TODAS las designaciones (no solo las del rango
  // cargado en la UI): es el dato real de servidor.
  const assignedCounts = new Map<string, number>()
  for (const d of mockDesignations) {
    assignedCounts.set(d.personId, (assignedCounts.get(d.personId) ?? 0) + 1)
  }

  const assignedToThisMatch = new Set(designations.map((d) => d.personId))

  return mockPersons
    .filter((p) => p.role === role && p.active)
    .map((person) => {
      const municipality = getMockMunicipality(person.municipalityId)
      const { cost, km } = calculateMockTravelCost(
        person.municipalityId,
        venue?.municipalityId ?? '',
      )

      const matchdayAvail = mockMatchdayAvailabilities.find(
        (a) => a.personId === person.id && a.saturdayDate === saturdayDate,
      )

      let validation: CandidateValidation = { valid: true }

      if (assignedToThisMatch.has(person.id)) {
        validation = { valid: false, reason: 'Ya asignado a este partido' }
      } else if (!isPersonAvailable(person.id, match.date, match.time)) {
        validation = { valid: false, reason: 'No disponible en esta franja' }
      } else if (hasTimeOverlap(person.id, match.id)) {
        validation = { valid: false, reason: 'Solapamiento con otro partido' }
      } else if (
        role === 'arbitro' &&
        competition &&
        !checkSlotEligibility(
          { role: person.role, category: person.category, refereeLevel: person.refereeLevel },
          { fineCategory, minRefCategory: competition.minRefCategory },
          slotPosition,
        )
      ) {
        validation = {
          valid: false,
          reason:
            fineCategory && isRefereeLevel(person.refereeLevel)
              ? 'Nivel no elegible para esta competición'
              : `Categoría insuficiente (mín. ${competition.minRefCategory})`,
        }
      } else {
        const hasIncompat = getPersonIncompatibilities(person.id).some(
          (inc) =>
            match.homeTeam.toLowerCase().includes(inc.teamName.toLowerCase()) ||
            match.awayTeam.toLowerCase().includes(inc.teamName.toLowerCase()),
        )
        if (hasIncompat) {
          validation = { valid: false, reason: 'Incompatibilidad con equipo' }
        }
      }

      return {
        id: person.id,
        name: person.name,
        role: person.role,
        category: person.category,
        municipalityId: person.municipalityId,
        municipalityName: municipality?.name ?? '',
        travelCost: cost,
        travelKm: km,
        matchesAssigned: assignedCounts.get(person.id) ?? 0,
        validation,
        matchdayNotes: matchdayAvail?.notes?.trim() ? matchdayAvail.notes : null,
      }
    })
}
