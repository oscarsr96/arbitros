import { NextResponse } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  getMockPerson,
  getMockMatch,
  getMockVenue,
  getMockMunicipality,
  getMockDesignationsForMatch,
  getPersonTravelCost,
  calculateDailyTravelCost,
  calculateMockTravelCost,
  mockHistoricalMatchdays,
} from '@/lib/mock-data'

// El coste de desplazamiento es POR PERSONA Y DÍA (regla FBM 2026-07-11), no la
// suma de costes por partido: todas las agregaciones de dinero agrupan las
// designaciones por (persona, día) y aplican calculateDailyTravelCost.

const CURRENT_MATCHDAY = 15

export async function GET() {
  // ── Normalizar designaciones (actuales + históricas) a días de persona ──
  type DayGroup = { personId: string; matchday: number; personMuni: string; munis: string[] }
  const groups = new Map<string, DayGroup>()
  const push = (personId: string, matchday: number, dayKey: string, muni: string) => {
    const key = `${personId}|${matchday}|${dayKey}`
    let g = groups.get(key)
    if (!g) {
      g = {
        personId,
        matchday,
        personMuni: getMockPerson(personId)?.municipalityId ?? '',
        munis: [],
      }
      groups.set(key, g)
    }
    g.munis.push(muni)
  }

  for (const d of mockDesignations) {
    const match = getMockMatch(d.matchId)
    if (!match) continue
    const venue = getMockVenue(match.venueId)
    push(d.personId, CURRENT_MATCHDAY, match.date, venue?.municipalityId ?? '')
  }
  for (const h of mockHistoricalMatchdays) {
    for (const d of h.designations) {
      // El histórico se agrupa por jornada (no hay fecha por partido).
      push(d.personId, h.matchday, `h${h.matchday}`, d.venueMunicipalityId)
    }
  }

  // Coste diario por grupo (persona · jornada · día)
  const days = [...groups.values()].map((g) => {
    const { cost, km } = calculateDailyTravelCost(g.personMuni, g.munis)
    return { ...g, cost, km, matches: g.munis.length }
  })

  // ── Cobertura (por partido, sin cambios) ──
  let covered = 0
  let partial = 0
  let uncovered = 0
  for (const match of mockMatches) {
    const desigs = getMockDesignationsForMatch(match.id)
    const refs = desigs.filter((d) => d.role === 'arbitro').length
    const scorers = desigs.filter((d) => d.role === 'anotador').length
    if (refs >= match.refereesNeeded && scorers >= match.scorersNeeded) covered++
    else if (refs > 0 || scorers > 0) partial++
    else uncovered++
  }

  // ── Coste total de la jornada actual (por día) ──
  const totalCost = days
    .filter((d) => d.matchday === CURRENT_MATCHDAY)
    .reduce((sum, d) => sum + d.cost, 0)

  // ── Carga y coste por persona (jornada actual) ──
  const loadByPerson = mockPersons.map((person) => {
    const desigs = mockDesignations.filter((d) => d.personId === person.id)
    return {
      personId: person.id,
      name: person.name,
      role: person.role,
      matchesAssigned: desigs.length,
      totalCost: getPersonTravelCost(person.id, desigs).totalCost,
    }
  })

  // ── Liquidación por persona (jornada actual): detalle por partido (coste
  //    ESTIMADO por partido, informativo) + total y desglose reales por día. ──
  const liquidation = mockPersons
    .map((person) => {
      const municipality = getMockMunicipality(person.municipalityId)
      const desigs = mockDesignations.filter((d) => d.personId === person.id)
      const matches = desigs.map((d) => {
        const match = getMockMatch(d.matchId)
        const venue = match ? getMockVenue(match.venueId) : undefined
        const est = calculateMockTravelCost(person.municipalityId, venue?.municipalityId ?? '')
        return {
          matchId: d.matchId,
          date: match?.date ?? '',
          time: match?.time ?? '',
          homeTeam: match?.homeTeam ?? '',
          awayTeam: match?.awayTeam ?? '',
          venue: venue?.name ?? '',
          travelCost: est.cost,
          distanceKm: est.km,
        }
      })
      const { totalCost: total, byDay } = getPersonTravelCost(person.id, desigs)
      return {
        personId: person.id,
        name: person.name,
        role: person.role,
        municipality: municipality?.name ?? '',
        bankIban: person.bankIban,
        matches,
        byDay,
        totalCost: total,
      }
    })
    .filter((p) => p.matches.length > 0)

  // ── Coste por jornada (histórico + actual), todo por día ──
  const costByMatchdayMap = new Map<number, { cost: number; matches: number }>()
  for (const d of days) {
    const e = costByMatchdayMap.get(d.matchday) ?? { cost: 0, matches: 0 }
    e.cost += d.cost
    e.matches += d.matches
    costByMatchdayMap.set(d.matchday, e)
  }
  const costByMatchday = [...costByMatchdayMap.entries()]
    .map(([matchday, e]) => ({
      matchday,
      cost: Number(e.cost.toFixed(2)),
      // matches actuales = nº de partidos de la jornada; histórico = designaciones
      matches: matchday === CURRENT_MATCHDAY ? mockMatches.length : e.matches,
    }))
    .sort((a, b) => a.matchday - b.matchday)

  // ── Coste por municipio: atribución consistente con la regla por día ──
  // Día con salida → cada municipio de destino recibe su trayecto; día en el
  // municipio propio → el fijo se atribuye al municipio propio.
  const muniCostMap: Record<string, { totalCost: number; count: number }> = {}
  const addMuni = (muniId: string, cost: number) => {
    const name = getMockMunicipality(muniId)?.name ?? muniId
    if (!muniCostMap[name]) muniCostMap[name] = { totalCost: 0, count: 0 }
    muniCostMap[name].totalCost += cost
    muniCostMap[name].count++
  }
  for (const d of days) {
    const away = [...new Set(d.munis)].filter((id) => id !== d.personMuni)
    if (away.length > 0) {
      for (const m of away) addMuni(m, calculateDailyTravelCost(d.personMuni, [m]).cost)
    } else {
      addMuni(d.personMuni, d.cost)
    }
  }
  const costByMunicipality = Object.entries(muniCostMap)
    .map(([municipality, data]) => ({
      municipality,
      totalCost: Number(data.totalCost.toFixed(2)),
      count: data.count,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)

  // ── Liquidación mensual: por persona, agregando jornadas (histórico + actual) ──
  const monthlyMap: Record<
    string,
    {
      personId: string
      name: string
      role: string
      municipality: string
      bankIban: string
      matchdays: { matchday: number; matches: number; cost: number; km: number }[]
      totalMatches: number
      totalKm: number
      totalCost: number
    }
  > = {}
  for (const d of days) {
    if (!monthlyMap[d.personId]) {
      const person = getMockPerson(d.personId)
      const municipality = person ? getMockMunicipality(person.municipalityId) : undefined
      monthlyMap[d.personId] = {
        personId: d.personId,
        name: person?.name ?? d.personId,
        role: person?.role ?? '',
        municipality: municipality?.name ?? '',
        bankIban: person?.bankIban ?? '',
        matchdays: [],
        totalMatches: 0,
        totalKm: 0,
        totalCost: 0,
      }
    }
    const p = monthlyMap[d.personId]
    // Una persona puede tener varios días dentro de una misma jornada (sáb+dom):
    // se acumulan en la misma entrada de jornada.
    let md = p.matchdays.find((m) => m.matchday === d.matchday)
    if (!md) {
      md = { matchday: d.matchday, matches: 0, cost: 0, km: 0 }
      p.matchdays.push(md)
    }
    md.matches += d.matches
    md.cost = Number((md.cost + d.cost).toFixed(2))
    md.km = Number((md.km + d.km).toFixed(1))
    p.totalMatches += d.matches
    p.totalKm = Number((p.totalKm + d.km).toFixed(1))
    p.totalCost = Number((p.totalCost + d.cost).toFixed(2))
  }
  const monthlyLiquidation = Object.values(monthlyMap)
    .map((p) => ({ ...p, matchdays: p.matchdays.sort((a, b) => a.matchday - b.matchday) }))
    .filter((p) => p.totalMatches > 0)
    .sort((a, b) => b.totalCost - a.totalCost)

  return NextResponse.json({
    summary: {
      totalCost: Number(totalCost.toFixed(2)),
      totalMatches: mockMatches.length,
      covered,
      partial,
      uncovered,
      matchday: CURRENT_MATCHDAY,
    },
    loadByPerson,
    liquidation,
    costByMatchday,
    costByMunicipality,
    monthlyLiquidation,
  })
}
