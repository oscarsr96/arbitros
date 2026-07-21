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
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseJornadaWorkbook } from '@/lib/xlsx-import'
import { nextSaturday } from '@/lib/mock-data-client'
import type { ParsedXlsxMatch, XlsxImportResult } from '@/lib/types'

interface XlsxImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (matches: ParsedXlsxMatch[]) => void
}

interface SheetGroup {
  sheet: string
  venues: {
    venueName: string
    courts: { courtLabel: string; matches: ParsedXlsxMatch[] }[]
  }[]
}

function groupMatches(matches: ParsedXlsxMatch[]): SheetGroup[] {
  const sheets = new Map<string, Map<string, Map<string, ParsedXlsxMatch[]>>>()
  for (const m of matches) {
    const courtLabel = m.courtName ?? 'Pista única'
    if (!sheets.has(m.sheet)) sheets.set(m.sheet, new Map())
    const venues = sheets.get(m.sheet)!
    if (!venues.has(m.venueName)) venues.set(m.venueName, new Map())
    const courts = venues.get(m.venueName)!
    if (!courts.has(courtLabel)) courts.set(courtLabel, [])
    courts.get(courtLabel)!.push(m)
  }
  return [...sheets.entries()].map(([sheet, venues]) => ({
    sheet,
    venues: [...venues.entries()].map(([venueName, courts]) => ({
      venueName,
      courts: [...courts.entries()].map(([courtLabel, ms]) => ({ courtLabel, matches: ms })),
    })),
  }))
}

export function XlsxImportDialog({ open, onOpenChange, onImport }: XlsxImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [saturdayDate, setSaturdayDate] = useState(nextSaturday)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<XlsxImportResult | null>(null)
  const [step, setStep] = useState<'input' | 'preview'>('input')

  const reset = () => {
    setFile(null)
    setSaturdayDate(nextSaturday)
    setParseError(null)
    setParsing(false)
    setResult(null)
    setStep('input')
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
    setParseError(null)
  }, [])

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setParseError(null)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const parsed = parseJornadaWorkbook(workbook, saturdayDate)
      if (parsed.matches.length === 0) {
        setParseError('No se encontró ningún partido en el fichero.')
        setParsing(false)
        return
      }
      setResult(parsed)
      setStep('preview')
    } catch (err) {
      setParseError(`Error al leer el fichero: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setParsing(false)
    }
  }

  const handleImport = () => {
    if (!result) return
    onImport(result.matches)
    onOpenChange(false)
    reset()
  }

  const groups = result ? groupMatches(result.matches) : []

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
          <DialogTitle>Importar jornada desde XLSX</DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sábado de la jornada
              </label>
              <Input
                type="date"
                value={saturdayDate}
                onChange={(e) => setSaturdayDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Fichero de la jornada (.xlsx)
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-6 text-sm text-gray-500 hover:border-gray-300">
                <Upload className="h-5 w-5" />
                <span>{file ? file.name : 'Seleccionar archivo .xlsx'}</span>
                <input type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            {parseError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === 'preview' && result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {result.matches.length} partido{result.matches.length !== 1 ? 's' : ''}
              </Badge>
              {result.warnings.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {result.warnings.length} advertencia{result.warnings.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="max-h-72 space-y-3 overflow-auto rounded-lg border p-3">
              {groups.map((sheetGroup) => (
                <div key={sheetGroup.sheet}>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    {sheetGroup.sheet}
                  </p>
                  {sheetGroup.venues.map((venueGroup) => (
                    <div key={venueGroup.venueName} className="ml-2 mt-1">
                      <p className="text-sm font-medium text-gray-800">{venueGroup.venueName}</p>
                      {venueGroup.courts.map((courtGroup) => (
                        <div key={courtGroup.courtLabel} className="ml-3 mt-1">
                          <p className="text-xs text-gray-500">
                            {courtGroup.courtLabel} · {courtGroup.matches.length} partido
                            {courtGroup.matches.length !== 1 ? 's' : ''}
                          </p>
                          <ul className="ml-2 text-xs text-gray-600">
                            {courtGroup.matches.map((m, i) => (
                              <li key={i}>
                                {m.date} {m.time} · {m.homeTeam} vs {m.awayTeam}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {result.warnings.length > 0 && (
              <div className="max-h-32 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                <ul className="space-y-1 text-xs text-amber-800">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'input' ? (
            <Button onClick={handleParse} disabled={!file || parsing}>
              {parsing ? 'Procesando...' : 'Validar XLSX'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('input')}>
                Volver
              </Button>
              <Button onClick={handleImport} disabled={!result || result.matches.length === 0}>
                Importar {result?.matches.length ?? 0} partido
                {(result?.matches.length ?? 0) !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
