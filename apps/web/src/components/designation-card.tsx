'use client'

import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { CostBadge } from '@/components/cost-badge'
import { MapPin, Clock, Calendar, Users, Navigation } from 'lucide-react'
import { getDirectionsUrl } from '@/lib/utils'

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

export function DesignationCard({
  designation,
  personAddress,
  personHasCar,
}: DesignationCardProps) {
  const { match, venue, competition } = designation

  const directionsUrl =
    personAddress && venue?.address
      ? getDirectionsUrl(personAddress, venue.address, personHasCar ?? true)
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

            {/* Pabellón */}
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              <span>{venue?.name ?? '—'}</span>
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-2 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Navigation className="h-3 w-3" />
                  Cómo llegar
                </a>
              )}
            </div>
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
