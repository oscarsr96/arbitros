'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { CostBadge } from '@/components/cost-badge'
import { MapPin, Clock, Calendar, Users } from 'lucide-react'
import { toast } from 'sonner'

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
  onStatusChange?: (id: string, newStatus: string) => void
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function DesignationCard({ designation, onStatusChange }: DesignationCardProps) {
  const [updating, setUpdating] = useState(false)
  const { match, venue, competition } = designation
  const canRespond = designation.status === 'pending' || designation.status === 'notified'

  const handleAction = async (newStatus: 'confirmed' | 'rejected') => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/designations/${designation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Error')
      toast.success(newStatus === 'confirmed' ? 'Designación confirmada' : 'Designación rechazada')
      onStatusChange?.(designation.id, newStatus)
    } catch {
      toast.error('Error al actualizar la designación')
    } finally {
      setUpdating(false)
    }
  }

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
            </div>
          </div>

          {/* Columna derecha: estado, coste, acciones */}
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={designation.status} />
            <CostBadge cost={designation.travelCost} km={designation.distanceKm} />
            <span className="text-muted-foreground text-xs capitalize">
              {designation.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
            </span>

            {canRespond && (
              <div className="mt-1 flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => handleAction('rejected')}
                  disabled={updating}
                >
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleAction('confirmed')}
                  disabled={updating}
                >
                  Confirmar
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
