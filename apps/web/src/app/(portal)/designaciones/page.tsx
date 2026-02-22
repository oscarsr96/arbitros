import type { Metadata } from 'next'
import { DesignationsView } from './designations-view'

export const metadata: Metadata = {
  title: 'Mis Designaciones — FBM Designaciones',
}

export default function DesignacionesPage() {
  return (
    <div>
      <h1 className="text-fbm-navy text-2xl font-bold">Mis Designaciones</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Consulta los partidos que tienes asignados, su estado y el coste de desplazamiento estimado.
        Confirma o rechaza cada designación desde esta pantalla.
      </p>

      <div className="mt-6">
        <DesignationsView />
      </div>
    </div>
  )
}
