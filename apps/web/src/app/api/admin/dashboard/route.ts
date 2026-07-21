import { NextRequest, NextResponse } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  mockAvailabilities,
  getMockVenue,
  calculatePersonTravelCost,
  type MockDesignation,
} from '@/lib/mock-data'
import { formatLocalDate } from '@/lib/mock-data-client'
import { parseMatchRange, filterMatchesByRange, resolveDefaultJornada } from '@/lib/match-query'
import { getJornadaSaturdayForDate, getMatchdayWindow } from '@/lib/matchday-availability'
import type { DashboardStats, DashboardAlert } from '@/lib/types'

// GET /api/admin/dashboard
//   ?jornada=YYYY-MM-DD  → resumen de esa jornada FBM (viernes→jueves)
//   ?from=&to=           → rango explícito
//   sin parámetros       → jornada por defecto (resolveDefaultJornada): la de
//                          hoy si tiene partidos, si no la próxima futura, si
//                          no la última jugada (caso real hoy: fuera de
//                          temporada por el final).
//
// Antes agregaba sobre mockMatches ENTERO sin acotar por jornada: con el seed
// real (24.508 partidos, temporada completa) el designador veía la cobertura y
// el coste de NUEVE MESES de competición en la primera pantalla, en vez de la
// jornada que va a designar (CLAUDE.md Fase 2: "Resumen de jornada"). Acotar a
// la ventana arregla también el cuadrático de `estimatedCost`, que recorría
// las 1.279 personas × 122.670 designaciones con `.filter()` por persona.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const hasRangeParams =
    searchParams.has('jornada') || searchParams.has('from') || searchParams.has('to')

  const todayISO = formatLocalDate(new Date())
  const defaultJornada = hasRangeParams ? null : resolveDefaultJornada(mockMatches, todayISO)

  const range = hasRangeParams
    ? parseMatchRange(searchParams)
    : defaultJornada
      ? { from: defaultJornada.from, to: defaultJornada.to }
      : {}

  const windowMatches = filterMatchesByRange(mockMatches, range)
  const totalMatches = windowMatches.length

  // Índice de designaciones por partido, construido una vez por request (mismo
  // patrón que matches/route.ts): resolverlas con getMockDesignationsForMatch
  // por partido es O(partidos × designaciones) porque esa función filtra
  // mockDesignations entero en cada llamada.
  const designationsByMatch = new Map<string, MockDesignation[]>()
  for (const d of mockDesignations) {
    const list = designationsByMatch.get(d.matchId)
    if (list) list.push(d)
    else designationsByMatch.set(d.matchId, [d])
  }
  const NO_DESIGNATIONS: MockDesignation[] = []

  // Cobertura, solo de los partidos de la ventana
  let coveredMatches = 0
  let partiallyCovered = 0
  let uncoveredMatches = 0

  for (const match of windowMatches) {
    const desigs = designationsByMatch.get(match.id) ?? NO_DESIGNATIONS
    const refs = desigs.filter((d) => d.role === 'arbitro').length
    const scorers = desigs.filter((d) => d.role === 'anotador').length

    if (refs >= match.refereesNeeded && scorers >= match.scorersNeeded) {
      coveredMatches++
    } else if (refs > 0 || scorers > 0) {
      partiallyCovered++
    } else {
      uncoveredMatches++
    }
  }

  const totalReferees = mockPersons.filter((p) => p.role === 'arbitro').length
  const totalScorers = mockPersons.filter((p) => p.role === 'anotador').length

  // Disponibilidad dentro de la ventana: una persona cuenta si tiene ≥1 slot
  // (weekStart+dayOfWeek) cuya fecha cae en [from, to]. Se cachea la conversión
  // slot→fecha (solo hay unas pocas decenas de combinaciones weekStart/dayOfWeek
  // distintas en toda la temporada) y se corta en cuanto una persona ya cuenta,
  // para no recorrer el resto de sus slots de temporada una vez encontrado uno
  // dentro de la ventana.
  const slotDateCache = new Map<string, string>()
  function slotDate(weekStart: string, dayOfWeek: number): string {
    const key = `${weekStart}|${dayOfWeek}`
    let date = slotDateCache.get(key)
    if (!date) {
      const d = new Date(weekStart + 'T00:00:00')
      d.setDate(d.getDate() + dayOfWeek)
      date = formatLocalDate(d)
      slotDateCache.set(key, date)
    }
    return date
  }

  const personsWithAvail = new Set<string>()
  for (const a of mockAvailabilities) {
    if (personsWithAvail.has(a.personId)) continue
    const date = slotDate(a.weekStart, a.dayOfWeek)
    if (range.from && date < range.from) continue
    if (range.to && date > range.to) continue
    personsWithAvail.add(a.personId)
  }

  const refereesAvailable = mockPersons.filter(
    (p) => p.role === 'arbitro' && personsWithAvail.has(p.id),
  ).length
  const scorersAvailable = mockPersons.filter(
    (p) => p.role === 'anotador' && personsWithAvail.has(p.id),
  ).length

  // Coste estimado real por persona y día, solo con las designaciones de la
  // ventana. Se usa calculatePersonTravelCost directamente (en vez de
  // getPersonTravelCost, que resuelve fecha y municipio con getMockMatch/
  // getMockVenue por CADA designación, un .find() sobre 24.508 partidos):
  // match y venue ya están resueltos aquí al recorrer windowMatches, así que se
  // pasan directos y el resultado es idéntico (misma función de cálculo).
  const venueMuniCache = new Map<string, string>()
  function venueMunicipality(venueId: string): string {
    let muni = venueMuniCache.get(venueId)
    if (muni === undefined) {
      muni = getMockVenue(venueId)?.municipalityId ?? ''
      venueMuniCache.set(venueId, muni)
    }
    return muni
  }

  const travelItemsByPerson = new Map<string, { date: string; venueMunicipalityId: string }[]>()
  for (const match of windowMatches) {
    const desigs = designationsByMatch.get(match.id)
    if (!desigs || desigs.length === 0) continue
    const venueMunicipalityId = venueMunicipality(match.venueId)
    for (const d of desigs) {
      const item = { date: match.date, venueMunicipalityId }
      const list = travelItemsByPerson.get(d.personId)
      if (list) list.push(item)
      else travelItemsByPerson.set(d.personId, [item])
    }
  }

  const personMuniById = new Map<string, string>()
  for (const p of mockPersons) personMuniById.set(p.id, p.municipalityId)

  let estimatedCost = 0
  for (const [personId, items] of travelItemsByPerson) {
    estimatedCost += calculatePersonTravelCost(personMuniById.get(personId) ?? '', items).totalCost
  }

  const stats: DashboardStats = {
    totalMatches,
    coveredMatches,
    partiallyCovered,
    uncoveredMatches,
    totalReferees,
    totalScorers,
    refereesAvailable,
    scorersAvailable,
    estimatedCost: Number(estimatedCost.toFixed(2)),
  }

  // Generate alerts
  const alerts: DashboardAlert[] = []

  if (uncoveredMatches > 0) {
    alerts.push({
      type: 'error',
      message: `${uncoveredMatches} partido${uncoveredMatches !== 1 ? 's' : ''} sin ninguna asignación`,
      link: '/partidos?coverage=uncovered',
    })
  }

  if (partiallyCovered > 0) {
    alerts.push({
      type: 'warning',
      message: `${partiallyCovered} partido${partiallyCovered !== 1 ? 's' : ''} parcialmente cubierto${partiallyCovered !== 1 ? 's' : ''}`,
      link: '/partidos?coverage=partial',
    })
  }

  const personsWithoutAvail = mockPersons.filter((p) => !personsWithAvail.has(p.id))
  if (personsWithoutAvail.length > 0) {
    alerts.push({
      type: 'info',
      message: `${personsWithoutAvail.length} persona${personsWithoutAvail.length !== 1 ? 's' : ''} sin disponibilidad registrada`,
      link: '/personal',
    })
  }

  // Jornada resumida, para que la UI la muestre. Se deriva del rango realmente
  // aplicado (no solo del caso por defecto): con ?jornada= o ?from=/&to=
  // explícitos también describe la ventana usada.
  const anchorDate = range.from ?? range.to ?? todayISO
  const jornadaSaturday = getJornadaSaturdayForDate(anchorDate)
  const jornadaWindow = getMatchdayWindow(jornadaSaturday)
  const jornada = {
    saturday: jornadaSaturday,
    from: jornadaWindow.friday,
    to: jornadaWindow.thursday,
  }

  return NextResponse.json({ stats, alerts, jornada })
}
