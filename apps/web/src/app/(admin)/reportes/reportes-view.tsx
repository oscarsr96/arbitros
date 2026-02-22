'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Download, MapPin } from 'lucide-react'

interface ReportData {
  summary: {
    totalCost: number
    totalMatches: number
    covered: number
    partial: number
    uncovered: number
    matchday: number
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
}

export function ReportesView() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/reports')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

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
    a.download = `liquidacion-jornada-${data.summary.matchday}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedLiquidation = data?.liquidation.find((p) => p.personId === selectedPerson)

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

  const maxLoad = Math.max(...data.loadByPerson.map((p) => p.matchesAssigned), 1)
  const maxCost = Math.max(...data.loadByPerson.map((p) => p.totalCost), 1)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Informes de la jornada {data.summary.matchday}
          </p>
        </div>
        <Button onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase text-gray-500">Coste total jornada</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.summary.totalCost.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-gray-400">Desplazamiento</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase text-gray-500">Partidos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.summary.totalMatches}</p>
          <p className="mt-1 text-xs text-gray-400">En la jornada</p>
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

        {/* Cost per matchday (simple bar) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Coste por jornada</h2>
          <div className="space-y-2">
            {[
              { label: 'Jornada 13', cost: 18.5 },
              { label: 'Jornada 14', cost: 22.3 },
              { label: `Jornada ${data.summary.matchday}`, cost: data.summary.totalCost },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-20 text-xs text-gray-600">{row.label}</span>
                <div className="flex-1">
                  <div
                    className={`h-5 rounded ${
                      row.label.includes(String(data.summary.matchday))
                        ? 'bg-fbm-navy'
                        : 'bg-gray-300'
                    }`}
                    style={{
                      width: `${Math.min((row.cost / Math.max(data.summary.totalCost, 25)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="w-16 text-right text-xs font-medium text-gray-700">
                  {row.cost.toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Load per person */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Carga por persona</h2>
        <div className="space-y-2">
          {data.loadByPerson
            .filter((p) => p.matchesAssigned > 0)
            .sort((a, b) => b.matchesAssigned - a.matchesAssigned)
            .map((person) => (
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
            ))}
        </div>
      </div>

      {/* Liquidation table */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Liquidación</h2>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 text-xs">
            <Download className="h-3 w-3" />
            Exportar
          </Button>
        </div>
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
      </div>

      {/* Mapa de calor placeholder */}
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <MapPin className="mx-auto mb-2 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-400">Mapa de calor por municipio</p>
        <p className="text-xs text-gray-300">Disponible en fase posterior</p>
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
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
