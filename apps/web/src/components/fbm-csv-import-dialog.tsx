'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

const IMPORT_URL = '/api/admin/matches/import-csv-fbm'

type FbmImportSummary = {
  dryRun: boolean
  filesProcessed: number
  matchesParsed: number
  matchesLoaded: number
  duplicatesSkipped: number
  skippedNoDate: number
  // Reparto de horarios. Los calendarios FBM emiten ~87% de los partidos con
  // HORA=00:00 y el importador les sintetiza una hora escalonada por pabellón
  // y día (ver lib/fbm-calendar/synthesize-schedule.ts).
  schedule: {
    realTimes: number
    synthesizedTimes: number
    venueDaysWithParallelTracks: number
    maxParallelTracks: number
    matchesOnParallelTracks: number
  }
  venuesCreated: number
  competitions: {
    id: string
    name: string
    refereesNeeded: number
    scorersNeeded: number
    needsConfirmation: boolean
  }[]
  unresolvedMunicipalities: string[]
  warnings: string[]
}

interface FbmCsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function FbmCsvImportDialog({ open, onOpenChange, onImported }: FbmCsvImportDialogProps) {
  const [files, setFiles] = useState<File[]>([])
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<FbmImportSummary | null>(null)

  const reset = () => {
    setFiles([])
    setStep('input')
    setLoading(false)
    setError(null)
    setSummary(null)
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files ? Array.from(e.target.files) : [])
    setError(null)
  }, [])

  const submit = async (dryRun: boolean): Promise<FbmImportSummary | null> => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    fd.append('dryRun', dryRun ? 'true' : 'false')
    const res = await fetch(IMPORT_URL, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || `Error ${res.status}`)
      return null
    }
    return data as FbmImportSummary
  }

  const handleValidate = async () => {
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const data = await submit(true)
      if (!data) return
      setSummary(data)
      setStep('preview')
    } catch (err) {
      setError(`Error de red: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await submit(false)
      if (!data) return
      const omitted = data.skippedNoDate
      toast.success(
        `${data.matchesLoaded} partido${data.matchesLoaded !== 1 ? 's' : ''} cargado${data.matchesLoaded !== 1 ? 's' : ''}` +
          (omitted > 0 ? ` (${omitted} omitido${omitted !== 1 ? 's' : ''})` : ''),
      )
      onImported()
      onOpenChange(false)
      reset()
    } catch (err) {
      setError(`Error de red: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar calendario FBM</DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Fichero(s) de calendario (.csv)
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-6 text-sm text-gray-500 hover:border-gray-300">
                <Upload className="h-5 w-5" />
                <span>
                  {files.length > 0
                    ? `${files.length} fichero${files.length !== 1 ? 's' : ''} seleccionado${files.length !== 1 ? 's' : ''}`
                    : 'Seleccionar ficheros .csv'}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {files.map((f, i) => (
                    <li key={i}>{f.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 'preview' && summary && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  summary.matchesLoaded > 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }
              >
                {summary.matchesLoaded > 0 ? (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                ) : (
                  <AlertTriangle className="mr-1 h-3 w-3" />
                )}
                {summary.matchesLoaded} partido{summary.matchesLoaded !== 1 ? 's' : ''}
              </Badge>
              <Badge className="bg-blue-100 text-blue-700">
                {summary.competitions.length} competición
                {summary.competitions.length !== 1 ? 'es' : ''}
              </Badge>
              <Badge className="bg-blue-100 text-blue-700">
                {summary.venuesCreated} pabellón{summary.venuesCreated !== 1 ? 'es' : ''}
              </Badge>
              {summary.duplicatesSkipped > 0 && (
                <Badge className="bg-blue-100 text-blue-700">
                  {summary.duplicatesSkipped} duplicado{summary.duplicatesSkipped !== 1 ? 's' : ''}
                </Badge>
              )}
              {summary.skippedNoDate > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {summary.skippedNoDate} sin fecha
                </Badge>
              )}
              {summary.schedule.realTimes > 0 && (
                <Badge className="bg-blue-100 text-blue-700">
                  {summary.schedule.realTimes} hora
                  {summary.schedule.realTimes !== 1 ? 's' : ''} real
                  {summary.schedule.realTimes !== 1 ? 'es' : ''}
                </Badge>
              )}
              {summary.schedule.synthesizedTimes > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {summary.schedule.synthesizedTimes} hora
                  {summary.schedule.synthesizedTimes !== 1 ? 's' : ''} estimada
                  {summary.schedule.synthesizedTimes !== 1 ? 's' : ''}
                </Badge>
              )}
              {summary.schedule.venueDaysWithParallelTracks > 0 && (
                <Badge className="bg-blue-100 text-blue-700">
                  {summary.schedule.venueDaysWithParallelTracks} pabellón-día en pista paralela
                </Badge>
              )}
              {summary.unresolvedMunicipalities.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {summary.unresolvedMunicipalities.length} municipio
                  {summary.unresolvedMunicipalities.length !== 1 ? 's' : ''} sin resolver
                </Badge>
              )}
              {summary.warnings.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {summary.warnings.length} advertencia{summary.warnings.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {summary.matchesLoaded === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  El fichero no produjo partidos cargables (¿codificación distinta de windows-1252,
                  o categorías no reconocidas?). No se cargará nada.
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-52 space-y-1 overflow-auto rounded-lg border p-3">
              {summary.competitions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0"
                >
                  <span className="text-sm text-gray-800">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {c.refereesNeeded} árb + {c.scorersNeeded} mesa
                    </span>
                    {c.needsConfirmation && (
                      <Badge className="bg-amber-100 text-amber-700">provisional</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {summary.unresolvedMunicipalities.length > 0 && (
              <div className="max-h-32 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase text-amber-800">
                  Municipios sin resolver
                </p>
                <ul className="space-y-1 text-xs text-amber-800">
                  {summary.unresolvedMunicipalities.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.warnings.length > 0 && (
              <div className="max-h-32 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                <ul className="space-y-1 text-xs text-amber-800">
                  {summary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {step === 'input' ? (
            <Button onClick={handleValidate} disabled={files.length === 0 || loading}>
              {loading ? 'Procesando...' : 'Validar'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('input')} disabled={loading}>
                Volver
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading || !summary || summary.matchesLoaded === 0}
              >
                {loading ? 'Cargando...' : 'Confirmar carga'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
