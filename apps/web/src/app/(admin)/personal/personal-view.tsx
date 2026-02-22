'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { PersonCard } from '@/components/person-card'
import { PersonDetailSheet } from './person-detail-sheet'
import { useAdminStore } from '@/stores/admin-store'
import { Search } from 'lucide-react'
import type { EnrichedPerson } from '@/lib/types'

const tabs = [
  { key: '', label: 'Todos' },
  { key: 'arbitro', label: 'Árbitros' },
  { key: 'anotador', label: 'Anotadores' },
]

export function PersonalView() {
  const [persons, setPersons] = useState<EnrichedPerson[]>([])
  const [loading, setLoading] = useState(true)
  const { personalFilters, setPersonalFilter, selectedPersonId, setSelectedPersonId } =
    useAdminStore()

  useEffect(() => {
    fetch('/api/admin/persons')
      .then((r) => r.json())
      .then((data) => setPersons(data.persons))
      .finally(() => setLoading(false))
  }, [])

  const filtered = persons.filter((p) => {
    if (personalFilters.role && p.role !== personalFilters.role) return false
    if (personalFilters.category && p.category !== personalFilters.category) return false
    if (personalFilters.municipality && p.municipalityId !== personalFilters.municipality)
      return false
    if (
      personalFilters.search &&
      !p.name.toLowerCase().includes(personalFilters.search.toLowerCase())
    )
      return false
    return true
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal</h1>
          <p className="mt-1 text-sm text-gray-500">
            {persons.length} persona{persons.length !== 1 ? 's' : ''} registrada
            {persons.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPersonalFilter('role', tab.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              personalFilters.role === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400">
              {tab.key === '' ? persons.length : persons.filter((p) => p.role === tab.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre..."
            value={personalFilters.search}
            onChange={(e) => setPersonalFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border bg-gray-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          No se encontraron personas con los filtros actuales.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              municipalityName={person.municipality?.name}
              matchesAssigned={person.matchesAssigned}
              totalCost={person.totalCost}
              onClick={() => setSelectedPersonId(person.id)}
            />
          ))}
        </div>
      )}

      <PersonDetailSheet personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} />
    </div>
  )
}
