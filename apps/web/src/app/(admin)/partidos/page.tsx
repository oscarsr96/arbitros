export const metadata = { title: 'Partidos — FBM Admin' }

export default function PartidosPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidos</h1>
          <p className="mt-1 text-sm text-gray-500">Gestión de partidos de la jornada activa.</p>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white opacity-50"
        >
          Importar CSV
        </button>
      </div>

      {/* Filters placeholder */}
      <div className="mb-4 flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-9 w-32 animate-pulse rounded-md bg-gray-100" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-gray-100" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-gray-100" />
      </div>

      {/* Table placeholder */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Fecha / Hora</th>
              <th className="px-4 py-3 font-medium text-gray-600">Partido</th>
              <th className="px-4 py-3 font-medium text-gray-600">Pabellón</th>
              <th className="px-4 py-3 font-medium text-gray-600">Categoría</th>
              <th className="px-4 py-3 font-medium text-gray-600">Árbitros</th>
              <th className="px-4 py-3 font-medium text-gray-600">Anotadores</th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                No hay partidos cargados. Importa un CSV con los partidos de la jornada.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
