'use client'

import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { CostBadge } from '@/components/cost-badge'
import { MapPin, Clock, Calendar, Users, Navigation } from 'lucide-react'
import { getDirectionsUrl, getDepartureInfo } from '@/lib/utils'

interface DesignationCardProps {
  designation: {
    id: string
    role: string
    travelCost: string
    distanceKm: string
    status: string
    match?: {
      id: string
      date: string
      time: string
      homeTeam: string
      awayTeam: string
    }
    venue?: {
      name: string
      address: string
    }
    competition?: {
      name: string
    }
  }
  personAddress?: string
  personHasCar?: boolean
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const urgencyStyles = {
  past: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
  soon: 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100',
  normal: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
} as const

export function DesignationCard({
  designation,
  personAddress,
  personHasCar,
}: DesignationCardProps) {
  const { match, venue, competition } = designation
  const hasCar = personHasCar ?? true

  const directionsUrl =
    personAddress && venue?.address ? getDirectionsUrl(personAddress, venue.address, hasCar) : null

  const departure =
    match?.date && match?.time
      ? getDepartureInfo(match.date, match.time, parseFloat(designation.distanceKm) || 0, hasCar)
      : null

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {/* Equipos */}
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-semibold">
                {match?.homeTeam ?? '—'} vs {match?.awayTeam ?? '—'}
              </span>
            </div>

            {/* Competición */}
            {competition && (
              <p className="text-muted-foreground pl-6 text-xs">{competition.name}</p>
            )}

            {/* Fecha y hora */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {match?.date ? formatDate(match.date) : '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {match?.time ?? '—'}
              </span>
            </div>

            {/* Pabellón + directions */}
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              <span>{venue?.name ?? '—'}</span>
            </div>

            {/* Departure info + directions link */}
            {directionsUrl && departure && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`ml-6 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${urgencyStyles[departure.urgency]}`}
              >
                <Navigation className="h-3 w-3" />
                {departure.urgency === 'past' ? (
                  <span>Sal ya! (~{departure.travelMin} min)</span>
                ) : (
                  <span>
                    Sal a las {departure.label} (~{departure.travelMin} min)
                  </span>
                )}
              </a>
            )}
          </div>

          {/* Columna derecha: estado, coste */}
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={designation.status} />
            <CostBadge cost={designation.travelCost} km={designation.distanceKm} />
            <span className="text-muted-foreground text-xs capitalize">
              {designation.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
