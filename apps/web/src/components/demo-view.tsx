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
    matchesCovered: number
    unassignedSlots: UnassignedSlot[]
  }
  matchesDetail: EnrichedMatch[]
}

// ── Status helpers ────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-50',
  notified: 'border-blue-200 bg-blue-50',
  confirmed: 'border-green-200 bg-green-50',
  rejected: 'border-red-200 bg-red-50',
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  notified: 'Notificado',
  confirmed: 'Confirmado',
  rejected: 'Rechazado',
}

// ── Main component ────────────────────────────────────────────────────────

export function DemoView() {
  const [numMatches, setNumMatches] = useState(20)
  const [numReferees, setNumReferees] = useState(12)
  const [numScorers, setNumScorers] = useState(6)
  const [generating, setGenerating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [stats, setStats] = useState<DemoStats | null>(null)
  const [matchesDetail, setMatchesDetail] = useState<EnrichedMatch[]>([])
  const [lastResult, setLastResult] = useState<GenerateResult['generated'] | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filterCoverage, setFilterCoverage] = useState<'all' | 'covered' | 'partial' | 'uncovered'>(
    'all',
  )

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
        body: JSON.stringify({ action: 'generate', numMatches, numReferees, numScorers }),
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

  const expandAll = () => setExpandedIds(new Set(filteredMatches.map((m) => m.id)))
  const collapseAll = () => setExpandedIds(new Set())

  const filteredMatches = matchesDetail.filter((m) => {
    if (filterCoverage === 'all') return true
    if (filterCoverage === 'covered') return m.isCovered
    if (filterCoverage === 'uncovered') return m.refereesAssigned === 0 && m.scorersAssigned === 0
    return !m.isCovered && (m.refereesAssigned > 0 || m.scorersAssigned > 0)
  })

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
            max={50}
            value={numMatches}
            onChange={setNumMatches}
          />
          <SliderControl
            label="Árbitros"
            min={3}
            max={30}
            value={numReferees}
            onChange={setNumReferees}
          />
          <SliderControl
            label="Anotadores"
            min={2}
            max={15}
            value={numScorers}
            onChange={setNumScorers}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
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
            <Badge
              variant="outline"
              className="ml-auto border-green-500/30 bg-green-500/20 text-green-300"
            >
              {lastResult.solverStatus} · {lastResult.solverTimeMs}ms
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-white">
              Partidos ({filteredMatches.length}
              {filterCoverage !== 'all' ? ` de ${matchesDetail.length}` : ''})
            </h3>
            <div className="flex items-center gap-2">
              {/* Export buttons */}
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
              {/* Coverage filter */}
              <div className="flex rounded-lg border border-white/10 bg-white/5">
                {(['all', 'covered', 'partial', 'uncovered'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterCoverage(f)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      filterCoverage === f
                        ? 'bg-fbm-orange text-white'
                        : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                    } ${f === 'all' ? 'rounded-l-lg' : ''} ${f === 'uncovered' ? 'rounded-r-lg' : ''}`}
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

          {/* Match cards */}
          <div className="space-y-2">
            {filteredMatches.map((match) => (
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
        </div>
      )}
    </div>
  )
}

// ── Designation detail inside expanded match ──────────────────────────────

function DesignationDetail({ match }: { match: EnrichedMatch }) {
  const refDesigs = match.designations.filter(
    (d) => d.role === 'arbitro' && d.status !== 'rejected',
  )
  const scorDesigs = match.designations.filter(
    (d) => d.role === 'anotador' && d.status !== 'rejected',
  )

  const totalCost = match.designations
    .filter((d) => d.status !== 'rejected')
    .reduce((sum, d) => sum + parseFloat(d.travelCost), 0)

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Árbitros ({refDesigs.length}/{match.refereesNeeded})
        </p>
        <div className="space-y-1.5">
          {refDesigs.map((d) => (
            <DesignationRow key={d.id} designation={d} />
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
            <DesignationRow key={d.id} designation={d} />
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

function DesignationRow({ designation }: { designation: EnrichedDesignation }) {
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
