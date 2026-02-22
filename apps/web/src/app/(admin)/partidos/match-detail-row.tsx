'use client'

import { MatchStatusBadge } from '@/components/match-status-badge'
import { CoverageIndicator } from '@/components/coverage-indicator'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import type { EnrichedMatch } from '@/lib/types'

interface MatchDetailRowProps {
  match: EnrichedMatch
  expanded: boolean
  onToggle: () => void
  dateStr: string
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  notified: 'Notificado',
  confirmed: 'Confirmado',
  rejected: 'Rechazado',
}

export function MatchDetailRow({ match, expanded, onToggle, dateStr }: MatchDetailRowProps) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-medium text-gray-900">{dateStr}</span>
          <br />
          <span className="text-xs text-gray-500">{match.time}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm font-medium text-gray-900">
            {match.homeTeam} vs {match.awayTeam}
          </span>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <span className="text-xs text-gray-600">{match.venue?.name ?? '-'}</span>
        </td>
        <td className="hidden px-4 py-3 lg:table-cell">
          <span className="text-xs text-gray-600">{match.competition?.name ?? '-'}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <CoverageIndicator
              assigned={match.refereesAssigned}
              needed={match.refereesNeeded}
              label="Árb."
            />
            <CoverageIndicator
              assigned={match.scorersAssigned}
              needed={match.scorersNeeded}
              label="Anot."
            />
          </div>
        </td>
        <td className="px-4 py-3">
          <MatchStatusBadge status={match.status} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50/70 px-4 py-4">
            <div className="ml-8 space-y-3">
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                {match.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {match.venue.name} — {match.venue.address}
                  </span>
                )}
                <span>Jornada {match.matchday}</span>
              </div>

              {/* Designations */}
              <div>
                <h4 className="mb-2 text-xs font-semibold text-gray-700">
                  Asignaciones ({match.designations.length})
                </h4>
                {match.designations.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin asignaciones</p>
                ) : (
                  <div className="space-y-1.5">
                    {match.designations.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5"
                      >
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            d.role === 'arbitro'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-purple-200 bg-purple-50 text-purple-700'
                          }`}
                        >
                          {d.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900">
                          {d.person?.name ?? 'Desconocido'}
                        </span>
                        <span className="text-xs text-gray-500">{d.municipality?.name ?? ''}</span>
                        <span className="text-xs text-gray-400">
                          {d.travelCost} € · {d.distanceKm} km
                        </span>
                        <Badge
                          variant="outline"
                          className={`ml-auto text-xs ${
                            d.status === 'confirmed'
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : d.status === 'rejected'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : d.status === 'notified'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {statusLabels[d.status] ?? d.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
