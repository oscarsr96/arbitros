'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { FilterBar } from '@/components/filter-bar'
import { MatchStatusBadge } from '@/components/match-status-badge'
import { CoverageIndicator } from '@/components/coverage-indicator'
import { CSVImportDialog } from '@/components/csv-import-dialog'
import { XlsxImportDialog } from '@/components/xlsx-import-dialog'
import { FbmCsvImportDialog } from '@/components/fbm-csv-import-dialog'
import { MatchDetailRow } from './match-detail-row'
import { useAdminStore } from '@/stores/admin-store'
import { Upload, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import type { EnrichedMatch, CSVMatchRow, ParsedXlsxMatch } from '@/lib/types'
import { getJornadaSaturdayForDate } from '@/lib/matchday-availability'
import type { JornadaSummary } from '@/lib/match-query'

/** Respuesta de `?shape=list`: partidos sin designaciones + catálogos deduplicados. */
interface ListMatchesResponse {
  matches: (Omit<EnrichedMatch, 'venue' | 'competition' | 'designations'> & {
    venueId: string
    competitionId: string
  })[]
  venues?: Record<string, EnrichedMatch['venue']>
  competitions?: Record<string, EnrichedMatch['competition']>
}

/** "sáb 27 sep 2025" a partir del sábado que identifica la jornada. */
function formatJornadaLabel(j: JornadaSummary): string {
  return new Date(j.saturday + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function PartidosView() {
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [csvOpen, setCsvOpen] = useState(false)
  const [xlsxOpen, setXlsxOpen] = useState(false)
  const [fbmOpen, setFbmOpen] = useState(false)
  // Catálogo de municipios por fetch: vive en mock-data, que importa el seed de
  // partidos (~10 MB) y por tanto no puede entrar en el bundle de cliente.
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([])
  // Índice de jornadas (~29 entradas) y jornada seleccionada. La vista carga UNA
  // jornada, igual que Asignación: el calendario completo son ~24.500 partidos
  // (~21 MB) y esta tabla nunca los mostró todos a la vez (el subtítulo ya decía
  // "en la jornada").
  const [jornadas, setJornadas] = useState<JornadaSummary[]>([])
  const [jornada, setJornada] = useState('')
  // Designaciones cargadas al desplegar cada fila: la lista no las trae (ver
  // `?shape=list` en la ruta) porque una jornada designada serían 4,34 MB.
  const [designationsByMatch, setDesignationsByMatch] = useState<
    Record<string, EnrichedMatch['designations']>
  >({})
  const { matchFilters, setMatchFilter, resetMatchFilters, expandedMatchIds, toggleExpandedMatch } =
    useAdminStore()

  // Jornada por defecto: la del primer partido del calendario, MISMO criterio que
  // Asignación (`getMatchdayWindow(getJornadaSaturdayForDate(minDate))`), para que
  // ambas vistas abran en la misma jornada.
  useEffect(() => {
    fetch('/api/admin/matches?meta=1')
      .then((r) => r.json())
      .then((data) => {
        const list: JornadaSummary[] = data.jornadas ?? []
        setJornadas(list)
        if (data.range?.minDate) {
          setJornada(getJornadaSaturdayForDate(data.range.minDate))
        } else if (list.length > 0) {
          setJornada(list[0].saturday)
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  const fetchMatches = useCallback(() => {
    if (!jornada) return
    setLoading(true)
    fetch(`/api/admin/matches?jornada=${jornada}&shape=list`)
      .then((r) => r.json())
      .then((data: ListMatchesResponse) => {
        // Rehidratar venue/competition desde los diccionarios: viajan
        // deduplicados (~35 KB en vez de 409 B por partido) pero el render
        // espera la forma completa de EnrichedMatch.
        setMatches(
          (data.matches ?? []).map((m) => ({
            ...m,
            venue: data.venues?.[m.venueId],
            competition: data.competitions?.[m.competitionId],
            designations: [],
          })),
        )
        // Las designaciones cacheadas son de la jornada anterior: se descartan.
        setDesignationsByMatch({})
      })
      .finally(() => setLoading(false))
  }, [jornada])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((data) => setMunicipalities(data.municipalities ?? []))
      .catch(() => setMunicipalities([]))
  }, [])

  // Al desplegar una fila se cargan sus designaciones (una sola vez por partido).
  const handleToggleMatch = useCallback(
    (matchId: string) => {
      const wasExpanded = expandedMatchIds.has(matchId)
      toggleExpandedMatch(matchId)
      if (wasExpanded || designationsByMatch[matchId]) return
      fetch(`/api/admin/matches/${matchId}`)
        .then((r) => r.json())
        .then((data) => {
          setDesignationsByMatch((prev) => ({
            ...prev,
            [matchId]: data.match?.designations ?? [],
          }))
        })
        .catch(() => {
          setDesignationsByMatch((prev) => ({ ...prev, [matchId]: [] }))
        })
    },
    [expandedMatchIds, toggleExpandedMatch, designationsByMatch],
  )

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

  const handleImportXlsx = async (rows: ParsedXlsxMatch[]) => {
    const res = await fetch('/api/admin/matches/import-xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches: rows }),
    })
    const data = await res.json()
    if (data.imported > 0) {
      const extras = [
        data.venuesCreated > 0 ? `${data.venuesCreated} pabellón(es) nuevo(s)` : null,
        data.courtsCreated > 0 ? `${data.courtsCreated} pista(s) nueva(s)` : null,
      ].filter(Boolean)
      toast.success(
        `${data.imported} partido${data.imported !== 1 ? 's' : ''} importado${data.imported !== 1 ? 's' : ''}` +
          (extras.length > 0 ? ` (${extras.join(', ')})` : ''),
      )
      fetchMatches()
    }
    if (data.warnings?.length > 0) {
      toast.warning(`Advertencias: ${data.warnings.join('; ')}`)
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

  // Opciones de categoría derivadas SOLO de los partidos cargados: el catálogo
  // de competiciones vive en mock-data (que importa el seed de partidos) y su
  // copia cliente tampoco incluía nunca las competiciones importadas en runtime.
  const categoryOptions = (() => {
    const byValue = new Map<string, string>()
    for (const m of matches) {
      if (m.competition?.category) byValue.set(m.competition.category, m.competition.name)
    }
    return Array.from(byValue, ([value, label]) => ({ value, label }))
  })()

  const currentJornada = jornadas.find((j) => j.saturday === jornada)

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
      options: categoryOptions,
    },
    {
      key: 'municipality',
      label: 'Municipio',
      options: municipalities.map((m) => ({ value: m.id, label: m.name })),
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
        <div className="flex gap-2">
          <Button onClick={() => setCsvOpen(true)} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setXlsxOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar XLSX
          </Button>
          <Button onClick={() => setFbmOpen(true)} variant="outline" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Importar calendario FBM
          </Button>
        </div>
      </div>

      {/* Selector de jornada */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-xs font-medium text-gray-500" htmlFor="partidos-jornada">
          Jornada
        </label>
        <select
          id="partidos-jornada"
          value={jornada}
          onChange={(e) => setJornada(e.target.value)}
          disabled={jornadas.length === 0}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm"
        >
          {jornadas.map((j, i) => (
            <option key={j.saturday} value={j.saturday}>
              J{i + 1} · {formatJornadaLabel(j)} ({j.count})
            </option>
          ))}
        </select>
        {currentJornada && (
          <span className="text-xs text-gray-400">
            Viernes {currentJornada.from} a jueves {currentJornada.to}
          </span>
        )}
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
                    match={{ ...match, designations: designationsByMatch[match.id] ?? [] }}
                    expanded={expanded}
                    onToggle={() => handleToggleMatch(match.id)}
                    dateStr={dateStr}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <CSVImportDialog open={csvOpen} onOpenChange={setCsvOpen} onImport={handleImport} />
      <XlsxImportDialog open={xlsxOpen} onOpenChange={setXlsxOpen} onImport={handleImportXlsx} />
      <FbmCsvImportDialog open={fbmOpen} onOpenChange={setFbmOpen} onImported={fetchMatches} />
    </div>
  )
}
