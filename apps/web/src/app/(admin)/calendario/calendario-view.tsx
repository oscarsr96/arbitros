'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { EnrichedMatch } from '@/lib/types'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 08:00 to 22:00

function getCoverageStatus(match: EnrichedMatch): 'covered' | 'partial' | 'uncovered' {
  const refs = match.designations.filter((d) => d.role === 'arbitro').length
  const scorers = match.designations.filter((d) => d.role === 'anotador').length
  if (refs >= match.refereesNeeded && scorers >= match.scorersNeeded) return 'covered'
  if (refs > 0 || scorers > 0) return 'partial'
  return 'uncovered'
}

const STATUS_COLORS = {
  covered: 'bg-green-100 border-green-300 hover:bg-green-200',
  partial: 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200',
  uncovered: 'bg-red-100 border-red-300 hover:bg-red-200',
}

const STATUS_DOT = {
  covered: 'bg-green-500',
  partial: 'bg-yellow-500',
  uncovered: 'bg-red-500',
}

export function CalendarioView() {
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/matches')
      .then((r) => r.json())
      .then((data) => setMatches(data.matches))
      .finally(() => setLoading(false))
  }, [])

  // Group matches by day
  const dates = [...new Set(matches.map((m) => m.date))].sort()
  const saturdayDate = dates[0] ?? ''
  const sundayDate = dates[1] ?? dates[0] ?? ''

  const saturdayMatches = matches.filter((m) => m.date === saturdayDate)
  const sundayMatches = matches.filter((m) => m.date === sundayDate)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  const getMatchesAtHour = (dayMatches: EnrichedMatch[], hour: number) => {
    return dayMatches.filter((m) => {
      const matchHour = parseInt(m.time.split(':')[0])
      return matchHour === hour
    })
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="mt-1 text-sm text-gray-500">Cargando...</p>
        </div>
        <div className="h-96 animate-pulse rounded-xl border bg-gray-50" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vista semanal de la jornada — {matches.length} partidos
        </p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          <span className="text-xs text-gray-600">Cubierto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
          <span className="text-xs text-gray-600">Parcial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          <span className="text-xs text-gray-600">Sin cubrir</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="grid min-w-[600px] grid-cols-[80px_1fr_1fr]">
          {/* Header */}
          <div className="border-b border-r border-gray-200 bg-gray-50 px-3 py-3">
            <span className="text-xs font-medium text-gray-500">Hora</span>
          </div>
          <div className="border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-center">
            <span className="text-sm font-semibold capitalize text-gray-800">
              {formatDate(saturdayDate)}
            </span>
          </div>
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-3 text-center">
            <span className="text-sm font-semibold capitalize text-gray-800">
              {formatDate(sundayDate)}
            </span>
          </div>

          {/* Rows by hour */}
          {HOURS.map((hour) => {
            const satMatches = getMatchesAtHour(saturdayMatches, hour)
            const sunMatches = getMatchesAtHour(sundayMatches, hour)
            const hasContent = satMatches.length > 0 || sunMatches.length > 0

            return (
              <div key={hour} className="contents">
                {/* Hour label */}
                <div
                  className={`flex items-start border-r border-gray-200 px-3 py-2 ${
                    hasContent ? 'min-h-[80px]' : 'min-h-[40px]'
                  } ${hour < 22 ? 'border-b border-gray-100' : ''}`}
                >
                  <span className="text-xs font-medium text-gray-500">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>

                {/* Saturday cell */}
                <div
                  className={`flex flex-col gap-1 border-r border-gray-200 p-1 ${
                    hasContent ? 'min-h-[80px]' : 'min-h-[40px]'
                  } ${hour < 22 ? 'border-b border-gray-100' : ''}`}
                >
                  {satMatches.map((match) => (
                    <MatchBlock key={match.id} match={match} />
                  ))}
                </div>

                {/* Sunday cell */}
                <div
                  className={`flex flex-col gap-1 p-1 ${
                    hasContent ? 'min-h-[80px]' : 'min-h-[40px]'
                  } ${hour < 22 ? 'border-b border-gray-100' : ''}`}
                >
                  {sunMatches.map((match) => (
                    <MatchBlock key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MatchBlock({ match }: { match: EnrichedMatch }) {
  const status = getCoverageStatus(match)
  const refsAssigned = match.designations.filter((d) => d.role === 'arbitro').length
  const scorersAssigned = match.designations.filter((d) => d.role === 'anotador').length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`w-full rounded-lg border p-2 text-left transition-colors ${STATUS_COLORS[status]}`}
        >
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-900">
                {match.homeTeam} vs {match.awayTeam}
              </p>
              <p className="truncate text-[10px] text-gray-600">
                {match.time} — {match.venue?.name ?? ''}
              </p>
            </div>
            <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[status]}`} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
            <span>
              Arb: {refsAssigned}/{match.refereesNeeded}
            </span>
            <span>
              Anot: {scorersAssigned}/{match.scorersNeeded}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" side="right" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {match.homeTeam} vs {match.awayTeam}
            </p>
            <p className="text-xs text-gray-500">
              {match.date} · {match.time}
            </p>
            <p className="text-xs text-gray-500">{match.venue?.name}</p>
            <p className="text-xs text-gray-400">{match.competition?.name}</p>
          </div>

          {/* Referees */}
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-700">
              Arbitros ({refsAssigned}/{match.refereesNeeded})
            </p>
            {match.designations
              .filter((d) => d.role === 'arbitro')
              .map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-800">{d.person?.name ?? d.personId}</span>
                  <span className="text-gray-400">{parseFloat(d.travelCost).toFixed(2)} €</span>
                </div>
              ))}
            {refsAssigned < match.refereesNeeded && (
              <p className="text-xs italic text-red-500">
                {match.refereesNeeded - refsAssigned} vacante
                {match.refereesNeeded - refsAssigned !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Scorers */}
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-700">
              Anotadores ({scorersAssigned}/{match.scorersNeeded})
            </p>
            {match.designations
              .filter((d) => d.role === 'anotador')
              .map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-800">{d.person?.name ?? d.personId}</span>
                  <span className="text-gray-400">{parseFloat(d.travelCost).toFixed(2)} €</span>
                </div>
              ))}
            {scorersAssigned < match.scorersNeeded && (
              <p className="text-xs italic text-red-500">
                {match.scorersNeeded - scorersAssigned} vacante
                {match.scorersNeeded - scorersAssigned !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <Badge
            className={`text-[10px] ${
              status === 'covered'
                ? 'bg-green-100 text-green-700'
                : status === 'partial'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {status === 'covered' ? 'Cubierto' : status === 'partial' ? 'Parcial' : 'Sin cubrir'}
          </Badge>
        </div>
      </PopoverContent>
    </Popover>
  )
}
