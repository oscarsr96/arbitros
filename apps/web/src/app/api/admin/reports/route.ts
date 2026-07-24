import { NextRequest, NextResponse } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  mockVenues,
  mockMunicipalities,
  mockCompetitions,
  calculateDailyTravelCost,
  calculatePersonTravelCost,
  calculateMockTravelCost,
  type MockDesignation,
} from '@/lib/mock-data'
import { sumDesignationFees, type DesignationFeeEntry } from '@/lib/designation-fees'
import { formatLocalDate } from '@/lib/mock-data-client'
import {
  resolveDefaultJornada,
  filterMatchesByRange,
  parseMatchRange,
  getMatchesDateRange,
  type MatchDateRange,
} from '@/lib/match-query'
import { getMatchdayWindow, getJornadaSaturdayForDate } from '@/lib/matchday-availability'

// El coste de desplazamiento es POR PERSONA Y DÍA (regla FBM 2026-07-11), no la
// suma de costes por partido: todas las agregaciones de dinero agrupan las
// designaciones por (persona, día) y aplican calculateDailyTravelCost.
//
// A diferencia de dashboard/optimize, reports SÍ agrega por TEMPORADA y por
// MES a propósito (CLAUDE.md Fase 4: "coste total por jornada / mes /
// temporada"): costByMatchday, costByMonth, costByMunicipality,
// monthlyLiquidation y coverageHistory cubren SIEMPRE la temporada entera,
// vengan los parámetros que vengan. Lo único que responde al ámbito elegido
// (`?jornada=` | `?month=` | `?scope=season`) es `summary`, `loadByPerson` y
// `liquidation` (la vista "de trabajo" del designador para ESE ámbito).
//
// GET /api/admin/reports
//   ?jornada=YYYY-MM-DD  → ventana de esa jornada FBM (viernes→jueves)
//   ?month=YYYY-MM       → mes natural completo
//   ?scope=season        → temporada completa
//   sin parámetros       → jornada por defecto (resolveDefaultJornada): la de
//                          hoy si tiene partidos, si no la próxima futura, si
//                          no la última jugada.
//
// Antes `summary.totalCost` filtraba por `matchday === currentMatchday`
// (bug P6): una ventana viernes→jueves mezcla ~48 competiciones con su propio
// contador de matchday {1..6}, así que solo se sumaba una de ellas
// (infracálculo medido de ~67% en la jornada 2025-10-25). Ahora `summary`,
// `loadByPerson` y `liquidation` se acotan por FECHA REAL (`windowMatches`),
// nunca por número de matchday, y `totalCost` se deriva de la MISMA suma por
// persona que `loadByPerson` (fuente única, sin construir un total aparte).

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const todayISO = formatLocalDate(new Date())

  const jornadaParam = searchParams.get('jornada')
  const monthParam = searchParams.get('month')
  const scopeParam = searchParams.get('scope')

  let scope: 'jornada' | 'month' | 'season'
  let range: MatchDateRange
  let scopeLabel: string

  if (scopeParam === 'season') {
    scope = 'season'
    range = {}
    scopeLabel = 'season'
  } else if (monthParam) {
    scope = 'month'
    range = parseMatchRange(searchParams)
    scopeLabel = monthParam
  } else if (jornadaParam) {
    scope = 'jornada'
    range = parseMatchRange(searchParams)
    scopeLabel = jornadaParam
  } else {
    scope = 'jornada'
    const defaultJornada = resolveDefaultJornada(mockMatches, todayISO)
    range = defaultJornada ? { from: defaultJornada.from, to: defaultJornada.to } : {}
    scopeLabel = defaultJornada?.saturday ?? ''
  }

  const windowMatches = filterMatchesByRange(mockMatches, range)
  // Representativo únicamente para resaltar la barra "actual" en el gráfico de
  // costByMatchday de la UI: NO se usa para sumar dinero (ver nota de cabecera).
  const currentMatchday = scope === 'jornada' ? (windowMatches[0]?.matchday ?? 0) : null
  const seasonRange = getMatchesDateRange(mockMatches)

  // ── Índices por request ──────────────────────────────────────────────────
  // Con la temporada real (24.508 partidos, ~122.670 designaciones si está
  // toda diseñada), resolver cada matchId/personId/venueId con los helpers
  // `getMock*` (que hacen `.find()` sobre el array entero) dentro de un bucle
  // sobre TODAS las designaciones es un cuadrático severo: mismo patrón que
  // `matches/route.ts:44-56` (medido ahí: 3.282 ms → 13 ms). Nada de caché de
  // módulo: se reconstruyen en cada request.
  const matchesById = new Map<string, (typeof mockMatches)[number]>()
  for (const m of mockMatches) matchesById.set(m.id, m)

  const venuesById = new Map<string, (typeof mockVenues)[number]>()
  for (const v of mockVenues) venuesById.set(v.id, v)

  const municipalitiesById = new Map<string, (typeof mockMunicipalities)[number]>()
  for (const m of mockMunicipalities) municipalitiesById.set(m.id, m)

  const personsById = new Map<string, (typeof mockPersons)[number]>()
  for (const p of mockPersons) personsById.set(p.id, p)

  const competitionsById = new Map<string, (typeof mockCompetitions)[number]>()
  for (const c of mockCompetitions) competitionsById.set(c.id, c)

  const designationsByMatch = new Map<string, MockDesignation[]>()
  for (const d of mockDesignations) {
    const byMatch = designationsByMatch.get(d.matchId)
    if (byMatch) byMatch.push(d)
    else designationsByMatch.set(d.matchId, [d])
  }
  const NO_DESIGNATIONS: MockDesignation[] = []

  // ── Honorarios (4.1.4): concepto SEPARADO del desplazamiento. Resuelve la
  //    fila de Bases de cada designación vía su partido→competición completa
  //    (name+category, ver designation-fees.ts) y agrega con
  //    `sumDesignationFees`. Nunca se mezcla con el kilometraje. ──
  const buildFeeEntries = (desigs: readonly MockDesignation[]): DesignationFeeEntry[] =>
    desigs.map((d) => {
      const match = matchesById.get(d.matchId)
      const competition = match ? competitionsById.get(match.competitionId) : undefined
      return { designation: d, competition }
    })

  // ── Un único recorrido de TODAS las designaciones: alimenta dos ejes
  //    independientes de temporada completa ──
  //    (a) `groups`/`days`: por (persona, matchday, día) → costByMatchday,
  //        costByMunicipality, monthlyLiquidation (sin cambios de forma).
  //    (b) `allItemsByPerson`: por (persona, día) SOLO por fecha real → fuente
  //        correcta para costByMonth (evita el sesgo de (a): si una persona
  //        trabaja el mismo día dos competiciones con matchday distinto, (a)
  //        las trata como dos días separados; ver nota en el digest).
  type DayGroup = { personId: string; matchday: number; personMuni: string; munis: string[] }
  const groups = new Map<string, DayGroup>()
  const push = (personId: string, matchday: number, dayKey: string, muni: string) => {
    const key = `${personId}|${matchday}|${dayKey}`
    let g = groups.get(key)
    if (!g) {
      g = {
        personId,
        matchday,
        personMuni: personsById.get(personId)?.municipalityId ?? '',
        munis: [],
      }
      groups.set(key, g)
    }
    g.munis.push(muni)
  }

  const allItemsByPerson = new Map<string, { date: string; venueMunicipalityId: string }[]>()

  for (const d of mockDesignations) {
    const match = matchesById.get(d.matchId)
    if (!match) continue
    const venue = venuesById.get(match.venueId)
    const venueMunicipalityId = venue?.municipalityId ?? ''

    push(d.personId, match.matchday, match.date, venueMunicipalityId)

    const item = { date: match.date, venueMunicipalityId }
    const list = allItemsByPerson.get(d.personId)
    if (list) list.push(item)
    else allItemsByPerson.set(d.personId, [item])
  }

  // Coste diario por grupo (persona · jornada · día)
  const days = [...groups.values()].map((g) => {
    const { cost, km } = calculateDailyTravelCost(g.personMuni, g.munis)
    return { ...g, cost, km, matches: g.munis.length }
  })

  // ── Cobertura del ámbito elegido ──
  // Acotada a windowMatches (no mockMatches entero): summary.totalMatches ya
  // es el tamaño de esa ventana, así que covered+partial+uncovered tienen que
  // sumar lo mismo o el % de cobertura de la UI se dispara por encima de 100.
  let covered = 0
  let partial = 0
  let uncovered = 0
  for (const match of windowMatches) {
    const desigs = designationsByMatch.get(match.id) ?? NO_DESIGNATIONS
    const refs = desigs.filter((d) => d.role === 'arbitro').length
    const scorers = desigs.filter((d) => d.role === 'anotador').length
    if (refs >= match.refereesNeeded && scorers >= match.scorersNeeded) covered++
    else if (refs > 0 || scorers > 0) partial++
    else uncovered++
  }

  // ── Designaciones e items de desplazamiento acotados a la ventana elegida
  //    (fix P2: antes loadByPerson/liquidation recorrían TODAS las
  //    designaciones de la persona, temporada entera, etiquetadas "jornada
  //    actual") ──
  const windowItemsByPerson = new Map<string, { date: string; venueMunicipalityId: string }[]>()
  const windowDesignationsByPerson = new Map<string, MockDesignation[]>()
  for (const match of windowMatches) {
    const desigs = designationsByMatch.get(match.id)
    if (!desigs || desigs.length === 0) continue
    const venue = venuesById.get(match.venueId)
    const venueMunicipalityId = venue?.municipalityId ?? ''
    for (const d of desigs) {
      const itemList = windowItemsByPerson.get(d.personId)
      const item = { date: match.date, venueMunicipalityId }
      if (itemList) itemList.push(item)
      else windowItemsByPerson.set(d.personId, [item])

      const desigList = windowDesignationsByPerson.get(d.personId)
      if (desigList) desigList.push(d)
      else windowDesignationsByPerson.set(d.personId, [d])
    }
  }
  const NO_ITEMS: { date: string; venueMunicipalityId: string }[] = []
  const NO_WINDOW_DESIGNATIONS: MockDesignation[] = []

  // ── Carga y coste por persona (ámbito elegido) ──
  const loadByPerson = mockPersons.map((person) => {
    const desigs = windowDesignationsByPerson.get(person.id) ?? NO_WINDOW_DESIGNATIONS
    const items = windowItemsByPerson.get(person.id) ?? NO_ITEMS
    const travelCost = calculatePersonTravelCost(person.municipalityId, items).totalCost
    const { totalFees, unresolved } = sumDesignationFees(buildFeeEntries(desigs))
    return {
      personId: person.id,
      name: person.name,
      role: person.role,
      matchesAssigned: desigs.length,
      totalCost: travelCost,
      fees: totalFees,
      total: Number((travelCost + totalFees).toFixed(2)),
      unresolvedFees: unresolved,
    }
  })

  // ── Coste total del ámbito elegido (fix P6): suma de loadByPerson, MISMA
  //    fuente que la vista por persona, nunca un total aparte por matchday. ──
  const totalCost = Number(loadByPerson.reduce((sum, p) => sum + p.totalCost, 0).toFixed(2))

  // ── Liquidación por persona (ámbito elegido): detalle por partido (coste
  //    ESTIMADO por partido, informativo) + total y desglose reales por día. ──
  const liquidation = mockPersons
    .map((person) => {
      const municipality = municipalitiesById.get(person.municipalityId)
      const desigs = windowDesignationsByPerson.get(person.id) ?? NO_WINDOW_DESIGNATIONS
      const resolved = desigs.map((d) => {
        const match = matchesById.get(d.matchId)
        const venue = match ? venuesById.get(match.venueId) : undefined
        return { d, match, venue }
      })
      const matches = resolved.map(({ d, match, venue }) => {
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
      const items = windowItemsByPerson.get(person.id) ?? NO_ITEMS
      const { totalCost: travelTotal, byDay } = calculatePersonTravelCost(
        person.municipalityId,
        items,
      )
      const { totalFees, unresolved } = sumDesignationFees(buildFeeEntries(desigs))
      return {
        personId: person.id,
        name: person.name,
        role: person.role,
        municipality: municipality?.name ?? '',
        bankIban: person.bankIban,
        matches,
        byDay,
        totalCost: travelTotal,
        fees: totalFees,
        total: Number((travelTotal + totalFees).toFixed(2)),
        unresolvedFees: unresolved,
      }
    })
    .filter((p) => p.matches.length > 0)

  // ── Coste por jornada (temporada completa, por número de matchday), todo
  //    por día ──
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
      matches: e.matches,
    }))
    .sort((a, b) => a.matchday - b.matchday)

  // ── Coste por mes natural (temporada completa, 4.2.3): por fecha real de
  //    partido (`date.slice(0,7)`), no por número de matchday. Se calcula
  //    aparte de `days` (que agrupa por matchday+día, ver nota de cabecera)
  //    para no heredar el sesgo de partir un mismo día real en dos grupos
  //    cuando la persona trabaja esa fecha para dos competiciones distintas. ──
  const costByMonthMap = new Map<string, { cost: number; matches: number }>()
  for (const [personId, items] of allItemsByPerson) {
    const person = personsById.get(personId)
    const { byDay } = calculatePersonTravelCost(person?.municipalityId ?? '', items)
    const countByDate = new Map<string, number>()
    for (const item of items) countByDate.set(item.date, (countByDate.get(item.date) ?? 0) + 1)
    for (const day of byDay) {
      const month = day.date.slice(0, 7)
      const e = costByMonthMap.get(month) ?? { cost: 0, matches: 0 }
      e.cost += day.cost
      e.matches += countByDate.get(day.date) ?? 0
      costByMonthMap.set(month, e)
    }
  }
  const costByMonth = [...costByMonthMap.entries()]
    .map(([month, e]) => ({ month, cost: Number(e.cost.toFixed(2)), matches: e.matches }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // ── Coste por municipio: atribución consistente con la regla por día ──
  // Día con salida → cada municipio de destino recibe su trayecto; día en el
  // municipio propio → el fijo se atribuye al municipio propio.
  const muniCostMap: Record<string, { totalCost: number; count: number }> = {}
  const addMuni = (muniId: string, cost: number) => {
    const name = municipalitiesById.get(muniId)?.name ?? muniId
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

  // ── Liquidación mensual: por persona, agregando jornadas (temporada
  //    completa, por número de matchday; 4.3.1 la sustituye por mes natural) ──
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
      const person = personsById.get(d.personId)
      const municipality = person ? municipalitiesById.get(person.municipalityId) : undefined
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
  // TODO(4.3.1): monthlyLiquidation aún agrupa por Nº de matchday (temporada
  // completa); 4.3.1 lo sustituye por mes natural. Añadir honorarios aquí
  // significaría resolver `sumDesignationFees` para TODAS las designaciones de
  // la temporada (67.872 en el barrido de rendimiento) en cada request, lo que
  // mide un salto de ~1,4 s a ~4,8 s y rompe el umbral de rendimiento del
  // handler (ver route.test.ts, "sin cuadráticos"). Forzarlo aquí para una
  // agrupación que se reescribe en breve no compensa: honorarios de
  // monthlyLiquidation se añaden en 4.3.1 junto con el cambio a mes natural.
  const monthlyLiquidation = Object.values(monthlyMap)
    .map((p) => ({ ...p, matchdays: p.matchdays.sort((a, b) => a.matchday - b.matchday) }))
    .filter((p) => p.totalMatches > 0)
    .sort((a, b) => b.totalCost - a.totalCost)

  // ── Histórico de cobertura por jornada FBM real (P5, 4.2.4): temporada
  //    completa, por VENTANA DE FECHAS viernes→jueves (no por número de
  //    matchday: el mismo error de P6 aplicado a cobertura en vez de dinero
  //    daría ~29 filas falsas mezclando semanas distintas). Un único
  //    recorrido de mockMatches. ──
  interface JornadaCoverage {
    saturday: string
    from: string
    to: string
    totalMatches: number
    covered: number
    partial: number
    uncovered: number
  }
  const coverageByJornada = new Map<string, JornadaCoverage>()
  for (const match of mockMatches) {
    const saturday = getJornadaSaturdayForDate(match.date)
    let entry = coverageByJornada.get(saturday)
    if (!entry) {
      const window = getMatchdayWindow(saturday)
      entry = {
        saturday,
        from: window.friday,
        to: window.thursday,
        totalMatches: 0,
        covered: 0,
        partial: 0,
        uncovered: 0,
      }
      coverageByJornada.set(saturday, entry)
    }
    entry.totalMatches++
    const desigs = designationsByMatch.get(match.id) ?? NO_DESIGNATIONS
    const refs = desigs.filter((d) => d.role === 'arbitro').length
    const scorers = desigs.filter((d) => d.role === 'anotador').length
    if (refs >= match.refereesNeeded && scorers >= match.scorersNeeded) entry.covered++
    else if (refs > 0 || scorers > 0) entry.partial++
    else entry.uncovered++
  }
  const coverageHistory = [...coverageByJornada.values()].sort((a, b) =>
    a.saturday.localeCompare(b.saturday),
  )

  return NextResponse.json({
    summary: {
      scope,
      scopeLabel,
      from: range.from ?? seasonRange?.minDate ?? '',
      to: range.to ?? seasonRange?.maxDate ?? '',
      matchday: currentMatchday,
      totalCost,
      totalMatches: windowMatches.length,
      covered,
      partial,
      uncovered,
    },
    loadByPerson,
    liquidation,
    costByMatchday,
    costByMonth,
    costByMunicipality,
    monthlyLiquidation,
    coverageHistory,
  })
}
