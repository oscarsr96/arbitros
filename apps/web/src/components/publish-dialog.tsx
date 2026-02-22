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
}

export function PublishDialog({ open, onOpenChange, onConfirm, stats }: PublishDialogProps) {
  const hasUncovered = stats.coveredMatches < stats.totalMatches

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="gap-2">
            <Send className="h-4 w-4" />
            Publicar y notificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
