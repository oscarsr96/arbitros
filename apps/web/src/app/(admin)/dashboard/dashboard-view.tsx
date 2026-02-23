'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StatCard } from '@/components/stat-card'
import { Progress } from '@/components/ui/progress'
import {
  Calendar,
  Users,
  UserCheck,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
} from 'lucide-react'
import type { DashboardStats, DashboardAlert } from '@/lib/types'

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats)
        setAlerts(data.alerts)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Cargando datos de la jornada...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  const coveragePercent =
    stats.totalMatches > 0 ? Math.round((stats.coveredMatches / stats.totalMatches) * 100) : 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Resumen del estado de la jornada actual.</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Partidos esta jornada"
          value={stats.totalMatches}
          sub={`${stats.coveredMatches} cubiertos, ${stats.uncoveredMatches} sin cubrir`}
          color="bg-blue-50 text-blue-700 border-blue-200"
          icon={Calendar}
        />
        <StatCard
          label="Árbitros disponibles"
          value={`${stats.refereesAvailable} / ${stats.totalReferees}`}
          sub="Con disponibilidad registrada"
          color="bg-green-50 text-green-700 border-green-200"
          icon={Users}
        />
        <StatCard
          label="Anotadores disponibles"
          value={`${stats.scorersAvailable} / ${stats.totalScorers}`}
          sub="Con disponibilidad registrada"
          color="bg-purple-50 text-purple-700 border-purple-200"
          icon={UserCheck}
        />
        <StatCard
          label="Partidos sin cubrir"
          value={stats.uncoveredMatches + stats.partiallyCovered}
          sub={`${stats.uncoveredMatches} vacíos, ${stats.partiallyCovered} parciales`}
          color="bg-orange-50 text-orange-700 border-orange-200"
          icon={AlertCircle}
        />
        <StatCard
          label="Coste estimado"
          value={`${stats.estimatedCost.toFixed(2)} €`}
          sub="Total desplazamiento jornada"
          color="bg-gray-50 text-gray-700 border-gray-200"
          icon={DollarSign}
        />
        <StatCard
          label="Designaciones activas"
          value={`${stats.coveredMatches}`}
          sub="Partidos completamente cubiertos"
          color="bg-teal-50 text-teal-700 border-teal-200"
          icon={CheckCircle2}
        />
      </div>

      {/* Coverage progress */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Cobertura de la jornada</h2>
          <span className="text-sm font-bold text-gray-700">{coveragePercent}%</span>
        </div>
        <Progress value={coveragePercent} className="h-3" />
        <p className="mt-2 text-xs text-gray-500">
          {stats.coveredMatches} de {stats.totalMatches} partidos completamente cubiertos
        </p>
      </div>

      {/* Alerts */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Alertas de la jornada</h2>
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-sm text-gray-400">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-400" />
            Todo en orden. No hay alertas pendientes.
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => {
              const Icon =
                alert.type === 'error'
                  ? AlertCircle
                  : alert.type === 'warning'
                    ? AlertTriangle
                    : Info
              const colors =
                alert.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : alert.type === 'warning'
                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'

              return (
                <div key={i} className={`flex items-center gap-3 rounded-lg border p-3 ${colors}`}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-sm">{alert.message}</span>
                  {alert.link && (
                    <Link
                      href={alert.link}
                      className="flex items-center gap-1 text-xs font-medium hover:underline"
                    >
                      Ver <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/partidos"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:bg-gray-50"
        >
          <Calendar className="h-8 w-8 text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Ver partidos de la jornada</p>
            <p className="text-xs text-gray-500">Filtrar, importar y gestionar partidos</p>
          </div>
        </Link>
        <Link
          href="/asignacion"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:bg-gray-50"
        >
          <Users className="h-8 w-8 text-orange-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Ir a asignación</p>
            <p className="text-xs text-gray-500">Asignar árbitros y anotadores manualmente</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
