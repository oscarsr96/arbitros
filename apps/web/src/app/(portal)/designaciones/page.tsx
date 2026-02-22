import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mis Designaciones — FBM Designaciones',
}

export default function DesignacionesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mis Designaciones</h1>
      <p className="mt-2 text-gray-500">
        Consulta los partidos que tienes asignados, su estado y el coste de desplazamiento estimado.
        Confirma o rechaza cada designacion desde esta pantalla.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
        Lista de designaciones con acciones de confirmacion — pendiente de implementacion (Fase 1)
      </div>
    </div>
  )
}
