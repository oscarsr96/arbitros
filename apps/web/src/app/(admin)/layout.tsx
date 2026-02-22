import { AdminSidebar } from '@/components/admin-sidebar'
import { Toaster } from '@/components/ui/sonner'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen">
      <AdminSidebar />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="border-border bg-card flex h-14 items-center border-b px-6 shadow-sm">
          <div className="flex-1 lg:hidden" /> {/* Space for mobile hamburger */}
          <div className="hidden flex-1 lg:block" />
          <span className="text-muted-foreground text-xs">Temporada 2024/25 · Jornada 15</span>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      <Toaster />
    </div>
  )
}
