import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Disponibilidad — FBM Designaciones',
}

export default function DisponibilidadPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Disponibilidad</h1>
      <p className="mt-2 text-gray-500">
        Indica las franjas horarias en las que estas disponible para la proxima jornada. Marca los
        bloques de la cuadricula semanal y guarda antes de la fecha limite.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
        Cuadricula semanal interactiva — pendiente de implementacion (Fase 1)
      </div>
    </div>
  )
}
