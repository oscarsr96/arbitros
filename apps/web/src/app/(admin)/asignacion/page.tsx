export const metadata = { title: 'Asignación — FBM Admin' }

export default function AsignacionPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asignación</h1>
          <p className="mt-1 text-sm text-gray-500">
            Asignación automática y manual de árbitros y anotadores a partidos.
          </p>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white opacity-50"
        >
          Asignación automática
        </button>
      </div>

      {/* Optimization config panel */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Parámetros del optimizador</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Peso coste de desplazamiento (α)
            </label>
            <div className="h-9 animate-pulse rounded-md bg-gray-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Peso equilibrio de carga (β)
            </label>
            <div className="h-9 animate-pulse rounded-md bg-gray-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Máx. partidos por persona y jornada
            </label>
            <div className="h-9 animate-pulse rounded-md bg-gray-100" />
          </div>
        </div>
      </div>

      {/* Two-column layout: matches left, staff right */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Matches column */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Partidos de la jornada</h2>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            Los partidos aparecerán aquí cuando estén cargados.
          </p>
        </div>

        {/* Staff column */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Personal disponible</h2>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            El personal disponible aparecerá aquí cuando haya disponibilidad registrada.
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
        El microservicio de optimización (OR-Tools) aún no está configurado. Las asignaciones
        manuales estarán disponibles en la siguiente fase de desarrollo.
      </div>
    </div>
  )
}
