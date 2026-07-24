import { Suspense } from 'react'
import { ReportesView } from './reportes-view'

export const metadata = { title: 'Reportes — FBM Admin' }

export default function ReportesPage() {
  // Suspense requerido por Next.js 14: ReportesView lee el ámbito (jornada /
  // mes / temporada) de la URL con `useSearchParams` para que el selector sea
  // deep-linkable (4.2.2).
  return (
    <Suspense fallback={null}>
      <ReportesView />
    </Suspense>
  )
}
