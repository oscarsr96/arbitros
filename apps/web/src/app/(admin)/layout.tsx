import { AdminSidebar } from '@/components/admin-sidebar'
import { Toaster } from '@/components/ui/sonner'
import { mockMatches } from '@/lib/mock-data'
import { formatLocalDate } from '@/lib/mock-data-client'
import { resolveDefaultJornada } from '@/lib/match-query'

// "2025/26" a partir de una fecha ISO. Temporada española: arranca en
// septiembre, así que un mes < 9 (ene-ago) pertenece a la temporada iniciada
// el año anterior.
function seasonLabel(dateISO: string): string {
  const year = Number(dateISO.slice(0, 4))
  const month = Number(dateISO.slice(5, 7))
  const startYear = month >= 9 ? year : year - 1
  return `${startYear}/${String(startYear + 1).slice(2)}`
}

// Server Component: mock-data.ts (server-only) y `new Date()` son seguros
// aquí, igual que en un route handler (sin hidratación de cliente de por
// medio). Antes esta cabecera estaba fija en "Temporada 2024/25 · Jornada 15"
// y además desactualizada (el calendario real es de la 2025/26).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const todayISO = formatLocalDate(new Date())
  const jornada = resolveDefaultJornada(mockMatches, todayISO)
  // Matchday del primer partido de la ventana: aproximación suficiente para un
  // rótulo informativo (no alimenta ninguna lógica de negocio).
  const matchday = jornada
    ? mockMatches.find((m) => m.date >= jornada.from && m.date <= jornada.to)?.matchday
    : undefined
  const headerLabel = jornada
    ? `Temporada ${seasonLabel(jornada.saturday)}${matchday ? ` · Jornada ${matchday}` : ''}`
    : 'Sin calendario cargado'

  return (
    <div className="bg-background flex min-h-screen">
      <AdminSidebar />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="border-border bg-card flex h-14 items-center border-b px-6 shadow-sm">
          <div className="flex-1 lg:hidden" /> {/* Space for mobile hamburger */}
          <div className="hidden flex-1 lg:block" />
          <span className="text-muted-foreground text-xs">{headerLabel}</span>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      <Toaster />
    </div>
  )
}
