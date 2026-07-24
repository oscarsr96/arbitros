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
import {
  sumDesignationFees,
  feeBasesCategoryOf,
  type DesignationFeeEntry,
} from '@/lib/designation-fees'
import { FEES_BY_BASES_CATEGORY, type BasesCategory } from '@/lib/fbm-calendar/bases-fbm'
import { isValidPositionForRole } from '@/lib/designation-positions'
import { formatLocalDate } from '@/lib/mock-data-client'
import {
  resolveDefaultJornada,
  filterMatchesByRange,
  parseMatchRange,
  getMatchesDateRange,
  getMonthRange,
  type MatchDateRange,
} from '@/lib/match-query'
import { getMatchdayWindow, getJornadaSaturdayForDate } from '@/lib/matchday-availability'

// El coste de desplazamiento es POR PERSONA Y DÍA (regla FBM 2026-07-11), no la
// suma de costes por partido: todas las agregaciones de dinero agrupan las
// designaciones por (persona, día) y aplican calculateDailyTravelCost.
//
// A diferencia de dashboard/optimize, reports SÍ agrega por TEMPORADA y por
// MES a propósito (CLAUDE.md Fase 4: "coste total por jornada / mes /
// temporada"): costByMatchday, costByMonth, costByMunicipality y
// coverageHistory cubren SIEMPRE la temporada entera, vengan los parámetros
// que vengan. `summary`, `loadByPerson` y `liquidation` responden al ámbito
// elegido (`?jornada=` | `?month=` | `?scope=season`): es la vista "de
// trabajo" del designador para ESE ámbito. `monthlyLiquidation` (4.3.1) es un
// tercer eje, independiente de `scope`: SIEMPRE un mes natural (el de
// `?month=` si se da, si no el mes que contiene el `from` del ámbito elegido,
// o el mes real de hoy en `scope=season`), con desglose por día y honorarios
// incluidos — la vista de liquidación mensual real, no un bloque de jornadas.
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

  // ── Liquidación mensual (4.3.1): MES NATURAL con desglose POR DÍA, no un
  //    bloque de jornadas (sustituye la agregación anterior por Nº de
  //    matchday). Agrupa igual que `calculatePersonTravelCost`: por
  //    (persona, fecha real), nunca por matchday (bug del cabo 4: dos
  //    competiciones distintas el mismo día real no deben pagar dos fijos).
  //    Reparto de mes: cada partido cuenta en SU mes por fecha real
  //    (`filterMatchesByRange`/`getMonthRange` filtran por `date`, así que un
  //    partido de viernes 31 y otro de sábado 1 caen en meses distintos aunque
  //    compartan jornada FBM). Mes por defecto (sin `?month=`): el que
  //    contiene el `from` del ámbito elegido, o el mes real de hoy si no hay
  //    rango (scope=season). ──
  const liquidationMonth = monthParam ?? (range.from ?? todayISO).slice(0, 7)
  const liquidationMonthRange = getMonthRange(liquidationMonth)
  const liquidationMonthMatches = filterMatchesByRange(mockMatches, liquidationMonthRange)

  interface MonthlyMatchDetail {
    matchId: string
    date: string
    time: string
    homeTeam: string
    awayTeam: string
    venue: string
    municipality: string
  }
  const monthDetailsByPerson = new Map<string, MonthlyMatchDetail[]>()
  const monthItemsByPerson = new Map<string, { date: string; venueMunicipalityId: string }[]>()
  const monthFeeCentsByPerson = new Map<string, { cents: number; unresolved: number }>()

  // Memoización OBLIGATORIA por competitionId (4.1.4 midió que resolver la
  // categoría de Bases por DESIGNACIÓN, a escala de temporada, rompe el
  // umbral de 3s): `feeBasesCategoryOf` tokeniza nombre/categoría contra ~48
  // reglas, así que se resuelve UNA vez por competición y se reutiliza para
  // todas sus designaciones del mes. El importe final por rol/posición es un
  // lookup directo en `FEES_BY_BASES_CATEGORY` (barato); se replica aquí en
  // vez de reusar `resolveDesignationFee` porque esa función retokeniza en
  // cada llamada (no acepta una `basesCategory` ya resuelta).
  const basesCategoryByCompetition = new Map<string, BasesCategory | null>()

  for (const match of liquidationMonthMatches) {
    const desigs = designationsByMatch.get(match.id)
    if (!desigs || desigs.length === 0) continue
    const venue = venuesById.get(match.venueId)
    const venueMunicipalityId = venue?.municipalityId ?? ''
    const municipalityName = venueMunicipalityId
      ? (municipalitiesById.get(venueMunicipalityId)?.name ?? '')
      : ''

    let basesCategory: BasesCategory | null
    if (basesCategoryByCompetition.has(match.competitionId)) {
      basesCategory = basesCategoryByCompetition.get(match.competitionId) ?? null
    } else {
      const competition = competitionsById.get(match.competitionId)
      basesCategory = competition ? feeBasesCategoryOf(competition) : null
      basesCategoryByCompetition.set(match.competitionId, basesCategory)
    }
    const fees = basesCategory ? FEES_BY_BASES_CATEGORY[basesCategory] : null

    for (const d of desigs) {
      const detail: MonthlyMatchDetail = {
        matchId: match.id,
        date: match.date,
        time: match.time,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        venue: venue?.name ?? '',
        municipality: municipalityName,
      }
      const detailList = monthDetailsByPerson.get(d.personId)
      if (detailList) detailList.push(detail)
      else monthDetailsByPerson.set(d.personId, [detail])

      const itemList = monthItemsByPerson.get(d.personId)
      const item = { date: match.date, venueMunicipalityId }
      if (itemList) itemList.push(item)
      else monthItemsByPerson.set(d.personId, [item])

      let fee: number | null = null
      if (fees) {
        if (d.position !== undefined) {
          fee = isValidPositionForRole(d.position, d.role) ? fees[d.position] : null
        } else if (d.role === 'arbitro') {
          fee = fees.principal
        }
      }
      const feeAgg = monthFeeCentsByPerson.get(d.personId) ?? { cents: 0, unresolved: 0 }
      if (fee === null) feeAgg.unresolved++
      else feeAgg.cents += Math.round(fee * 100)
      monthFeeCentsByPerson.set(d.personId, feeAgg)
    }
  }

  const monthlyLiquidationPeople = [...monthItemsByPerson.entries()]
    .map(([personId, items]) => {
      const person = personsById.get(personId)
      const municipality = person ? municipalitiesById.get(person.municipalityId) : undefined
      const { totalCost: travelCost, byDay } = calculatePersonTravelCost(
        person?.municipalityId ?? '',
        items,
      )

      const detailsByDate = new Map<string, MonthlyMatchDetail[]>()
      for (const detail of monthDetailsByPerson.get(personId) ?? []) {
        const list = detailsByDate.get(detail.date)
        if (list) list.push(detail)
        else detailsByDate.set(detail.date, [detail])
      }

      const days = byDay.map((day) => {
        const dayMatches = (detailsByDate.get(day.date) ?? [])
          .slice()
          .sort((a, b) => a.time.localeCompare(b.time))
        return {
          date: day.date,
          matches: dayMatches,
          municipalities: [...new Set(dayMatches.map((m) => m.municipality))],
          km: day.km,
          travelCost: day.cost,
        }
      })

      const feeAgg = monthFeeCentsByPerson.get(personId) ?? { cents: 0, unresolved: 0 }
      const fees = feeAgg.cents / 100
      const total = Number((travelCost + fees).toFixed(2))

      return {
        personId,
        name: person?.name ?? personId,
        role: person?.role ?? '',
        municipality: municipality?.name ?? '',
        bankIban: person?.bankIban ?? '',
        days,
        travelCost,
        fees,
        total,
        unresolvedFees: feeAgg.unresolved,
      }
    })
    .sort((a, b) => b.total - a.total)

  const monthlyTotalTravelCost = Number(
    monthlyLiquidationPeople.reduce((sum, p) => sum + p.travelCost, 0).toFixed(2),
  )
  const monthlyTotalFees = Number(
    monthlyLiquidationPeople.reduce((sum, p) => sum + p.fees, 0).toFixed(2),
  )
  const monthlyLiquidation = {
    month: liquidationMonth,
    people: monthlyLiquidationPeople,
    totalTravelCost: monthlyTotalTravelCost,
    totalFees: monthlyTotalFees,
    total: Number((monthlyTotalTravelCost + monthlyTotalFees).toFixed(2)),
  }

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
