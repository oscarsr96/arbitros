'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  exportLiquidationXlsx,
  exportMonthlyLiquidationXlsx,
  type MonthlyLiquidation,
} from '@/lib/export-xlsx'
import {
  exportLiquidationPdf,
  exportPersonDetailPdf,
  exportMonthlyJustificantePdf,
} from '@/lib/export-pdf'
import { formatLocalDate, seasonLabel } from '@/lib/mock-data-client'
import { getJornadaSaturdayForDate } from '@/lib/matchday-availability'

type ReportScope = 'jornada' | 'month' | 'season'

interface ReportData {
  summary: {
    scope: ReportScope
    scopeLabel: string
    from: string
    to: string
    totalCost: number
    totalMatches: number
    covered: number
    partial: number
    uncovered: number
    matchday: number | null
  }
  loadByPerson: {
    personId: string
    name: string
    role: string
    matchesAssigned: number
    totalCost: number
    fees: number
    total: number
    unresolvedFees: number
  }[]
  liquidation: {
    personId: string
    name: string
    role: string
    municipality: string
    bankIban: string
    matches: {
      matchId: string
      date: string
      time: string
      homeTeam: string
      awayTeam: string
      venue: string
      travelCost: number
      distanceKm: number
    }[]
    // Desglose real por día (regla FBM, `calculatePersonTravelCost`): fuente
    // de verdad del desplazamiento, suma == totalCost. `matches[]` de arriba
    // es una estimación por partido, solo informativa (fix P3).
    byDay: { date: string; cost: number; km: number }[]
    totalCost: number
    fees: number
    total: number
    unresolvedFees: number
  }[]
  costByMatchday: { matchday: number; cost: number; matches: number }[]
  costByMonth: { month: string; cost: number; matches: number }[]
  costByMunicipality: { municipality: string; totalCost: number; count: number }[]
  coverageHistory: {
    saturday: string
    from: string
    to: string
    totalMatches: number
    covered: number
    partial: number
    uncovered: number
  }[]
  monthlyLiquidation: MonthlyLiquidation
}

// "2026-07" → "Julio 2026". Duplica el helper privado de export-pdf.ts (no
// exportado): un mes natural legible para el toggle de la vista mensual.
function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const label = new Date(year, m - 1, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const FBM_NAVY = '#00205B'
const FBM_GOLD = '#C8A951'
const COVERAGE_GREEN = '#16a34a'
const COVERAGE_ORANGE = '#f97316'
const COVERAGE_RED = '#ef4444'

function scopeButtonClass(active: boolean) {
  return `rounded-md px-3 py-1 text-xs font-medium transition-colors ${
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
  }`
}

export function ReportesView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [liquidationView, setLiquidationView] = useState<'current' | 'monthly'>('current')
  const [selectedMonthlyPerson, setSelectedMonthlyPerson] = useState<string | null>(null)

  // Ámbito del informe (4.2.2): reflejado en la URL (`?jornada=` | `?month=` |
  // `?scope=season`), igual que consume el contrato de /api/admin/reports.
  // Deep-linkable: recargar o compartir la URL reproduce el mismo ámbito.
  const jornadaParam = searchParams.get('jornada')
  const monthParam = searchParams.get('month')
  const scope: ReportScope =
    searchParams.get('scope') === 'season' ? 'season' : monthParam ? 'month' : 'jornada'
  const jornadaValue = jornadaParam ?? (data && scope === 'jornada' ? data.summary.scopeLabel : '')
  const monthValue = monthParam ?? (data && scope === 'month' ? data.summary.scopeLabel : '')

  const goToJornada = (saturday: string) => router.push(`${pathname}?jornada=${saturday}`)
  const goToMonth = (month: string) => router.push(`${pathname}?month=${month}`)
  const goToSeason = () => router.push(`${pathname}?scope=season`)
  const goToDefaultJornada = () => router.push(pathname)

  const queryString = searchParams.toString()
  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/reports${queryString ? `?${queryString}` : ''}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [queryString])

  // Temporada real derivada del rango del informe (fuente única `seasonLabel`,
  // ver mock-data-client.ts): antes literal fijo "2024-25" desactualizado.
  const seasonText = data ? seasonLabel(data.summary.from || formatLocalDate(new Date())) : ''

  // Etiqueta de ámbito para títulos y ficheros de los exports del ámbito
  // seleccionado (fix "Jornada 0": en mes/temporada `matchday` viene null).
  const exportScopeLabel = !data
    ? ''
    : data.summary.scope === 'season'
      ? 'Temporada completa'
      : data.summary.scope === 'month'
        ? `Mes ${data.summary.scopeLabel}`
        : `Jornada ${data.summary.matchday || data.summary.scopeLabel}`

  const exportCSV = () => {
    if (!data) return
    const headers = ['Persona', 'Rol', 'Municipio', 'IBAN', 'Partidos', 'Coste Total (€)']
    const rows = data.liquidation.map((p) => [
      p.name,
      p.role === 'arbitro' ? 'Árbitro' : 'Anotador',
      p.municipality,
      p.bankIban,
      p.matches.length.toString(),
      p.totalCost.toFixed(2),
    ])

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Nombre de fichero por ámbito: `matchday` ya no aplica a mes/temporada.
    a.download = `liquidacion-${data.summary.scope}-${data.summary.scopeLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    if (!data) return
    exportLiquidationXlsx(data.liquidation, data.costByMatchday, exportScopeLabel)
  }

  const handleExportPdf = () => {
    if (!data) return
    exportLiquidationPdf(data.liquidation, exportScopeLabel, seasonText)
  }

  const handleExportPersonPdf = () => {
    if (!data || !selectedLiquidation) return
    exportPersonDetailPdf(selectedLiquidation, exportScopeLabel, seasonText)
  }

  const handleExportMonthlyExcel = () => {
    if (!data) return
    exportMonthlyLiquidationXlsx(data.monthlyLiquidation)
  }

  const handleExportMonthlyPersonPdf = () => {
    if (!data || !selectedMonthlyLiq) return
    const month = data.monthlyLiquidation.month
    // Temporada derivada del MES liquidado, no de hoy: un justificante de
    // octubre generado meses después debe seguir diciendo su temporada real.
    exportMonthlyJustificantePdf(selectedMonthlyLiq, month, seasonLabel(`${month}-01`))
  }

  const selectedLiquidation = data?.liquidation.find((p) => p.personId === selectedPerson)
  const selectedMonthlyLiq = data?.monthlyLiquidation.people.find(
    (p) => p.personId === selectedMonthlyPerson,
  )
  // Derivados para las tarjetas del sheet mensual: `MonthlyLiquidation` ya no
  // trae totalMatches/totalKm precalculados (ese shape era del `matchdays[]`
  // legacy), se agregan aquí desde `days[]`.
  const monthlyTotalMatches =
    selectedMonthlyLiq?.days.reduce((sum, d) => sum + d.matches.length, 0) ?? 0
  const monthlyTotalKm = Number(
    (selectedMonthlyLiq?.days.reduce((sum, d) => sum + d.km, 0) ?? 0).toFixed(1),
  )

  if (loading || !data) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-1 text-sm text-gray-500">Cargando datos...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  const coveragePercent =
    data.summary.totalMatches > 0
      ? Math.round((data.summary.covered / data.summary.totalMatches) * 100)
      : 0

  // Label del toggle mensual: mes natural de `monthlyLiquidation.month`
  // (antes "J13-J15", un rango de jornada que ya no aplica: la liquidación
  // mensual se reescribió a mes natural, ver mensaje de la tanda 4.3).
  const monthlyRangeLabel = monthLabel(data.monthlyLiquidation.month)

  // Texto de ámbito para la cabecera: `matchday` ya no aplica a mes/temporada
  // (viene `null` del API, ver route.ts).
  const scopeText =
    data.summary.scope === 'season'
      ? 'Temporada completa'
      : data.summary.scope === 'month'
        ? `Mes ${data.summary.scopeLabel}`
        : `Jornada${data.summary.matchday ? ` ${data.summary.matchday}` : ''}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {scopeText} — Temporada {seasonText}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCSV}>
              <FileText className="mr-2 h-4 w-4" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf}>
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Selector de ámbito (4.2.2): jornada / mes / temporada, deep-linkable */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button onClick={goToDefaultJornada} className={scopeButtonClass(scope === 'jornada')}>
            Jornada
          </button>
          <button
            onClick={() => goToMonth(monthParam ?? formatLocalDate(new Date()).slice(0, 7))}
            className={scopeButtonClass(scope === 'month')}
          >
            Mes
          </button>
          <button onClick={goToSeason} className={scopeButtonClass(scope === 'season')}>
            Temporada
          </button>
        </div>

        {scope === 'jornada' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500" htmlFor="reportes-jornada">
              Jornada
            </label>
            <input
              id="reportes-jornada"
              type="date"
              value={jornadaValue}
              onChange={(e) => {
                if (e.target.value) goToJornada(getJornadaSaturdayForDate(e.target.value))
              }}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        {scope === 'month' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500" htmlFor="reportes-month">
              Mes
            </label>
            <input
              id="reportes-month"
              type="month"
              value={monthValue}
              onChange={(e) => {
                if (e.target.value) goToMonth(e.target.value)
              }}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}

        <span className="text-xs text-gray-400">
          {data.summary.from} → {data.summary.to}
        </span>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase text-gray-500">Coste total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.summary.totalCost.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-gray-400">Desplazamiento</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase text-gray-500">Partidos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.summary.totalMatches}</p>
          <p className="mt-1 text-xs text-gray-400">En el rango seleccionado</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase text-gray-500">Personas asignadas</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.liquidation.length}</p>
          <p className="mt-1 text-xs text-gray-400">Con partidos</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase text-gray-500">Coste medio/partido</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.summary.totalMatches > 0
              ? (data.summary.totalCost / data.summary.totalMatches).toFixed(2)
              : '0.00'}{' '}
            €
          </p>
          <p className="mt-1 text-xs text-gray-400">Promedio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Coverage */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Cobertura de partidos</h2>
          <Progress value={coveragePercent} className="mb-3 h-3" />
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <p className="text-lg font-bold text-green-600">{data.summary.covered}</p>
              <p className="text-gray-500">Cubiertos</p>
            </div>
            <div>
              <p className="text-lg font-bold text-orange-500">{data.summary.partial}</p>
              <p className="text-gray-500">Parcial</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-500">{data.summary.uncovered}</p>
              <p className="text-gray-500">Sin cubrir</p>
            </div>
          </div>
        </div>

        {/* Cost per matchday - recharts */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Coste por jornada</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.costByMatchday} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="matchday"
                tickFormatter={(v) => `J${v}`}
                fontSize={11}
                tick={{ fill: '#6b7280' }}
              />
              <YAxis fontSize={11} tick={{ fill: '#6b7280' }} tickFormatter={(v) => `${v}€`} />
              <Tooltip
                formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(2)} €`, 'Coste']}
                labelFormatter={(label) => `Jornada ${label}`}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                {data.costByMatchday.map((entry) => (
                  <Cell
                    key={entry.matchday}
                    fill={entry.matchday === data.summary.matchday ? FBM_NAVY : '#d1d5db'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Coverage history - recharts stacked bar, temporada completa (4.2.4) */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">
          Cobertura por jornada (temporada completa)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.coverageHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="saturday"
              tickFormatter={(v: string) => v.slice(5)}
              fontSize={10}
              tick={{ fill: '#6b7280' }}
              interval="preserveStartEnd"
            />
            <YAxis fontSize={11} tick={{ fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip labelFormatter={(label) => `Jornada del ${label}`} />
            <Legend
              formatter={(value) =>
                value === 'covered' ? 'Cubiertos' : value === 'partial' ? 'Parcial' : 'Sin cubrir'
              }
            />
            <Bar dataKey="covered" stackId="coverage" fill={COVERAGE_GREEN} name="covered" />
            <Bar dataKey="partial" stackId="coverage" fill={COVERAGE_ORANGE} name="partial" />
            <Bar
              dataKey="uncovered"
              stackId="coverage"
              fill={COVERAGE_RED}
              radius={[4, 4, 0, 0]}
              name="uncovered"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost by municipality - horizontal bar chart */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">
          Coste por municipio (temporada completa)
        </h2>
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, data.costByMunicipality.length * 40)}
        >
          <BarChart
            data={data.costByMunicipality}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              fontSize={11}
              tick={{ fill: '#6b7280' }}
              tickFormatter={(v) => `${v}€`}
            />
            <YAxis
              type="category"
              dataKey="municipality"
              fontSize={11}
              tick={{ fill: '#6b7280' }}
              width={75}
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                `${(value ?? 0).toFixed(2)} €`,
                'Coste total',
              ]}
            />
            <Bar dataKey="totalCost" fill={FBM_GOLD} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Load per person */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Carga por persona</h2>
        <div className="space-y-2">
          {data.loadByPerson
            .filter((p) => p.matchesAssigned > 0)
            .sort((a, b) => b.matchesAssigned - a.matchesAssigned)
            .map((person) => {
              const maxLoad = Math.max(...data.loadByPerson.map((p) => p.matchesAssigned), 1)
              return (
                <div key={person.personId} className="flex items-center gap-3">
                  <span className="w-40 truncate text-xs font-medium text-gray-700">
                    {person.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      person.role === 'arbitro'
                        ? 'border-blue-200 text-blue-600'
                        : 'border-purple-200 text-purple-600'
                    }`}
                  >
                    {person.role === 'arbitro' ? 'Árb.' : 'Anot.'}
                  </Badge>
                  <div className="flex-1">
                    <div
                      className="h-4 rounded bg-blue-400"
                      style={{
                        width: `${(person.matchesAssigned / maxLoad) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs text-gray-500">
                    {person.matchesAssigned} partido{person.matchesAssigned !== 1 ? 's' : ''}
                  </span>
                  <span className="w-16 text-right text-xs font-medium text-gray-700">
                    {person.totalCost.toFixed(2)} €
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {/* Liquidation section with toggle */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Liquidación</h2>
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                onClick={() => setLiquidationView('current')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  liquidationView === 'current'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Ámbito seleccionado
              </button>
              <button
                onClick={() => setLiquidationView('monthly')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  liquidationView === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Mensual ({monthlyRangeLabel})
              </button>
            </div>
          </div>
          {liquidationView === 'current' ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 text-xs">
                <Download className="h-3 w-3" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-2 text-xs"
              >
                <FileSpreadsheet className="h-3 w-3" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                className="gap-2 text-xs"
              >
                <FileText className="h-3 w-3" />
                PDF
              </Button>
            </div>
          ) : (
            // El PDF mensual completo (`exportMonthlyLiquidationPdf`) se retira: es
            // la versión legacy basada en `matchdays` ("Jornada 0"), incompatible
            // con el nuevo shape de mes natural. El Excel ya trae honorarios y el
            // justificante PDF por persona (botón en el sheet de detalle) cubre el
            // caso de uso real (entregar un justificante individual).
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMonthlyExcel}
                className="gap-2 text-xs"
              >
                <FileSpreadsheet className="h-3 w-3" />
                Excel mensual
              </Button>
            </div>
          )}
        </div>

        {liquidationView === 'current' ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-gray-600">Persona</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-600">Rol</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-600">Municipio</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-600">Partidos</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                    Desplazamiento (€)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                    Honorarios (€)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                    Total (€)
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-600" />
                </tr>
              </thead>
              <tbody>
                {data.liquidation.map((person) => (
                  <tr key={person.personId} className="border-b border-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{person.name}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          person.role === 'arbitro'
                            ? 'border-blue-200 text-blue-600'
                            : 'border-purple-200 text-purple-600'
                        }`}
                      >
                        {person.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{person.municipality}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{person.matches.length}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-600">
                      {person.totalCost.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-600">
                      {person.fees.toFixed(2)}
                      {person.unresolvedFees > 0 && (
                        <Badge
                          variant="outline"
                          className="ml-1 border-orange-300 text-[10px] text-orange-600"
                        >
                          {person.unresolvedFees} sin tarifa
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      {person.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setSelectedPerson(person.personId)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-gray-900">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                    {data.liquidation.reduce((sum, p) => sum + p.totalCost, 0).toFixed(2)} €
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                    {data.liquidation.reduce((sum, p) => sum + p.fees, 0).toFixed(2)} €
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                    {data.liquidation.reduce((sum, p) => sum + p.total, 0).toFixed(2)} €
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <MonthlyLiquidationTable
            data={data.monthlyLiquidation}
            onSelectPerson={setSelectedMonthlyPerson}
          />
        )}
      </div>

      {/* Person detail sheet */}
      <Sheet
        open={!!selectedPerson}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null)
        }}
      >
        <SheetContent className="w-full overflow-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedLiquidation?.name ?? 'Detalle'}</SheetTitle>
          </SheetHeader>
          {selectedLiquidation && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Partidos</p>
                  <p className="text-lg font-bold">{selectedLiquidation.matches.length}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Desplazamiento</p>
                  <p className="text-lg font-bold">{selectedLiquidation.totalCost.toFixed(2)} €</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Honorarios</p>
                  <p className="text-lg font-bold">{selectedLiquidation.fees.toFixed(2)} €</p>
                  {selectedLiquidation.unresolvedFees > 0 && (
                    <Badge
                      variant="outline"
                      className="mt-1 border-orange-300 text-[10px] text-orange-600"
                    >
                      {selectedLiquidation.unresolvedFees} sin tarifa
                    </Badge>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold text-blue-900">
                  {selectedLiquidation.total.toFixed(2)} €
                </p>
              </div>
              <Separator />
              {/* Desglose real por día (fix P3): coste FBM es por día, no por
                  partido; esta suma == Desplazamiento de arriba. La lista de
                  partidos de abajo es solo informativa (qué se pitó ese rango). */}
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">Desglose por día</p>
                <div className="space-y-2">
                  {selectedLiquidation.byDay.map((d) => (
                    <div
                      key={d.date}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.date}</p>
                        <p className="text-xs text-gray-500">{d.km.toFixed(1)} km</p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{d.cost.toFixed(2)} €</p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">Partidos</p>
                <div className="space-y-2">
                  {selectedLiquidation.matches.map((m) => (
                    <div
                      key={m.matchId}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {m.homeTeam} vs {m.awayTeam}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {m.date} · {m.time} — {m.venue}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="text-xs text-gray-500">
                <p>IBAN: {selectedLiquidation.bankIban}</p>
                <p>Municipio: {selectedLiquidation.municipality}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPersonPdf}
                className="w-full gap-2"
              >
                <FileText className="h-4 w-4" />
                Descargar justificante (PDF)
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Monthly person detail sheet */}
      <Sheet
        open={!!selectedMonthlyPerson}
        onOpenChange={(open) => {
          if (!open) setSelectedMonthlyPerson(null)
        }}
      >
        <SheetContent className="w-full overflow-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedMonthlyLiq?.name ?? 'Detalle mensual'}</SheetTitle>
          </SheetHeader>
          {selectedMonthlyLiq && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Partidos</p>
                  <p className="text-lg font-bold">{monthlyTotalMatches}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Km totales</p>
                  <p className="text-lg font-bold">{monthlyTotalKm}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Desplazamiento</p>
                  <p className="text-lg font-bold">{selectedMonthlyLiq.travelCost.toFixed(2)} €</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Honorarios</p>
                  <p className="text-lg font-bold">{selectedMonthlyLiq.fees.toFixed(2)} €</p>
                  {selectedMonthlyLiq.unresolvedFees > 0 && (
                    <Badge
                      variant="outline"
                      className="mt-1 border-orange-300 text-[10px] text-orange-600"
                    >
                      {selectedMonthlyLiq.unresolvedFees} sin tarifa
                    </Badge>
                  )}
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-blue-900">
                    {selectedMonthlyLiq.total.toFixed(2)} €
                  </p>
                </div>
              </div>
              <Separator />
              {/* Desglose real por día (`days[]`, mismo contrato que la liquidación
                  jornada): suma de travelCost == Desplazamiento de arriba. */}
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">Desglose por día</p>
                <div className="space-y-2">
                  {selectedMonthlyLiq.days.map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{day.date}</p>
                        <p className="text-xs text-gray-500">
                          {day.matches.length} partido{day.matches.length !== 1 ? 's' : ''} ·{' '}
                          {day.municipalities.join(', ')} · {day.km} km
                        </p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {day.travelCost.toFixed(2)} €
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="text-xs text-gray-500">
                <p>IBAN: {selectedMonthlyLiq.bankIban}</p>
                <p>Municipio: {selectedMonthlyLiq.municipality}</p>
                <p>Rol: {selectedMonthlyLiq.role === 'arbitro' ? 'Árbitro' : 'Anotador'}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMonthlyPersonPdf}
                className="w-full gap-2"
              >
                <FileText className="h-4 w-4" />
                Descargar justificante (PDF)
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Monthly Liquidation Table ─────────────────────────────────────────────
// Shape reescrito a mes natural (4.3): ya no hay columnas J1..Jn por jornada,
// el desglose por persona vive en `people[].days[]` (ver MonthlyLiquidation
// en lib/export-xlsx.ts). Partidos/Km se agregan aquí desde `days[]` porque
// el contrato ya no los trae precalculados.

function MonthlyLiquidationTable({
  data,
  onSelectPerson,
}: {
  data: MonthlyLiquidation
  onSelectPerson: (personId: string) => void
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-3 py-2 text-xs font-medium text-gray-600">Persona</th>
            <th className="px-3 py-2 text-xs font-medium text-gray-600">Rol</th>
            <th className="px-3 py-2 text-xs font-medium text-gray-600">Municipio</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Partidos</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Km</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
              Desplazamiento (€)
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
              Honorarios (€)
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Total (€)</th>
            <th className="px-3 py-2 text-xs font-medium text-gray-600" />
          </tr>
        </thead>
        <tbody>
          {data.people.map((person) => {
            const totalMatches = person.days.reduce((sum, d) => sum + d.matches.length, 0)
            const totalKm = Number(person.days.reduce((sum, d) => sum + d.km, 0).toFixed(1))
            return (
              <tr key={person.personId} className="border-b border-gray-50">
                <td className="px-3 py-2 text-sm font-medium text-gray-900">{person.name}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      person.role === 'arbitro'
                        ? 'border-blue-200 text-blue-600'
                        : 'border-purple-200 text-purple-600'
                    }`}
                  >
                    {person.role === 'arbitro' ? 'Árb.' : 'Anot.'}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">{person.municipality}</td>
                <td className="px-3 py-2 text-center text-xs text-gray-600">{totalMatches}</td>
                <td className="px-3 py-2 text-center text-xs text-gray-600">{totalKm}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-600">
                  {person.travelCost.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-gray-600">
                  {person.fees.toFixed(2)}
                  {person.unresolvedFees > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 border-orange-300 text-[10px] text-orange-600"
                    >
                      {person.unresolvedFees} sin tarifa
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                  {person.total.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onSelectPerson(person.personId)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Detalle
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-gray-50">
            <td colSpan={5} className="px-3 py-2 text-sm font-semibold text-gray-900">
              Total
            </td>
            <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
              {data.totalTravelCost.toFixed(2)} €
            </td>
            <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
              {data.totalFees.toFixed(2)} €
            </td>
            <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
              {data.total.toFixed(2)} €
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
