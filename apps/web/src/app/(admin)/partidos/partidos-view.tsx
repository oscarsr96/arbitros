'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { FilterBar } from '@/components/filter-bar'
import { MatchStatusBadge } from '@/components/match-status-badge'
import { CoverageIndicator } from '@/components/coverage-indicator'
import { CSVImportDialog } from '@/components/csv-import-dialog'
import { MatchDetailRow } from './match-detail-row'
import { useAdminStore } from '@/stores/admin-store'
import { Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import type { EnrichedMatch, CSVMatchRow } from '@/lib/types'
import { mockMunicipalities, mockCompetitions } from '@/lib/mock-data'

export function PartidosView() {
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [csvOpen, setCsvOpen] = useState(false)
  const { matchFilters, setMatchFilter, resetMatchFilters, expandedMatchIds, toggleExpandedMatch } =
    useAdminStore()

  const fetchMatches = useCallback(() => {
    fetch('/api/admin/matches')
      .then((r) => r.json())
      .then((data) => setMatches(data.matches))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleImport = async (rows: CSVMatchRow[]) => {
    const res = await fetch('/api/admin/matches/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    const data = await res.json()
    if (data.imported > 0) {
      toast.success(
        `${data.imported} partido${data.imported !== 1 ? 's' : ''} importado${data.imported !== 1 ? 's' : ''}`,
      )
      fetchMatches()
    }
    if (data.errors?.length > 0) {
      toast.warning(`Advertencias: ${data.errors.join('; ')}`)
    }
  }

  // Apply filters
  const filtered = matches.filter((m) => {
    if (matchFilters.day) {
      const d = new Date(m.date + 'T00:00:00')
      const dayName = d.getDay() === 6 ? 'saturday' : d.getDay() === 0 ? 'sunday' : 'other'
      if (matchFilters.day !== dayName) return false
    }
    if (matchFilters.category && m.competition?.category !== matchFilters.category) return false
    if (matchFilters.municipality && m.venue?.municipalityId !== matchFilters.municipality)
      return false
    if (matchFilters.coverage) {
      if (matchFilters.coverage === 'covered' && !m.isCovered) return false
      if (
        matchFilters.coverage === 'uncovered' &&
        (m.refereesAssigned > 0 || m.scorersAssigned > 0)
      )
        return false
      if (
        matchFilters.coverage === 'partial' &&
        (m.isCovered || (m.refereesAssigned === 0 && m.scorersAssigned === 0))
      )
        return false
    }
    return true
  })

  // Sort by date then time
  const sorted = [...filtered].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date)
    if (dateComp !== 0) return dateComp
    return a.time.localeCompare(b.time)
  })

  const filterDefs = [
    {
      key: 'day',
      label: 'Día',
      options: [
        { value: 'saturday', label: 'Sábado' },
        { value: 'sunday', label: 'Domingo' },
      ],
    },
    {
      key: 'category',
      label: 'Categoría',
      options: mockCompetitions.map((c) => ({ value: c.category, label: c.name })),
    },
    {
      key: 'municipality',
      label: 'Municipio',
      options: mockMunicipalities.map((m) => ({ value: m.id, label: m.name })),
    },
    {
      key: 'coverage',
      label: 'Cobertura',
      options: [
        { value: 'covered', label: 'Cubiertos' },
        { value: 'partial', label: 'Parcial' },
        { value: 'uncovered', label: 'Sin cubrir' },
      ],
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sorted.length} partido{sorted.length !== 1 ? 's' : ''} en la jornada
          </p>
        </div>
        <Button onClick={() => setCsvOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <FilterBar
          filters={filterDefs}
          values={matchFilters}
          onChange={setMatchFilter}
          onReset={resetMatchFilters}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="w-8 px-4 py-3" />
              <th className="px-4 py-3 font-medium text-gray-600">Fecha / Hora</th>
              <th className="px-4 py-3 font-medium text-gray-600">Partido</th>
              <th className="hidden px-4 py-3 font-medium text-gray-600 md:table-cell">Pabellón</th>
              <th className="hidden px-4 py-3 font-medium text-gray-600 lg:table-cell">
                Categoría
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Cobertura</th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  Cargando partidos...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  No hay partidos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              sorted.map((match) => {
                const expanded = expandedMatchIds.has(match.id)
                const dateStr = new Date(match.date + 'T00:00:00').toLocaleDateString('es-ES', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })

                return (
                  <MatchDetailRow
                    key={match.id}
                    match={match}
                    expanded={expanded}
                    onToggle={() => toggleExpandedMatch(match.id)}
                    dateStr={dateStr}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <CSVImportDialog open={csvOpen} onOpenChange={setCsvOpen} onImport={handleImport} />
    </div>
  )
}
