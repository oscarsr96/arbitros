import Link from 'next/link'

const navLinks = [
  { href: '/disponibilidad', label: 'Disponibilidad' },
  { href: '/designaciones', label: 'Mis Designaciones' },
  { href: '/perfil', label: 'Mi Perfil' },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-sm font-bold tracking-wide text-gray-900">
            FBM <span className="text-orange-500">Portal</span>
          </span>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
            <span className="text-xs font-semibold text-orange-600">AR</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
