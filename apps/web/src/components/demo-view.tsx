'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MatchCard } from '@/components/match-card'
import {
  Loader2,
  RotateCcw,
  Sparkles,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportDemoXlsx, exportDemoPdf } from '@/lib/export-demo'
import { Navigation } from 'lucide-react'
import { getDirectionsUrl, getDepartureInfo } from '@/lib/utils'
import type { EnrichedMatch, EnrichedDesignation, UnassignedSlot } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────

interface DemoStats {
  matches: number
  referees: number
  scorers: number
  persons: number
  availabilities: number
  personsWithAvailability: number
  designations: number
  incompatibilities: number
  matchesCovered: number
  matchesPartial: number
  matchesUncovered: number
  matchesDetail: EnrichedMatch[]
}

interface GenerateResult {
  generated: {
    matches: number
    referees: number
    scorers: number
    designations: number
    solverStatus: string
    solverCoverage: number
    solverCost: number
    solverTimeMs: number
    solverType?: string
    pythonFallback?: boolean
    matchesCovered: number
    unassignedSlots: UnassignedSlot[]
  }
  matchesDetail: EnrichedMatch[]
}

// ── Status helpers ────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-50',
  notified: 'border-blue-200 bg-blue-50',
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  notified: 'Notificado',
}

// ── Main component ────────────────────────────────────────────────────────

export function DemoView() {
  const [numMatches, setNumMatches] = useState(20)
  const [numReferees, setNumReferees] = useState(12)
  const [numScorers, setNumScorers] = useState(6)
  const [usePythonSolver, setUsePythonSolver] = useState(false)
  const [solverType, setSolverType] = useState<'cpsat' | 'greedy'>('cpsat')
  const [generating, setGenerating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [stats, setStats] = useState<DemoStats | null>(null)
  const [matchesDetail, setMatchesDetail] = useState<EnrichedMatch[]>([])
  const [lastResult, setLastResult] = useState<GenerateResult['generated'] | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filterCoverage, setFilterCoverage] = useState<'all' | 'covered' | 'partial' | 'uncovered'>(
    'all',
  )
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterMunicipality, setFilterMunicipality] = useState<string>('all')
  const [filterClub, setFilterClub] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const fetchStats = useCallback(() => {
    fetch('/api/admin/demo')
      .then((r) => r.json())
      .then((data: DemoStats) => {
        setStats(data)
        setMatchesDetail(data.matchesDetail ?? [])
      })
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          numMatches,
          numReferees,
          numScorers,
          usePythonSolver,
          solverType,
        }),
      })
      const data: GenerateResult = await res.json()
      setLastResult(data.generated)
      setMatchesDetail(data.matchesDetail)
      setExpandedIds(new Set())
      toast.success(
        `${data.generated.designations} designaciones — ${data.generated.matchesCovered}/${data.generated.matches} partidos cubiertos`,
      )
      fetchStats()
    } catch {
      toast.error('Error al generar datos de demo')
    } finally {
      setGenerating(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await fetch('/api/admin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      setLastResult(null)
      setExpandedIds(new Set())
      setMatchesDetail([])
      toast.success('Datos restaurados al estado original')
      fetchStats()
    } catch {
      toast.error('Error al restaurar datos')
    } finally {
      setResetting(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasActiveFilters =
    filterCategory !== 'all' ||
    filterMunicipality !== 'all' ||
    filterClub !== 'all' ||
    filterDate !== 'all' ||
    filterCoverage !== 'all'

  const clearFilters = () => {
    setFilterCategory('all')
    setFilterMunicipality('all')
    setFilterClub('all')
    setFilterDate('all')
    setFilterCoverage('all')
    setCurrentPage(1)
  }

  const expandAll = () => setExpandedIds(new Set(paginatedMatches.map((m) => m.id)))
  const collapseAll = () => setExpandedIds(new Set())

  const categories = Array.from(
    new Set(matchesDetail.map((m) => m.competition?.category).filter(Boolean)),
  ) as string[]

  const municipalities = Array.from(
    new Set(matchesDetail.map((m) => m.venue?.municipalityName).filter(Boolean)),
  ).sort() as string[]

  const clubs = Array.from(new Set(matchesDetail.flatMap((m) => [m.homeTeam, m.awayTeam]))).sort()

  const dates = Array.from(new Set(matchesDetail.map((m) => m.date))).sort()

  const filteredMatches = matchesDetail.filter((m) => {
    if (filterCategory !== 'all' && m.competition?.category !== filterCategory) return false
    if (filterMunicipality !== 'all' && m.venue?.municipalityName !== filterMunicipality)
      return false
    if (filterClub !== 'all' && m.homeTeam !== filterClub && m.awayTeam !== filterClub) return false
    if (filterDate !== 'all' && m.date !== filterDate) return false
    if (filterCoverage === 'all') return true
    if (filterCoverage === 'covered') return m.isCovered
    if (filterCoverage === 'uncovered') return m.refereesAssigned === 0 && m.scorersAssigned === 0
    return !m.isCovered && (m.refereesAssigned > 0 || m.scorersAssigned > 0)
  })

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedMatches = filteredMatches.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  )

  const coveragePercent =
    stats && stats.matches > 0 ? Math.round((stats.matchesCovered / stats.matches) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Simulación de Demo</h2>
        <p className="text-sm text-white/50">
          Genera partidos, personal y designaciones automáticas
        </p>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
          Configuración
        </h3>
        <div className="grid gap-6 sm:grid-cols-3">
          <SliderControl
            label="Partidos"
            min={5}
            max={200}
            value={numMatches}
            onChange={setNumMatches}
          />
          <SliderControl
            label="Árbitros"
            min={3}
            max={200}
            value={numReferees}
            onChange={setNumReferees}
          />
          <SliderControl
            label="Anotadores"
            min={2}
            max={200}
            value={numScorers}
            onChange={setNumScorers}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={usePythonSolver}
              onChange={(e) => setUsePythonSolver(e.target.checked)}
              className="accent-fbm-orange h-4 w-4 rounded"
            />
            <span className="text-sm text-white/70">Usar solver Python (OR-Tools)</span>
          </label>
          {usePythonSolver && (
            <div className="flex items-center gap-2">
              {(['cpsat', 'greedy'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSolverType(t)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    solverType === t
                      ? 'bg-fbm-orange text-white'
                      : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80'
                  }`}
                >
                  {t === 'cpsat' ? 'CP-SAT (Óptimo)' : 'Greedy'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            onClick={handleGenerate}
            disabled={generating || resetting}
            className="bg-fbm-orange hover:bg-fbm-orange/90 text-white"
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? 'Generando...' : 'Generar demo'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={generating || resetting}
            className="border border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {resetting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Reset datos originales
          </Button>
        </div>
      </div>

      {/* Solver result banner */}
      {lastResult && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold text-green-300">Solver ejecutado</span>
            {lastResult.pythonFallback && (
              <Badge
                variant="outline"
                className="border-yellow-500/30 bg-yellow-500/20 text-yellow-300"
              >
                Fallback a TS (Python no disponible)
              </Badge>
            )}
            <Badge
              variant="outline"
              className="ml-auto border-green-500/30 bg-green-500/20 text-green-300"
            >
              {lastResult.solverType === 'cpsat'
                ? 'CP-SAT'
                : lastResult.solverType === 'greedy'
                  ? 'Greedy Python'
                  : 'Greedy TS'}{' '}
              · {lastResult.solverStatus} · {lastResult.solverTimeMs}ms
            </Badge>
          </div>
          <div className="grid gap-2 text-sm text-green-200/80 sm:grid-cols-4">
            <div>
              <span className="font-medium text-green-200">{lastResult.designations}</span>{' '}
              designaciones
            </div>
            <div>
              <span className="font-medium text-green-200">
                {lastResult.matchesCovered}/{lastResult.matches}
              </span>{' '}
              partidos cubiertos
            </div>
            <div>
              <span className="font-medium text-green-200">{lastResult.solverCoverage}%</span>{' '}
              cobertura slots
            </div>
            <div>
              <span className="font-medium text-green-200">
                {lastResult.solverCost.toFixed(2)} €
              </span>{' '}
              coste total
            </div>
          </div>
          {lastResult.unassignedSlots.length > 0 && (
            <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <p className="mb-1 text-xs font-semibold text-yellow-300">
                {lastResult.unassignedSlots.length} slot(s) sin cubrir:
              </p>
              <div className="flex flex-wrap gap-1">
                {lastResult.unassignedSlots.slice(0, 10).map((s, i) => (
                  <span
                    key={i}
                    className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-200"
                  >
                    {s.matchLabel} ({s.role === 'arbitro' ? 'Árb' : 'Anot'}): {s.reason}
                  </span>
                ))}
                {lastResult.unassignedSlots.length > 10 && (
                  <span className="text-xs text-yellow-300/70">
                    +{lastResult.unassignedSlots.length - 10} más
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats + coverage */}
      {stats && stats.matches > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Partidos" value={stats.matches} icon="🏀" />
          <StatCard label="Árbitros" value={stats.referees} icon="🦺" />
          <StatCard label="Anotadores" value={stats.scorers} icon="📝" />
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <span className="text-sm font-medium text-white/50">Cobertura</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-white">{coveragePercent}%</p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
            <div className="mt-1.5 flex gap-3 text-[10px] text-white/40">
              <span>{stats.matchesCovered} cubiertos</span>
              <span>{stats.matchesPartial} parcial</span>
              <span>{stats.matchesUncovered} sin cubrir</span>
            </div>
          </div>
        </div>
      )}

      {/* Match detail list */}
      {matchesDetail.length > 0 && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="space-y-3">
            {/* Row 1: title + actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">
                Partidos ({filteredMatches.length}
                {filteredMatches.length !== matchesDetail.length
                  ? ` de ${matchesDetail.length}`
                  : ''}
                )
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportDemoXlsx(matchesDetail)}
                  className="text-xs text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Excel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportDemoPdf(matchesDetail)}
                  className="text-xs text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <FileText className="mr-1 h-3.5 w-3.5" /> PDF
                </Button>
                <span className="mx-1 h-4 w-px bg-white/10" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={expandAll}
                  className="text-xs text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <ChevronDown className="mr-1 h-3 w-3" /> Expandir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={collapseAll}
                  className="text-xs text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <ChevronUp className="mr-1 h-3 w-3" /> Colapsar
                </Button>
              </div>
            </div>

            {/* Row 2: filters */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Filtros
              </span>
              {categories.length > 1 && (
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/70 outline-none focus:border-white/30"
                >
                  <option value="all" className="bg-gray-900">
                    Categoría
                  </option>
                  {categories.sort().map((cat) => (
                    <option key={cat} value={cat} className="bg-gray-900">
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              )}
              {municipalities.length > 1 && (
                <select
                  value={filterMunicipality}
                  onChange={(e) => {
                    setFilterMunicipality(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/70 outline-none focus:border-white/30"
                >
                  <option value="all" className="bg-gray-900">
                    Municipio
                  </option>
                  {municipalities.map((muni) => (
                    <option key={muni} value={muni} className="bg-gray-900">
                      {muni}
                    </option>
                  ))}
                </select>
              )}
              {clubs.length > 1 && (
                <select
                  value={filterClub}
                  onChange={(e) => {
                    setFilterClub(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/70 outline-none focus:border-white/30"
                >
                  <option value="all" className="bg-gray-900">
                    Club
                  </option>
                  {clubs.map((club) => (
                    <option key={club} value={club} className="bg-gray-900">
                      {club}
                    </option>
                  ))}
                </select>
              )}
              {dates.length > 1 && (
                <select
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/70 outline-none focus:border-white/30"
                >
                  <option value="all" className="bg-gray-900">
                    Fecha
                  </option>
                  {dates.map((d) => (
                    <option key={d} value={d} className="bg-gray-900">
                      {new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </option>
                  ))}
                </select>
              )}
              <span className="mx-0.5 h-4 w-px bg-white/10" />
              <div className="flex rounded-md border border-white/10 bg-white/5">
                {(['all', 'covered', 'partial', 'uncovered'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFilterCoverage(f)
                      setCurrentPage(1)
                    }}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      filterCoverage === f
                        ? 'bg-fbm-orange text-white'
                        : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                    } ${f === 'all' ? 'rounded-l-md' : ''} ${f === 'uncovered' ? 'rounded-r-md' : ''}`}
                  >
                    {f === 'all'
                      ? 'Todos'
                      : f === 'covered'
                        ? 'Cubiertos'
                        : f === 'partial'
                          ? 'Parcial'
                          : 'Sin cubrir'}
                  </button>
                ))}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto rounded-md px-2 py-1 text-[10px] font-medium text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Match cards */}
          <div className="min-h-[600px] space-y-2">
            {paginatedMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                expanded={expandedIds.has(match.id)}
                onToggle={() => toggleExpand(match.id)}
              >
                <DesignationDetail match={match} />
              </MatchCard>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="text-xs text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                ← Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                  .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('dots')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, i) =>
                    item === 'dots' ? (
                      <span key={`dots-${i}`} className="px-1 text-xs text-white/30">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item)}
                        className={`min-w-[28px] rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          item === safeCurrentPage
                            ? 'bg-fbm-orange text-white'
                            : 'text-white/50 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="text-xs text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                Siguiente →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Designation detail inside expanded match ──────────────────────────────

function DesignationDetail({ match }: { match: EnrichedMatch }) {
  const refDesigs = match.designations.filter((d) => d.role === 'arbitro')
  const scorDesigs = match.designations.filter((d) => d.role === 'anotador')

  const totalCost = match.designations.reduce((sum, d) => sum + parseFloat(d.travelCost), 0)

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Árbitros ({refDesigs.length}/{match.refereesNeeded})
        </p>
        <div className="space-y-1.5">
          {refDesigs.map((d) => (
            <DesignationRow
              key={d.id}
              designation={d}
              venueAddress={match.venue?.address}
              matchDate={match.date}
              matchTime={match.time}
            />
          ))}
          {refDesigs.length < match.refereesNeeded &&
            Array.from({ length: match.refereesNeeded - refDesigs.length }).map((_, i) => (
              <div
                key={`empty-ref-${i}`}
                className="rounded-lg border-2 border-dashed border-red-200 bg-red-50/50 p-2.5 text-center text-xs text-red-400"
              >
                Sin asignar
              </div>
            ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Anotadores ({scorDesigs.length}/{match.scorersNeeded})
        </p>
        <div className="space-y-1.5">
          {scorDesigs.map((d) => (
            <DesignationRow
              key={d.id}
              designation={d}
              venueAddress={match.venue?.address}
              matchDate={match.date}
              matchTime={match.time}
            />
          ))}
          {scorDesigs.length < match.scorersNeeded &&
            Array.from({ length: match.scorersNeeded - scorDesigs.length }).map((_, i) => (
              <div
                key={`empty-sco-${i}`}
                className="rounded-lg border-2 border-dashed border-red-200 bg-red-50/50 p-2.5 text-center text-xs text-red-400"
              >
                Sin asignar
              </div>
            ))}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 text-xs">
        <span className="text-gray-500">Coste desplazamiento total</span>
        <span className="font-semibold">{totalCost.toFixed(2)} €</span>
      </div>
    </div>
  )
}

// ── Single designation row ────────────────────────────────────────────────

function DesignationRow({
  designation,
  venueAddress,
  matchDate,
  matchTime,
}: {
  designation: EnrichedDesignation
  venueAddress?: string
  matchDate?: string
  matchTime?: string
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-2.5 ${statusColors[designation.status] ?? 'border-gray-200 bg-white'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {designation.person?.name ?? '—'}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {statusLabels[designation.status] ?? designation.status}
          </Badge>
          {designation.person?.category && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
              {designation.person.category}
            </span>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              designation.person?.hasCar ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}
          >
            {designation.person?.hasCar ? '🚗 Coche' : '🚶 Sin coche'}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
          {designation.municipality && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {designation.municipality.name}
            </span>
          )}
          <span>{designation.travelCost} €</span>
          <span>{designation.distanceKm} km</span>
          {designation.person?.address &&
            venueAddress &&
            matchDate &&
            matchTime &&
            (() => {
              const dep = getDepartureInfo(
                matchDate,
                matchTime,
                parseFloat(designation.distanceKm) || 0,
                designation.person!.hasCar,
              )
              return (
                <>
                  <a
                    href={getDirectionsUrl(
                      designation.person!.address,
                      venueAddress,
                      designation.person!.hasCar,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <Navigation className="h-2.5 w-2.5" />
                    Cómo llegar
                  </a>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                      dep.urgency === 'past'
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : dep.urgency === 'soon'
                          ? 'border-orange-300 bg-orange-50 text-orange-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {dep.urgency === 'past'
                      ? `Sal ya! (~${dep.travelMin}min)`
                      : `Sal ${dep.label} (~${dep.travelMin}min)`}
                  </span>
                </>
              )
            })()}
        </div>
      </div>
    </div>
  )
}

// ── Slider ────────────────────────────────────────────────────────────────

function SliderControl({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-white/70">{label}</label>
        <span className="bg-fbm-orange/20 text-fbm-orange rounded-md px-2 py-0.5 text-sm font-bold">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-fbm-orange w-full"
      />
      <div className="mt-1 flex justify-between text-xs text-white/30">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-white/50">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-white">{value.toLocaleString('es-ES')}</p>
    </div>
  )
}
