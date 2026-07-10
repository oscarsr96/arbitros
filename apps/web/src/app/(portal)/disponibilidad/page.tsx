import type { Metadata } from 'next'
import { MatchdayAvailabilityForm } from '@/components/matchday-availability-form'
import { DEMO_PERSON_ID, getMockPerson } from '@/lib/mock-data'

export const metadata: Metadata = {
  title: 'Disponibilidad — FBM Designaciones',
}

export default function DisponibilidadPage() {
  // En producción con Supabase, el personId vendría del JWT
  const personId = DEMO_PERSON_ID
  const person = getMockPerson(personId)

  return (
    <div>
      <h1 className="text-fbm-navy text-2xl font-bold">Disponibilidad</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Indica tu disponibilidad para cada jornada: sábado, domingo y días entre semana. Guarda
        antes de la fecha límite de tu categoría.
      </p>

      <div className="mt-6">
        <MatchdayAvailabilityForm personId={personId} category={person?.category ?? null} />
      </div>
    </div>
  )
}
