'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { User, Phone, MapPin, Mail, Shield, Trophy, Banknote } from 'lucide-react'

const categoryLabels: Record<string, string> = {
  provincial: 'Provincial',
  autonomico: 'Autonómico',
  nacional: 'Nacional',
  feb: 'FEB',
}

interface PersonData {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  category: string | null
  address: string | null
  postalCode: string | null
  municipalityName: string | null
  bankIban: string | null
}

interface Stats {
  totalMatches: number
  confirmedMatches: number
  totalEarned: string
}

export function ProfileView() {
  const [person, setPerson] = useState<PersonData | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/persons/me')
      .then((res) => res.json())
      .then((data) => {
        setPerson(data.person)
        setStats(data.stats)
        setPhone(data.person?.phone ?? '')
        setAddress(data.person?.address ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/persons/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, address }),
      })
      if (!res.ok) throw new Error('Error')
      const data = await res.json()
      setPerson(data.person)
      setEditing(false)
      toast.success('Perfil actualizado correctamente')
    } catch {
      toast.error('Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    )
  }

  if (!person) {
    return <p className="text-muted-foreground">No se pudo cargar el perfil</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Datos personales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-lg font-semibold">{person.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {person.role === 'arbitro' ? 'Árbitro' : 'Anotador'}
              </Badge>
              {person.category && (
                <Badge variant="secondary">
                  {categoryLabels[person.category] ?? person.category}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              {person.email}
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              {person.municipalityName ?? 'Sin municipio'}
            </div>
          </div>

          <Separator />

          {editing ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="612345678"
                />
              </div>
              <div>
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="C/ Ejemplo 1, 28001 Madrid"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                {person.phone || 'Sin teléfono'}
              </div>
              <div className="text-muted-foreground flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5" />
                {person.address || 'Sin dirección'}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="mt-2">
                Editar teléfono y dirección
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas de temporada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Temporada 2024-25
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-3xl font-bold">{stats?.totalMatches ?? 0}</p>
              <p className="text-muted-foreground mt-1 text-xs">Partidos asignados</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats?.confirmedMatches ?? 0}</p>
              <p className="text-muted-foreground mt-1 text-xs">Confirmados</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                <Banknote className="h-3.5 w-3.5" />
                Total desplazamiento
              </span>
              <span className="font-semibold">{stats?.totalEarned ?? '0.00'} €</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                <Shield className="h-3.5 w-3.5" />
                Categoría
              </span>
              <span className="font-semibold">
                {person.category ? (categoryLabels[person.category] ?? person.category) : '—'}
              </span>
            </div>
          </div>

          {person.bankIban && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">IBAN</p>
                <p className="mt-0.5 font-mono text-xs">
                  {person.bankIban.replace(/(.{4})/g, '$1 ').trim()}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
