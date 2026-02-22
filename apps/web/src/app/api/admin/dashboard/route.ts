import { NextResponse } from 'next/server'
import {
  mockMatches,
  mockDesignations,
  mockPersons,
  mockAvailabilities,
  getMockVenue,
  getMockCompetition,
  getMockDesignationsForMatch,
} from '@/lib/mock-data'
import type { DashboardStats, DashboardAlert } from '@/lib/types'

export async function GET() {
  const totalMatches = mockMatches.length

  // Calculate coverage per match
  let coveredMatches = 0
  let partiallyCovered = 0
  let uncoveredMatches = 0

  for (const match of mockMatches) {
    const desigs = getMockDesignationsForMatch(match.id)
    const activeDesigs = desigs.filter((d) => d.status !== 'rejected')
    const refs = activeDesigs.filter((d) => d.role === 'arbitro').length
    const scorers = activeDesigs.filter((d) => d.role === 'anotador').length

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

  // Persons with any availability
  const personsWithAvail = new Set(mockAvailabilities.map((a) => a.personId))
  const refereesAvailable = mockPersons.filter(
    (p) => p.role === 'arbitro' && personsWithAvail.has(p.id),
  ).length
  const scorersAvailable = mockPersons.filter(
    (p) => p.role === 'anotador' && personsWithAvail.has(p.id),
  ).length

  const estimatedCost = mockDesignations
    .filter((d) => d.status !== 'rejected')
    .reduce((sum, d) => sum + parseFloat(d.travelCost), 0)

  const totalDesigs = mockDesignations.filter((d) => d.status !== 'rejected').length
  const confirmedDesigs = mockDesignations.filter(
    (d) => d.status === 'confirmed' || d.status === 'completed',
  ).length
  const confirmationRate = totalDesigs > 0 ? Math.round((confirmedDesigs / totalDesigs) * 100) : 0

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
    confirmationRate,
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

  const rejectedDesigs = mockDesignations.filter((d) => d.status === 'rejected')
  if (rejectedDesigs.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${rejectedDesigs.length} designación${rejectedDesigs.length !== 1 ? 'es' : ''} rechazada${rejectedDesigs.length !== 1 ? 's' : ''} — necesitan sustituto`,
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

  return NextResponse.json({ stats, alerts })
}
