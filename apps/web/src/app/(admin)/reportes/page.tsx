export const metadata = { title: 'Reportes — FBM Admin' }

const reportCards = [
  {
    title: 'Coste por jornada',
    description: 'Desglose del coste de desplazamiento por jornada y temporada.',
    icon: '💶',
    badge: 'Próximamente',
  },
  {
    title: 'Carga por árbitro',
    description: 'Número de partidos asignados a cada árbitro en el período seleccionado.',
    icon: '📊',
    badge: 'Próximamente',
  },
  {
    title: 'Liquidación mensual',
    description: 'Exportación a Excel/PDF del detalle de pagos por persona.',
    icon: '📄',
    badge: 'Próximamente',
  },
  {
    title: 'Cobertura de partidos',
    description: 'Porcentaje de partidos cubiertos vs. sin cubrir por jornada.',
    icon: '✅',
    badge: 'Próximamente',
  },
  {
    title: 'Historial por persona',
    description: 'Todos los partidos pitados y total cobrado en la temporada.',
    icon: '👤',
    badge: 'Próximamente',
  },
  {
    title: 'Mapa de calor por municipio',
    description: 'Visualización geográfica del coste de desplazamiento acumulado.',
    icon: '🗺️',
    badge: 'Próximamente',
  },
]

export default function ReportesPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Informes financieros y de gestión de la temporada.
          </p>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white opacity-50"
        >
          Exportar temporada
        </button>
      </div>

      {/* Period selector placeholder */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <span className="text-sm font-medium text-gray-600">Período:</span>
        <div className="h-9 w-36 animate-pulse rounded-md bg-gray-100" />
        <div className="h-9 w-36 animate-pulse rounded-md bg-gray-100" />
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((card) => (
          <div
            key={card.title}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <span className="text-2xl">{card.icon}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {card.badge}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{card.description}</p>
            </div>
            <button
              disabled
              className="mt-auto w-full cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400"
            >
              Ver reporte
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
