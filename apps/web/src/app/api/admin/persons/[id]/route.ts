import { NextResponse } from 'next/server'
import {
  getMockPerson,
  getMockMunicipality,
  getMockDesignationsForPerson,
  getMockAvailabilitiesForPerson,
  getPersonIncompatibilities,
  getPersonTravelCost,
} from '@/lib/mock-data'
import {
  resolveDesignationFee,
  sumDesignationFees,
  type DesignationFeeEntry,
} from '@/lib/designation-fees'

function getCurrentWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const person = getMockPerson(params.id)
  if (!person) {
    return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
  }

  const municipality = getMockMunicipality(person.municipalityId)
  const designations = getMockDesignationsForPerson(person.id)
  const weekStart = getCurrentWeekStart()
  const availability = getMockAvailabilitiesForPerson(person.id, weekStart)
  const incompatibilities = getPersonIncompatibilities(person.id)

  // Coste real por persona y día (regla FBM), no la suma de los costes por
  // partido. Se calcula aquí y no en el cliente: `getPersonTravelCost` resuelve
  // fecha y municipio a partir del calendario completo (seed de ~10 MB).
  const travelCost = getPersonTravelCost(person.id, designations)

  // Honorarios (4.4.2): concepto SEPARADO del desplazamiento, misma fuente que
  // reports (`designation-fees.ts`). `getMockDesignationsForPerson` ya trae la
  // `competition` completa (name+category) resuelta por designación, así que
  // se resuelve directo con `resolveDesignationFee` sin memoización por
  // competición: volumen bajo (los partidos de UNA sola persona), a
  // diferencia de reports que recorre la temporada entera.
  const designationsWithFees = designations.map((d) => {
    const result = resolveDesignationFee({ role: d.role, position: d.position }, d.competition)
    return { ...d, fee: result.fee, feeReason: result.reason ?? null }
  })
  const feeEntries: DesignationFeeEntry[] = designations.map((d) => ({
    designation: { role: d.role, position: d.position },
    competition: d.competition,
  }))
  const { totalFees, unresolved: unresolvedFees } = sumDesignationFees(feeEntries)

  // Desglose por día (fecha, partidos, municipios, km, desplazamiento del
  // día): mismo formato que `monthlyLiquidation.people[].days` en
  // reports/route.ts, para que ambas vistas sean comparables campo a campo.
  const detailsByDate = new Map<
    string,
    {
      matchId: string
      date: string
      time: string
      homeTeam: string
      awayTeam: string
      venue: string
      municipality: string
    }[]
  >()
  for (const d of designations) {
    if (!d.match) continue
    const municipalityName = d.venue?.municipalityId
      ? (getMockMunicipality(d.venue.municipalityId)?.name ?? '')
      : ''
    const detail = {
      matchId: d.matchId,
      date: d.match.date,
      time: d.match.time,
      homeTeam: d.match.homeTeam,
      awayTeam: d.match.awayTeam,
      venue: d.venue?.name ?? '',
      municipality: municipalityName,
    }
    const list = detailsByDate.get(d.match.date)
    if (list) list.push(detail)
    else detailsByDate.set(d.match.date, [detail])
  }
  const byDay = travelCost.byDay.map((day) => {
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

  // Total de temporada = desplazamiento (fuente: getPersonTravelCost, igual
  // que reports/loadByPerson) + honorarios (fuente: sumDesignationFees, igual
  // que reports). Misma suma que haría reports para esta persona en scope
  // season (invariante cubierto por test).
  const totalCost = Number((travelCost.totalCost + totalFees).toFixed(2))

  return NextResponse.json({
    person: { ...person, municipality },
    designations: designationsWithFees,
    availability,
    incompatibilities,
    totalTravelCost: travelCost.totalCost,
    byDay,
    totalFees,
    unresolvedFees,
    totalCost,
  })
}
