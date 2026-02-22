export const metadata = { title: 'Dashboard — FBM Admin' }

const stats = [
  {
    label: 'Partidos esta jornada',
    value: '0',
    sub: 'Sin datos aún',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    label: 'Árbitros disponibles',
    value: '0',
    sub: 'Sin datos aún',
    color: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    label: 'Anotadores disponibles',
    value: '0',
    sub: 'Sin datos aún',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    label: 'Partidos sin cubrir',
    value: '0',
    sub: 'Sin datos aún',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    label: 'Coste estimado',
    value: '0,00 €',
    sub: 'Sin datos aún',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
  },
  {
    label: 'Designaciones confirmadas',
    value: '0 %',
    sub: 'Sin datos aún',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
  },
]

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Resumen del estado de la jornada actual.</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 rounded-xl border p-5 ${stat.color}`}
          >
            <span className="text-xs font-medium uppercase tracking-wide opacity-70">
              {stat.label}
            </span>
            <span className="text-3xl font-bold">{stat.value}</span>
            <span className="text-xs opacity-60">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Placeholder section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Alertas de la jornada</h2>
        <div className="flex items-center justify-center py-10 text-sm text-gray-400">
          No hay alertas pendientes. Carga los partidos de la jornada para comenzar.
        </div>
      </div>
    </div>
  )
}
