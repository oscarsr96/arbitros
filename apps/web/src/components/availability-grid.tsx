'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WeekSelector } from '@/components/week-selector'
import { toast } from 'sonner'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 08:00 a 22:00

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

// Clave del slot: "dayOfWeek-hour" (ej: "5-10" = sábado 10:00)
type SlotKey = string
function makeKey(day: number, hour: number): SlotKey {
  return `${day}-${hour}`
}

interface AvailabilitySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface AvailabilityGridProps {
  personId: string
  initialSlots?: AvailabilitySlot[]
}

export function AvailabilityGrid({ personId, initialSlots = [] }: AvailabilityGridProps) {
  const nextMonday = getMonday(new Date())
  nextMonday.setDate(nextMonday.getDate() + 7)
  const [weekStart, setWeekStart] = useState(toDateString(nextMonday))
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add')

  const [selected, setSelected] = useState<Set<SlotKey>>(() => {
    const set = new Set<SlotKey>()
    for (const slot of initialSlots) {
      const hour = parseInt(slot.startTime.split(':')[0], 10)
      set.add(makeKey(slot.dayOfWeek, hour))
    }
    return set
  })

  const toggleSlot = useCallback((day: number, hour: number) => {
    const key = makeKey(day, hour)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const handleMouseDown = useCallback(
    (day: number, hour: number) => {
      const key = makeKey(day, hour)
      setIsDragging(true)
      setDragMode(selected.has(key) ? 'remove' : 'add')
      toggleSlot(day, hour)
    },
    [selected, toggleSlot],
  )

  const handleMouseEnter = useCallback(
    (day: number, hour: number) => {
      if (!isDragging) return
      const key = makeKey(day, hour)
      setSelected((prev) => {
        const next = new Set(prev)
        if (dragMode === 'add') {
          next.add(key)
        } else {
          next.delete(key)
        }
        return next
      })
    },
    [isDragging, dragMode],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const slots: AvailabilitySlot[] = []
    for (const key of selected) {
      const [dayStr, hourStr] = key.split('-')
      const day = parseInt(dayStr, 10)
      const hour = parseInt(hourStr, 10)
      slots.push({
        dayOfWeek: day,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
      })
    }

    try {
      const res = await fetch('/api/availabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, weekStart, slots }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success('Disponibilidad guardada correctamente')
    } catch {
      toast.error('Error al guardar la disponibilidad')
    } finally {
      setSaving(false)
    }
  }

  const handleWeekChange = async (newWeekStart: string) => {
    setWeekStart(newWeekStart)
    // Cargar disponibilidad de la nueva semana
    try {
      const res = await fetch(`/api/availabilities?personId=${personId}&weekStart=${newWeekStart}`)
      const data = await res.json()
      const newSet = new Set<SlotKey>()
      for (const slot of data.availabilities ?? []) {
        const hour = parseInt(slot.startTime.split(':')[0], 10)
        newSet.add(makeKey(slot.dayOfWeek, hour))
      }
      setSelected(newSet)
    } catch {
      setSelected(new Set())
    }
  }

  const selectedCount = selected.size

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">Cuadrícula semanal</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Haz clic o arrastra para marcar las franjas disponibles
          </p>
        </div>
        <WeekSelector weekStart={weekStart} onChange={handleWeekChange} />
      </CardHeader>
      <CardContent>
        <div
          className="select-none overflow-x-auto"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="min-w-[600px]">
            {/* Header con días */}
            <div className="mb-0.5 grid grid-cols-[60px_repeat(7,1fr)] gap-0.5">
              <div /> {/* Celda vacía esquina */}
              {DAYS.map((day, i) => (
                <div
                  key={i}
                  className="text-muted-foreground py-1.5 text-center text-xs font-semibold"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grid con horas */}
            {HOURS.map((hour) => (
              <div key={hour} className="mb-0.5 grid grid-cols-[60px_repeat(7,1fr)] gap-0.5">
                <div className="text-muted-foreground flex items-center justify-end pr-2 text-xs">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {DAYS.map((_, dayIndex) => {
                  const key = makeKey(dayIndex, hour)
                  const isSelected = selected.has(key)
                  return (
                    <button
                      key={key}
                      className={`h-7 rounded-sm border transition-colors ${
                        isSelected
                          ? 'border-green-400 bg-green-100 hover:bg-green-200'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                      onMouseDown={() => handleMouseDown(dayIndex, hour)}
                      onMouseEnter={() => handleMouseEnter(dayIndex, hour)}
                      aria-label={`${DAYS[dayIndex]} ${hour}:00 - ${isSelected ? 'disponible' : 'no disponible'}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer con resumen y botón guardar */}
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border border-green-400 bg-green-100" />
              Disponible ({selectedCount}h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border border-gray-200 bg-gray-50" />
              No disponible
            </span>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar disponibilidad'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
