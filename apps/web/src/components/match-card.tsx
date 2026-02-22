'use client'

import { MatchStatusBadge } from '@/components/match-status-badge'
import { CoverageIndicator } from '@/components/coverage-indicator'
import { MapPin, Clock } from 'lucide-react'
import type { EnrichedMatch } from '@/lib/types'

interface MatchCardProps {
  match: EnrichedMatch
  expanded?: boolean
  onToggle?: () => void
  children?: React.ReactNode
}

export function MatchCard({ match, expanded, onToggle, children }: MatchCardProps) {
  const dateStr = new Date(match.date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div
        className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
          onToggle ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {match.homeTeam} vs {match.awayTeam}
            </span>
            <MatchStatusBadge status={match.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateStr} · {match.time}
            </span>
            {match.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {match.venue.name}
              </span>
            )}
            {match.competition && <span className="text-gray-400">{match.competition.name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
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
          {onToggle && (
            <span className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
              ▾
            </span>
          )}
        </div>
      </div>
      {expanded && children && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">{children}</div>
      )}
    </div>
  )
}
