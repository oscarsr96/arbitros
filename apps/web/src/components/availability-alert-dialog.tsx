'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WeekSelector } from '@/components/week-selector'
import { ArrowLeft, ArrowRight, Mail, Users, Loader2 } from 'lucide-react'

interface Recipient {
  id: string
  name: string
  email: string
  role: string
  category: string
}

interface AvailabilityAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}

const ROLES = [
  { value: 'arbitro', label: 'Árbitros' },
  { value: 'anotador', label: 'Anotadores' },
]

const CATEGORIES = [
  { value: 'provincial', label: 'Provincial' },
  { value: 'autonomico', label: 'Autonómico' },
  { value: 'nacional', label: 'Nacional' },
  { value: 'feb', label: 'FEB' },
]

function getDefaultWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export function AvailabilityAlertDialog({
  open,
  onOpenChange,
  onSent,
}: AvailabilityAlertDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [weekStart, setWeekStart] = useState(getDefaultWeekStart)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [count, setCount] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true)
    const params = new URLSearchParams()
    if (selectedRoles.length > 0) params.set('roles', selectedRoles.join(','))
    if (selectedCategories.length > 0) params.set('categories', selectedCategories.join(','))
    try {
      const res = await fetch(`/api/admin/alerts/preview?${params}`)
      const data = await res.json()
      setCount(data.count)
      setRecipients(data.recipients)
    } finally {
      setLoadingPreview(false)
    }
  }, [selectedRoles, selectedCategories])

  useEffect(() => {
    if (open) fetchPreview()
  }, [open, fetchPreview])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setSelectedRoles([])
      setSelectedCategories([])
      setMessage('')
    }
  }, [open])

  const toggleRole = (role: string) =>
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart,
          roles: selectedRoles,
          categories: selectedCategories,
          message,
        }),
      })
      if (res.ok) {
        onOpenChange(false)
        onSent()
      }
    } finally {
      setSending(false)
    }
  }

  const roleLabel = (role: string) => (role === 'arbitro' ? 'Árbitro' : 'Anotador')
  const categoryLabel = (cat: string) => CATEGORIES.find((c) => c.value === cat)?.label ?? cat

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Enviar alerta de disponibilidad' : 'Confirmar envío'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Selecciona la semana y el perfil de destinatarios.'
              : 'Revisa los datos antes de enviar la alerta.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-5">
            {/* Week selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Semana</label>
              <WeekSelector weekStart={weekStart} onChange={setWeekStart} />
            </div>

            {/* Role filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Rol</label>
              <div className="flex gap-2">
                {ROLES.map((r) => (
                  <Button
                    key={r.value}
                    variant={selectedRoles.includes(r.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleRole(r.value)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
              {selectedRoles.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">Sin filtro = todos los roles</p>
              )}
            </div>

            {/* Category filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Categoría</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Button
                    key={c.value}
                    variant={selectedCategories.includes(c.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleCategory(c.value)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
              {selectedCategories.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">Sin filtro = todas las categorías</p>
              )}
            </div>

            {/* Recipient count */}
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">
                  {loadingPreview ? '...' : count} destinatario{count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Optional message */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Mensaje adicional (opcional)
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ej: Necesitamos más disponibilidad para el sábado por la tarde..."
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="space-y-3 rounded-lg bg-gray-50 p-4">
              <div>
                <p className="text-xs text-gray-500">Semana</p>
                <p className="text-sm font-medium">{weekStart}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Filtros</p>
                <div className="flex flex-wrap gap-1">
                  {selectedRoles.length === 0 && selectedCategories.length === 0 && (
                    <Badge variant="secondary">Todos</Badge>
                  )}
                  {selectedRoles.map((r) => (
                    <Badge key={r} variant="secondary">
                      {roleLabel(r)}
                    </Badge>
                  ))}
                  {selectedCategories.map((c) => (
                    <Badge key={c} variant="outline">
                      {categoryLabel(c)}
                    </Badge>
                  ))}
                </div>
              </div>
              {message && (
                <div>
                  <p className="text-xs text-gray-500">Mensaje</p>
                  <p className="text-sm italic text-gray-700">&ldquo;{message}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Recipients */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                Destinatarios ({recipients.length})
              </p>
              <ScrollArea className="h-48 rounded-lg border">
                <div className="divide-y">
                  {recipients.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.email}</p>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {roleLabel(r.role)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {categoryLabel(r.category)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)} className="mr-auto gap-1">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          )}
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep(2)} disabled={count === 0} className="gap-1">
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {sending ? 'Enviando...' : `Enviar alerta (${recipients.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
