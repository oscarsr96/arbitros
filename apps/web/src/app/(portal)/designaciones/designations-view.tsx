'use client'

import { useState, useEffect } from 'react'
import { DesignationCard } from '@/components/designation-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { DEMO_PERSON_ID } from '@/lib/mock-data'

interface Designation {
  id: string
  role: string
  travelCost: string
  distanceKm: string
  status: string
  match?: {
    id: string
    date: string
    time: string
    homeTeam: string
    awayTeam: string
  }
  venue?: {
    name: string
    address: string
  }
  competition?: {
    name: string
  }
}

export function DesignationsView() {
  const [designations, setDesignations] = useState<Designation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/designations?personId=${DEMO_PERSON_ID}`)
      .then((res) => res.json())
      .then((data) => setDesignations(data.designations ?? []))
      .catch(() => setDesignations([]))
      .finally(() => setLoading(false))
  }, [])

  const pending = designations.filter((d) => d.status === 'pending' || d.status === 'notified')
  const completed = designations.filter((d) => d.status === 'completed')

  const totalCost = designations.reduce((sum, d) => sum + parseFloat(d.travelCost), 0)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{designations.length}</p>
            <p className="text-muted-foreground text-xs">Total partidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completed.length}</p>
            <p className="text-muted-foreground text-xs">Completados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalCost.toFixed(2)} €</p>
            <p className="text-muted-foreground text-xs">Coste desplazamiento</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de filtro */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas ({designations.length})</TabsTrigger>
          <TabsTrigger value="pending">Pendientes ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completadas ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {designations.map((d) => (
            <DesignationCard key={d.id} designation={d} />
          ))}
          {designations.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No tienes designaciones para esta jornada
            </p>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.map((d) => (
            <DesignationCard key={d.id} designation={d} />
          ))}
          {pending.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No hay designaciones pendientes
            </p>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {completed.map((d) => (
            <DesignationCard key={d.id} designation={d} />
          ))}
          {completed.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No hay designaciones completadas
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
