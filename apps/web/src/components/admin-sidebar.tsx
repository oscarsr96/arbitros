'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/calendario', label: 'Calendario', icon: '📅' },
  { href: '/partidos', label: 'Partidos', icon: '🏀' },
  { href: '/personal', label: 'Personal', icon: '👥' },
  { href: '/asignacion', label: 'Asignación', icon: '📋' },
  { href: '/reportes', label: 'Reportes', icon: '📈' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
        <Image
          src="/logo-fbm.png"
          alt="FBM"
          width={332}
          height={129}
          quality={95}
          className="h-7 w-auto"
        />
        <span className="text-sm font-bold tracking-wide text-white">Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
        {navLinks.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-white/15 font-medium text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-base leading-none">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          )
        })}
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
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="border-border bg-fbm-navy hidden min-h-screen w-56 flex-col border-r lg:flex">
        {sidebar}
      </aside>

      {/* Mobile hamburger */}
      <button
        className="bg-fbm-navy fixed left-4 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-md text-white lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="bg-fbm-navy fixed inset-y-0 left-0 z-40 flex w-56 flex-col lg:hidden">
            {sidebar}
          </aside>
        </>
      )}
    </>
  )
}
