'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MapPin, Mail, Phone, Calendar, AlertTriangle } from 'lucide-react'

interface PersonDetail {
  person: {
    id: string
    name: string
    email: string
    phone: string
    role: string
    category: string | null
    address: string
    municipalityId: string
    municipality?: { id: string; name: string }
  }
  designations: {
    id: string
    matchId: string
    role: string
    travelCost: string
    distanceKm: string
    status: string
    match?: { date: string; time: string; homeTeam: string; awayTeam: string }
    venue?: { name: string }
  }[]
  availability: {
    dayOfWeek: number
    startTime: string
    endTime: string
  }[]
  incompatibilities: {
    teamName: string
    reason: string
  }[]
}

const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const categoryLabels: Record<string, string> = {
  provincial: 'Provincial',
  autonomico: 'Autonómico',
  nacional: 'Nacional',
  feb: 'FEB',
}
const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  notified: 'Notificado',
  confirmed: 'Confirmado',
  rejected: 'Rechazado',
}

interface PersonDetailSheetProps {
  personId: string | null
  onClose: () => void
}

export function PersonDetailSheet({ personId, onClose }: PersonDetailSheetProps) {
  const [data, setData] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!personId) {
      setData(null)
      return
    }
    setLoading(true)
    fetch(`/api/admin/persons/${personId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [personId])

  return (
    <Sheet
      open={!!personId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data?.person.name ?? 'Cargando...'}</SheetTitle>
        </SheetHeader>

        {loading || !data ? (
          <div className="space-y-4 pt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Info */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={
                    data.person.role === 'arbitro'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-purple-200 bg-purple-50 text-purple-700'
                  }
                >
                  {data.person.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
                </Badge>
                {data.person.category && (
                  <Badge variant="outline">
                    {categoryLabels[data.person.category] ?? data.person.category}
                  </Badge>
                )}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {data.person.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {data.person.phone}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> {data.person.municipality?.name ?? ''} —{' '}
                  {data.person.address}
                </p>
              </div>
            </div>

            <Separator />

            {/* Incompatibilities */}
            {data.incompatibilities.length > 0 && (
              <>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                    Incompatibilidades
                  </h3>
                  <div className="space-y-1">
                    {data.incompatibilities.map((inc, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-700"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="font-medium">{inc.teamName}</span> — {inc.reason}
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Availability mini grid */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Disponibilidad esta semana
              </h3>
              {data.availability.length === 0 ? (
                <p className="text-xs text-gray-400">Sin disponibilidad registrada</p>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {dayNames.map((day, i) => {
                    const slots = data.availability.filter((a) => a.dayOfWeek === i)
                    return (
                      <div key={day} className="text-center">
                        <span className="text-xs font-medium text-gray-500">{day}</span>
                        <div className="mt-1 space-y-0.5">
                          {slots.length === 0 ? (
                            <div className="h-1.5 rounded-full bg-gray-100" />
                          ) : (
                            slots.map((s, j) => (
                              <div
                                key={j}
                                className="h-1.5 rounded-full bg-green-400"
                                title={`${s.startTime}-${s.endTime}`}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Designations */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Partidos asignados ({data.designations.length})
              </h3>
              {data.designations.length === 0 ? (
                <p className="text-xs text-gray-400">Sin partidos asignados</p>
              ) : (
                <div className="space-y-2">
                  {data.designations.map((d) => (
                    <div key={d.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {d.match?.homeTeam} vs {d.match?.awayTeam}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            d.status === 'confirmed'
                              ? 'border-green-200 text-green-700'
                              : d.status === 'rejected'
                                ? 'border-red-200 text-red-700'
                                : 'border-gray-200 text-gray-600'
                          }`}
                        >
                          {statusLabels[d.status] ?? d.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {d.match?.date} · {d.match?.time}
                        {d.venue && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {d.venue.name}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {d.travelCost} € · {d.distanceKm} km
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats summary */}
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{data.designations.length}</p>
                  <p className="text-xs text-gray-500">Partidos</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">
                    {data.designations.filter((d) => d.status === 'confirmed').length}
                  </p>
                  <p className="text-xs text-gray-500">Confirmados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {data.designations
                      .reduce((sum, d) => sum + parseFloat(d.travelCost), 0)
                      .toFixed(2)}{' '}
                    €
                  </p>
                  <p className="text-xs text-gray-500">Total coste</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
