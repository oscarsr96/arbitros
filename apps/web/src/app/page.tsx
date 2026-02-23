import Image from 'next/image'
import Link from 'next/link'
import { DemoView } from '@/components/demo-view'

export default function HomePage() {
  return (
    <main className="bg-fbm-navy min-h-screen">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 pb-10 pt-16">
        <Image src="/logo-fbm.png" alt="FBM" width={80} height={80} className="h-20 w-auto" />
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Designaciones</h1>
          <p className="mt-2 text-white/60">
            Sistema de designación de árbitros y oficiales de mesa
          </p>
          <p className="text-sm text-white/40">Federación de Baloncesto de Madrid</p>
        </div>
        <div className="mt-4 flex gap-3">
          <Link
            href="/login"
            className="bg-fbm-orange hover:bg-fbm-orange-dark rounded-md px-6 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Acceder al portal
          </Link>
          <Link
            href="/disponibilidad"
            className="rounded-md border border-white/20 px-6 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Demo Portal
          </Link>
        </div>

        {/* Demo Admin links */}
        <div className="mt-8 w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-white/50">
            Demo Admin
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/dashboard', label: 'Dashboard', icon: '📊' },
              { href: '/partidos', label: 'Partidos', icon: '🏀' },
              { href: '/personal', label: 'Personal', icon: '👥' },
              { href: '/asignacion', label: 'Asignación', icon: '📋' },
              { href: '/reportes', label: 'Reportes', icon: '📈' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Simulación de demo */}
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 lg:px-8">
        <DemoView />
      </div>
    </main>
  )
}
