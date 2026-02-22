import type { Metadata } from 'next'
import { AvailabilityGrid } from '@/components/availability-grid'
import { DEMO_PERSON_ID, mockAvailabilities } from '@/lib/mock-data'

export const metadata: Metadata = {
  title: 'Disponibilidad — FBM Designaciones',
}

export default function DisponibilidadPage() {
  // En producción con Supabase, el personId vendría del JWT
  const personId = DEMO_PERSON_ID

  // Cargar disponibilidad inicial de la semana próxima
  const nextMonday = new Date()
  const day = nextMonday.getDay()
  const diff = nextMonday.getDate() - day + (day === 0 ? -6 : 1) + 7
  nextMonday.setDate(diff)
  const weekStart = nextMonday.toISOString().split('T')[0]

  const initialSlots = mockAvailabilities.filter(
    (a) => a.personId === personId && a.weekStart === weekStart,
  )

  return (
    <div>
      <h1 className="text-fbm-navy text-2xl font-bold">Disponibilidad</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Indica las franjas horarias en las que estás disponible para la próxima jornada. Marca los
        bloques de la cuadrícula semanal y guarda antes de la fecha límite.
      </p>

      <div className="mt-6">
        <AvailabilityGrid personId={personId} initialSlots={initialSlots} />
      </div>
    </div>
  )
}
