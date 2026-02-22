'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapPin, AlertTriangle, Search } from 'lucide-react'
import type { AssignmentValidation } from '@/lib/types'

interface PickerPerson {
  id: string
  name: string
  role: 'arbitro' | 'anotador'
  category: string | null
  municipalityId: string
  municipalityName: string
  travelCost: number
  travelKm: number
  matchesAssigned: number
  validation: AssignmentValidation
}

interface PersonPickerProps {
  persons: PickerPerson[]
  activeSlot: { matchId: string; role: 'arbitro' | 'anotador' } | null
  onAssign: (personId: string) => void
  sortBy?: 'cost' | 'load'
  onSortChange?: (sort: 'cost' | 'load') => void
}

const categoryLabels: Record<string, string> = {
  provincial: 'Provincial',
  autonomico: 'Autonómico',
  nacional: 'Nacional',
  feb: 'FEB',
}

export function PersonPicker({
  persons,
  activeSlot,
  onAssign,
  sortBy = 'cost',
  onSortChange,
}: PersonPickerProps) {
  const [search, setSearch] = useState('')

  if (!activeSlot) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-8">
        <p className="text-center text-sm text-gray-400">
          Selecciona un slot de asignación en un partido para ver las personas disponibles.
        </p>
      </div>
    )
  }

  const filtered = persons.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  const sorted = [...filtered].sort((a, b) => {
    // Invalid persons go to bottom
    if (!a.validation.valid && b.validation.valid) return 1
    if (a.validation.valid && !b.validation.valid) return -1
    if (sortBy === 'cost') return a.travelCost - b.travelCost
    return a.matchesAssigned - b.matchesAssigned
  })

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-800">
          Personal disponible
          <span className="ml-1 text-xs font-normal text-gray-400">
            ({filtered.length} persona{filtered.length !== 1 ? 's' : ''})
          </span>
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {activeSlot.role === 'arbitro' ? 'Árbitros' : 'Anotadores'} disponibles para este partido
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="mt-2 flex gap-1">
          <Button
            variant={sortBy === 'cost' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => onSortChange?.('cost')}
          >
            Por coste
          </Button>
          <Button
            variant={sortBy === 'load' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => onSortChange?.('load')}
          >
            Por carga
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-1 p-2">
          {sorted.map((person) => (
            <div
              key={person.id}
              className={`flex items-center gap-3 rounded-lg p-3 ${
                person.validation.valid ? 'hover:bg-gray-50' : 'opacity-50'
              }`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                  person.role === 'arbitro' ? 'bg-fbm-navy' : 'bg-purple-600'
                }`}
              >
                {person.name
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{person.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  {person.category && (
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[person.category] ?? person.category}
                    </Badge>
                  )}
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {person.municipalityName}
                  </span>
                  <span>{person.travelCost.toFixed(2)} €</span>
                  <span>·</span>
                  <span>
                    {person.matchesAssigned} partido{person.matchesAssigned !== 1 ? 's' : ''}
                  </span>
                </div>
                {!person.validation.valid && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-red-500">
                    <AlertTriangle className="h-3 w-3" />
                    {person.validation.reason}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!person.validation.valid}
                onClick={() => onAssign(person.id)}
              >
                Asignar
              </Button>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              No hay personas disponibles para este slot.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
