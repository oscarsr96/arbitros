import Link from 'next/link'

const navLinks = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/partidos', label: 'Partidos', icon: '🏀' },
  { href: '/admin/personal', label: 'Personal', icon: '👥' },
  { href: '/admin/asignacion', label: 'Asignación', icon: '📋' },
  { href: '/admin/reportes', label: 'Reportes', icon: '📈' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex min-h-screen w-56 flex-col border-r border-gray-200 bg-white shadow-sm">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <span className="text-sm font-bold tracking-wide text-gray-900">
            FBM <span className="text-orange-500">Admin</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="text-base leading-none">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
              <span className="text-xs font-semibold text-orange-600">DS</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-900">Designador</p>
              <p className="truncate text-xs text-gray-500">FBM</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex-1" />
          <span className="text-xs text-gray-400">Temporada 2024/25</span>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
