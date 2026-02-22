import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mi Perfil — FBM Designaciones',
}

export default function PerfilPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
      <p className="mt-2 text-gray-500">
        Consulta tus datos personales, categoria y estadisticas de la temporada actual. Puedes
        actualizar tu numero de telefono y direccion desde aqui.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
          Datos personales — pendiente de implementacion (Fase 1)
        </div>
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
          Historial de temporada — pendiente de implementacion (Fase 1)
        </div>
      </div>
    </div>
  )
}
