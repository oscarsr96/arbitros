'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { nextSaturday, formatLocalDate } from '@/lib/mock-data'
import type { MatchdayAvailability } from '@/lib/mock-data'
import { getAvailabilityDeadline } from '@/lib/availability-deadline'

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const CATEGORY_LABELS: Record<string, string> = {
  provincial: 'Provincial',
  autonomico: 'Autonómico',
  nacional: 'Nacional',
  feb: 'FEB',
  escuela: 'Escuela',
}

interface FormState {
  saturdayMorning: boolean
  saturdayAfternoon: boolean
  sundayMorning: boolean
  sundayAfternoon: boolean
  weekdayDays: number[]
  notes: string
}

const EMPTY_STATE: FormState = {
  saturdayMorning: false,
  saturdayAfternoon: false,
  sundayMorning: false,
  sundayAfternoon: false,
  weekdayDays: [],
  notes: '',
}

function getUpcomingSaturdays(count: number): string[] {
  const base = new Date(nextSaturday + 'T00:00:00')
  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i * 7)
    dates.push(formatLocalDate(d))
  }
  return dates
}

function formatSaturdayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface ToggleRowProps {
  label: string
  hours: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}

function ToggleRow({ label, hours, checked, disabled, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{hours}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-medium ${checked ? 'text-green-600' : 'text-muted-foreground'}`}
        >
          {checked ? 'Alta' : 'Baja'}
        </span>
        <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

interface MatchdayAvailabilityFormProps {
  personId: string
  category: string | null
}

export function MatchdayAvailabilityForm({ personId, category }: MatchdayAvailabilityFormProps) {
  const saturdays = useMemo(() => getUpcomingSaturdays(8), [])
  const [saturdayDate, setSaturdayDate] = useState(saturdays[0])
  const [form, setForm] = useState<FormState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const deadline = getAvailabilityDeadline(category, saturdayDate)
  const isLocked = new Date() > deadline
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : null

  const loadAvailability = useCallback(
    async (date: string) => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/availabilities/matchday?personId=${personId}&saturdayDate=${date}`,
        )
        const data: { matchdayAvailability: MatchdayAvailability | null } = await res.json()
        const record = data.matchdayAvailability
        setForm(
          record
            ? {
                saturdayMorning: record.saturdayMorning,
                saturdayAfternoon: record.saturdayAfternoon,
                sundayMorning: record.sundayMorning,
                sundayAfternoon: record.sundayAfternoon,
                weekdayDays: record.weekdayDays,
                notes: record.notes ?? '',
              }
            : EMPTY_STATE,
        )
      } catch {
        setForm(EMPTY_STATE)
      } finally {
        setLoading(false)
      }
    },
    [personId],
  )

  useEffect(() => {
    loadAvailability(saturdayDate)
  }, [saturdayDate, loadAvailability])

  const toggleWeekday = (day: number) => {
    setForm((prev) => ({
      ...prev,
      weekdayDays: prev.weekdayDays.includes(day)
        ? prev.weekdayDays.filter((d) => d !== day)
        : [...prev.weekdayDays, day].sort(),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/availabilities/matchday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, saturdayDate, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al guardar la disponibilidad')
        return
      }
      toast.success('Disponibilidad guardada correctamente')
    } catch {
      toast.error('Error al guardar la disponibilidad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Disponibilidad de la jornada</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Indica en qué franjas puedes arbitrar/anotar esta jornada
            </p>
          </div>
          <Select value={saturdayDate} onValueChange={setSaturdayDate}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {saturdays.map((date) => (
                <SelectItem key={date} value={date}>
                  {formatSaturdayLabel(date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLocked ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Plazo finalizado</AlertTitle>
            <AlertDescription>
              El plazo para declarar disponibilidad de esta jornada finalizó el{' '}
              {deadline.toLocaleDateString('es-ES')}
              {categoryLabel ? ` (categoría ${categoryLabel})` : ''}. Ya no puedes editar estos
              datos; contacta con el designador si necesitas hacer un cambio.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CalendarClock className="h-4 w-4" />
            <AlertTitle>Fecha límite</AlertTitle>
            <AlertDescription>
              Puedes editar tu disponibilidad hasta el {deadline.toLocaleDateString('es-ES')}
              {categoryLabel ? ` (categoría ${categoryLabel})` : ''}.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        ) : (
          <>
            {/* Fin de semana */}
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                label="Sábado mañana"
                hours="09:00–15:30"
                checked={form.saturdayMorning}
                disabled={isLocked}
                onCheckedChange={(v) => setForm((p) => ({ ...p, saturdayMorning: v }))}
              />
              <ToggleRow
                label="Sábado tarde"
                hours="15:30–22:00"
                checked={form.saturdayAfternoon}
                disabled={isLocked}
                onCheckedChange={(v) => setForm((p) => ({ ...p, saturdayAfternoon: v }))}
              />
              <ToggleRow
                label="Domingo mañana"
                hours="09:00–15:30"
                checked={form.sundayMorning}
                disabled={isLocked}
                onCheckedChange={(v) => setForm((p) => ({ ...p, sundayMorning: v }))}
              />
              <ToggleRow
                label="Domingo tarde"
                hours="15:30–22:00"
                checked={form.sundayAfternoon}
                disabled={isLocked}
                onCheckedChange={(v) => setForm((p) => ({ ...p, sundayAfternoon: v }))}
              />
            </div>

            {/* Entre semana */}
            <div>
              <Label className="mb-2 block">Entre semana (17:30–22:00)</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={form.weekdayDays.includes(day) ? 'default' : 'outline'}
                    size="sm"
                    disabled={isLocked}
                    onClick={() => toggleWeekday(day)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <Label htmlFor="notes" className="mb-2 block">
                Observaciones
              </Label>
              <Textarea
                id="notes"
                value={form.notes}
                disabled={isLocked}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ej: solo disponible hasta las 20:00 el sábado..."
                rows={3}
              />
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button onClick={handleSave} disabled={saving || isLocked}>
                {saving ? 'Guardando...' : 'Guardar disponibilidad'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
