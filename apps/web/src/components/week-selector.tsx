'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('es-ES', opts)} — ${sunday.toLocaleDateString('es-ES', opts)}`
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface WeekSelectorProps {
  weekStart: string
  onChange: (weekStart: string) => void
}

export function WeekSelector({ weekStart, onChange }: WeekSelectorProps) {
  const current = new Date(weekStart + 'T00:00:00')
  const today = getMonday(new Date())
  const maxWeek = new Date(today)
  maxWeek.setDate(maxWeek.getDate() + 14) // 2 semanas futuras

  const canGoPrev = current > today
  const canGoNext = current < maxWeek

  const goToPrev = () => {
    const prev = new Date(current)
    prev.setDate(prev.getDate() - 7)
    if (prev >= today) onChange(toDateString(prev))
  }

  const goToNext = () => {
    const next = new Date(current)
    next.setDate(next.getDate() + 7)
    if (next <= maxWeek) onChange(toDateString(next))
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={goToPrev}
        disabled={!canGoPrev}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[200px] text-center text-sm font-medium">
        {formatWeekRange(current)}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={goToNext}
        disabled={!canGoNext}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
