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
import { exportLiquidationXlsx, exportMonthlyLiquidationXlsx } from '@/lib/export-xlsx'
import {
  exportLiquidationPdf,
  exportPersonDetailPdf,
  exportMonthlyLiquidationPdf,
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
    totalCost: number
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
  monthlyLiquidation: {
    personId: string
    name: string
    role: string
    municipality: string
    bankIban: string
    matchdays: { matchday: number; matches: number; cost: number; km: number }[]
    totalMatches: number
    totalKm: number
    totalCost: number
  }[]
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
    exportLiquidationXlsx(data.liquidation, data.costByMatchday, data.summary.matchday ?? 0)
  }

  const handleExportPdf = () => {
    if (!data) return
    exportLiquidationPdf(data.liquidation, data.summary.matchday ?? 0, seasonText)
  }

  const handleExportPersonPdf = () => {
    if (!data || !selectedLiquidation) return
    exportPersonDetailPdf(selectedLiquidation, data.summary.matchday ?? 0, seasonText)
  }

  const handleExportMonthlyExcel = () => {
    if (!data) return
    exportMonthlyLiquidationXlsx(data.monthlyLiquidation, monthlyMatchdays)
  }

  const handleExportMonthlyPdf = () => {
    if (!data) return
    exportMonthlyLiquidationPdf(data.monthlyLiquidation, monthlyMatchdays, seasonText)
  }

  const selectedLiquidation = data?.liquidation.find((p) => p.personId === selectedPerson)
  const selectedMonthlyLiq = data?.monthlyLiquidation.find(
    (p) => p.personId === selectedMonthlyPerson,
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

  // Jornadas cubiertas por la liquidación mensual (temporada completa, ajena al
  // ámbito elegido arriba): única fuente para el label del toggle y los dos
  // exports mensuales, antes recalculada tres veces (y una vez sin comparador
  // numérico en `.sort()`, ver export-pdf.ts para el mismo patrón correcto).
  const monthlyMatchdays = [
    ...new Set(data.monthlyLiquidation.flatMap((p) => p.matchdays.map((m) => m.matchday))),
  ].sort((a, b) => a - b)
  const monthlyRangeLabel =
    monthlyMatchdays.length > 0
      ? `J${monthlyMatchdays[0]}-J${monthlyMatchdays[monthlyMatchdays.length - 1]}`
      : 'Mensual'

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
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMonthlyPdf}
                className="gap-2 text-xs"
              >
                <FileText className="h-3 w-3" />
                PDF mensual
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
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      {person.totalCost.toFixed(2)}
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
                    {data.summary.totalCost.toFixed(2)} €
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
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Partidos</p>
                  <p className="text-lg font-bold">{selectedLiquidation.matches.length}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold">{selectedLiquidation.totalCost.toFixed(2)} €</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                {selectedLiquidation.matches.map((m) => (
                  <div key={m.matchId} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-900">
                      {m.homeTeam} vs {m.awayTeam}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {m.date} · {m.time} — {m.venue}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {m.travelCost.toFixed(2)} € · {m.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                ))}
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
                  <p className="text-lg font-bold">{selectedMonthlyLiq.totalMatches}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Km totales</p>
                  <p className="text-lg font-bold">{selectedMonthlyLiq.totalKm}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold">{selectedMonthlyLiq.totalCost.toFixed(2)} €</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                {selectedMonthlyLiq.matchdays.map((md) => (
                  <div
                    key={md.matchday}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">Jornada {md.matchday}</p>
                      <p className="text-xs text-gray-500">
                        {md.matches} partido{md.matches !== 1 ? 's' : ''} · {md.km} km
                      </p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{md.cost.toFixed(2)} €</p>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="text-xs text-gray-500">
                <p>IBAN: {selectedMonthlyLiq.bankIban}</p>
                <p>Municipio: {selectedMonthlyLiq.municipality}</p>
                <p>Rol: {selectedMonthlyLiq.role === 'arbitro' ? 'Árbitro' : 'Anotador'}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Monthly Liquidation Table ─────────────────────────────────────────────

interface MonthlyLiquidationData {
  personId: string
  name: string
  role: string
  municipality: string
  bankIban: string
  matchdays: { matchday: number; matches: number; cost: number; km: number }[]
  totalMatches: number
  totalKm: number
  totalCost: number
}

function MonthlyLiquidationTable({
  data,
  onSelectPerson,
}: {
  data: MonthlyLiquidationData[]
  onSelectPerson: (personId: string) => void
}) {
  const allMatchdays = [...new Set(data.flatMap((p) => p.matchdays.map((m) => m.matchday)))].sort(
    (a, b) => a - b,
  )
  const grandTotal = data.reduce((sum, p) => sum + p.totalCost, 0)

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-3 py-2 text-xs font-medium text-gray-600">Persona</th>
            <th className="px-3 py-2 text-xs font-medium text-gray-600">Rol</th>
            <th className="px-3 py-2 text-xs font-medium text-gray-600">Municipio</th>
            {allMatchdays.map((md) => (
              <th key={md} className="px-3 py-2 text-center text-xs font-medium text-gray-600">
                J{md}
              </th>
            ))}
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Partidos</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Km</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Total (€)</th>
            <th className="px-3 py-2 text-xs font-medium text-gray-600" />
          </tr>
        </thead>
        <tbody>
          {data.map((person) => (
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
              {allMatchdays.map((md) => {
                const entry = person.matchdays.find((m) => m.matchday === md)
                return (
                  <td key={md} className="px-3 py-2 text-center text-xs text-gray-600">
                    {entry ? `${entry.cost.toFixed(2)}` : '—'}
                  </td>
                )
              })}
              <td className="px-3 py-2 text-center text-xs text-gray-600">{person.totalMatches}</td>
              <td className="px-3 py-2 text-center text-xs text-gray-600">{person.totalKm}</td>
              <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                {person.totalCost.toFixed(2)}
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
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-gray-50">
            <td
              colSpan={3 + allMatchdays.length + 2}
              className="px-3 py-2 text-sm font-semibold text-gray-900"
            >
              Total
            </td>
            <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
              {grandTotal.toFixed(2)} €
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
