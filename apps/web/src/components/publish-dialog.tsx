'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Send } from 'lucide-react'
import type { ScheduleConflict } from '@/lib/schedule-conflicts'

const CONFLICT_REASON_LABELS: Record<ScheduleConflict['reason'], string> = {
  overlap: 'Solape de horario',
  'insufficient-gap': 'Sin margen para el desplazamiento',
  'tight-gap': 'Margen ajustado',
}

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  stats: {
    totalMatches: number
    coveredMatches: number
    pendingDesignations: number
    personsToNotify: number
  }
  conflicts: ScheduleConflict[]
  /** matchId → "Local vs Visitante (hora)" para las filas de conflicto. */
  matchLabels: Record<string, string>
}

export function PublishDialog({
  open,
  onOpenChange,
  onConfirm,
  stats,
  conflicts,
  matchLabels,
}: PublishDialogProps) {
  const hasUncovered = stats.coveredMatches < stats.totalMatches
  // El botón solo cambia de texto con ERRORES; los avisos (ámbar) no lo alteran.
  const errorCount = conflicts.filter((c) => c.severity === 'error').length

  // Agrupa por persona (nick/nombre del propio conflicto) para listar en el diálogo.
  const conflictsByPerson = conflicts.reduce<Record<string, ScheduleConflict[]>>((acc, c) => {
    if (!acc[c.personId]) acc[c.personId] = []
    acc[c.personId].push(c)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publicar designaciones</DialogTitle>
          <DialogDescription>Se notificará a las personas asignadas por email.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Partidos totales</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalMatches}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Completamente cubiertos</p>
              <p className="text-lg font-bold text-green-600">{stats.coveredMatches}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Designaciones pendientes</p>
              <p className="text-lg font-bold text-gray-900">{stats.pendingDesignations}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Personas a notificar</p>
              <p className="text-lg font-bold text-blue-600">{stats.personsToNotify}</p>
            </div>
          </div>

          {hasUncovered && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Hay {stats.totalMatches - stats.coveredMatches} partido
                {stats.totalMatches - stats.coveredMatches !== 1 ? 's' : ''} sin cobertura completa.
                Puedes publicar igualmente y completar las asignaciones después.
              </AlertDescription>
            </Alert>
          )}

          {conflicts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">
                {conflicts.length} conflicto{conflicts.length !== 1 ? 's' : ''} de horario detectado
                {conflicts.length !== 1 ? 's' : ''}. Puedes publicar igualmente.
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {Object.entries(conflictsByPerson).map(([personId, personConflicts]) => {
                  const { personName, personNick } = personConflicts[0]
                  const label =
                    [personName, personNick ? `«${personNick}»` : null].filter(Boolean).join(' ') ||
                    personId
                  return (
                    <div key={personId} className="space-y-1">
                      <p className="text-xs font-semibold text-gray-700">{label}</p>
                      {personConflicts.map((c) => (
                        <div
                          key={`${c.matchAId}-${c.matchBId}-${c.reason}`}
                          className={`rounded-md border px-2 py-1.5 text-xs ${
                            c.severity === 'error'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          <span className="font-medium">{CONFLICT_REASON_LABELS[c.reason]}</span>
                          {' · '}
                          {matchLabels[c.matchAId] ?? c.matchAId} /{' '}
                          {matchLabels[c.matchBId] ?? c.matchBId}
                          {c.reason === 'overlap'
                            ? ` · solape de ${Math.abs(c.gapMin)} min`
                            : ` · hueco ${c.gapMin} min (viaje estimado ${c.travelMin} min)`}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="gap-2">
            <Send className="h-4 w-4" />
            {errorCount > 0
              ? `Publicar con ${errorCount} conflicto${errorCount !== 1 ? 's' : ''}`
              : 'Publicar y notificar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
