'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { StatCard } from '@/components/stat-card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AvailabilityAlertDialog } from '@/components/availability-alert-dialog'
import { toast } from 'sonner'
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
  Bell,
  Mail,
} from 'lucide-react'
import type { DashboardStats, DashboardAlert } from '@/lib/types'

interface AlertLogEntry {
  id: string
  weekStart: string
  roles: string[]
  categories: string[]
  message: string
  recipientCount: number
  sentAt: string
}

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [alertDialogOpen, setAlertDialogOpen] = useState(false)
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>([])

  const fetchAlertLog = useCallback(() => {
    fetch('/api/admin/alerts')
      .then((r) => r.json())
      .then((data) => setAlertLog(data.alerts ?? []))
  }, [])

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats)
        setAlerts(data.alerts)
      })
      .finally(() => setLoading(false))
    fetchAlertLog()
  }, [fetchAlertLog])

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

  // Availability urgency for alert button
  const refPct =
    stats.totalReferees > 0
      ? Math.round((stats.refereesAvailable / stats.totalReferees) * 100)
      : 100
  const scorPct =
    stats.totalScorers > 0 ? Math.round((stats.scorersAvailable / stats.totalScorers) * 100) : 100
  const refLow = refPct < 60
  const scorLow = scorPct < 60
  const bothGood = refPct >= 90 && scorPct >= 90

  const alertDefaultRoles: string[] =
    refLow && !scorLow ? ['arbitro'] : !refLow && scorLow ? ['anotador'] : []

  const alertButtonLabel = bothGood
    ? 'Enviar alerta de disponibilidad'
    : refLow && scorLow
      ? 'Enviar alerta a todos'
      : refLow
        ? 'Enviar alerta a árbitros'
        : scorLow
          ? 'Enviar alerta a anotadores'
          : 'Enviar alerta de disponibilidad'

  const alertButtonVariant: 'ghost' | 'destructive' | 'outline' = bothGood
    ? 'ghost'
    : refLow || scorLow
      ? 'destructive'
      : 'outline'

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Resumen del estado de la jornada actual.</p>
        </div>
        <Button
          onClick={() => setAlertDialogOpen(true)}
          variant={alertButtonVariant}
          className={`gap-2 ${alertButtonVariant === 'destructive' ? 'animate-pulse' : ''}`}
        >
          <Bell className="h-4 w-4" />
          {alertButtonLabel}
        </Button>
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

      {/* Alert history */}
      {alertLog.length > 0 && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">
            Alertas de disponibilidad enviadas
          </h2>
          <div className="space-y-2">
            {alertLog.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <Mail className="h-4 w-4 flex-shrink-0 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{entry.recipientCount}</span> destinatario
                    {entry.recipientCount !== 1 ? 's' : ''} — semana{' '}
                    <span className="font-medium">{entry.weekStart}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">
                        {r === 'arbitro' ? 'Árbitros' : 'Anotadores'}
                      </Badge>
                    ))}
                    {entry.categories.map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">
                        {c}
                      </Badge>
                    ))}
                    {entry.roles.length === 0 && entry.categories.length === 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        Todos
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(entry.sentAt).toLocaleString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <AvailabilityAlertDialog
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        defaultRoles={alertDefaultRoles}
        onSent={() => {
          toast.success('Alerta de disponibilidad enviada')
          fetchAlertLog()
        }}
      />
    </div>
  )
}
