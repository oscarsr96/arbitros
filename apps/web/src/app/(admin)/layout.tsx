import Link from 'next/link'
import Image from 'next/image'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/partidos', label: 'Partidos', icon: '🏀' },
  { href: '/personal', label: 'Personal', icon: '👥' },
  { href: '/asignacion', label: 'Asignación', icon: '📋' },
  { href: '/reportes', label: 'Reportes', icon: '📈' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen">
      {/* Sidebar */}
      <aside className="border-border bg-fbm-navy flex min-h-screen w-56 flex-col border-r">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <Image src="/logo-fbm.png" alt="FBM" width={28} height={28} className="h-7 w-auto" />
          <span className="text-sm font-bold tracking-wide text-white">Admin</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span className="text-base leading-none">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="bg-fbm-orange flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
              <span className="text-xs font-semibold text-white">DS</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">Designador</p>
              <p className="truncate text-xs text-white/50">FBM</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="border-border bg-card flex h-14 items-center border-b px-6 shadow-sm">
          <div className="flex-1" />
          <span className="text-muted-foreground text-xs">Temporada 2024/25</span>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
