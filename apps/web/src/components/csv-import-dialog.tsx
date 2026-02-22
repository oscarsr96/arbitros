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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Papa from 'papaparse'
import type { CSVMatchRow } from '@/lib/types'

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (rows: CSVMatchRow[]) => void
}

interface ParsedRow extends CSVMatchRow {
  _valid: boolean
  _errors: string[]
}

export function CSVImportDialog({ open, onOpenChange, onImport }: CSVImportDialogProps) {
  const [csvText, setCsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'preview'>('input')

  const reset = () => {
    setCsvText('')
    setParsedRows([])
    setParseError(null)
    setStep('input')
  }

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setCsvText(event.target?.result as string)
    }
    reader.readAsText(file)
  }, [])

  const handleParse = () => {
    setParseError(null)
    const result = Papa.parse<Record<string, string>>(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    })

    if (result.errors.length > 0) {
      setParseError(`Error de parseo: ${result.errors[0].message}`)
      return
    }

    const requiredCols = [
      'fecha',
      'hora',
      'pabellon',
      'equipo_local',
      'equipo_visitante',
      'competicion',
      'jornada',
    ]
    const headers = Object.keys(result.data[0] || {})
    const missing = requiredCols.filter((c) => !headers.includes(c))

    if (missing.length > 0) {
      setParseError(`Columnas faltantes: ${missing.join(', ')}`)
      return
    }

    const rows: ParsedRow[] = result.data.map((row) => {
      const errors: string[] = []
      if (!row.fecha?.match(/^\d{4}-\d{2}-\d{2}$/)) errors.push('Fecha inválida (YYYY-MM-DD)')
      if (!row.hora?.match(/^\d{2}:\d{2}$/)) errors.push('Hora inválida (HH:MM)')
      if (!row.pabellon?.trim()) errors.push('Pabellón vacío')
      if (!row.equipo_local?.trim()) errors.push('Equipo local vacío')
      if (!row.equipo_visitante?.trim()) errors.push('Equipo visitante vacío')

      return {
        fecha: row.fecha?.trim() || '',
        hora: row.hora?.trim() || '',
        pabellon: row.pabellon?.trim() || '',
        equipo_local: row.equipo_local?.trim() || '',
        equipo_visitante: row.equipo_visitante?.trim() || '',
        competicion: row.competicion?.trim() || '',
        jornada: row.jornada?.trim() || '',
        _valid: errors.length === 0,
        _errors: errors,
      }
    })

    setParsedRows(rows)
    setStep('preview')
  }

  const validRows = parsedRows.filter((r) => r._valid)
  const invalidRows = parsedRows.filter((r) => !r._valid)

  const handleImport = () => {
    onImport(validRows)
    onOpenChange(false)
    reset()
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
          <DialogTitle>Importar partidos desde CSV</DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Subir archivo CSV
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-6 text-sm text-gray-500 hover:border-gray-300">
                <Upload className="h-5 w-5" />
                <span>Seleccionar archivo .csv</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                O pegar contenido CSV
              </label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="fecha,hora,pabellon,equipo_local,equipo_visitante,competicion,jornada&#10;2025-03-15,10:00,Polideportivo Vallecas,CB Vallecas,CB Alcorcón,Liga Preferente,16"
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            {parseError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {validRows.length} válidos
              </Badge>
              {invalidRows.length > 0 && (
                <Badge className="bg-red-100 text-red-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {invalidRows.length} con errores
                </Badge>
              )}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Hora</th>
                    <th className="px-3 py-2">Partido</th>
                    <th className="px-3 py-2">Pabellón</th>
                    <th className="px-3 py-2">Comp.</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => (
                    <tr key={i} className={`border-b ${row._valid ? '' : 'bg-red-50'}`}>
                      <td className="px-3 py-2">{row.fecha}</td>
                      <td className="px-3 py-2">{row.hora}</td>
                      <td className="px-3 py-2">
                        {row.equipo_local} vs {row.equipo_visitante}
                      </td>
                      <td className="px-3 py-2">{row.pabellon}</td>
                      <td className="px-3 py-2">{row.competicion}</td>
                      <td className="px-3 py-2">
                        {row._valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-red-500">{row._errors.join(', ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' ? (
            <Button onClick={handleParse} disabled={!csvText.trim()}>
              Validar CSV
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('input')}>
                Volver
              </Button>
              <Button onClick={handleImport} disabled={validRows.length === 0}>
                Importar {validRows.length} partido{validRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
