export const metadata = { title: 'Personal — FBM Admin' }

const tabs = ['Todos', 'Árbitros', 'Anotadores']

export default function PersonalPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal</h1>
          <p className="mt-1 text-sm text-gray-500">
            Árbitros y anotadores registrados en el sistema.
          </p>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white opacity-50"
        >
          Añadir persona
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            disabled
            className={`cursor-not-allowed rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              i === 0 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search bar placeholder */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-9 w-64 animate-pulse rounded-md bg-gray-100" />
      </div>

      {/* Cards placeholder grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-gray-400">
        El listado de personal aparecerá aquí una vez conectada la base de datos.
      </p>
    </div>
  )
}
