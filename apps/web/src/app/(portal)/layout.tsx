'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CalendarDays, ClipboardList, UserCircle, Menu, X, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'

const navLinks = [
  { href: '/disponibilidad', label: 'Disponibilidad', icon: CalendarDays },
  { href: '/designaciones', label: 'Mis Designaciones', icon: ClipboardList },
  { href: '/perfil', label: 'Mi Perfil', icon: UserCircle },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-fbm-navy sticky top-0 z-50 shadow-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/disponibilidad" className="flex items-center gap-2.5">
            <Image
              src="/logo-fbm.png"
              alt="FBM"
              width={332}
              height={129}
              quality={95}
              className="h-8 w-auto"
            />
            <span className="text-sm font-bold tracking-wide text-white">Designaciones</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-white/15 font-medium text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* User avatar */}
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-xs text-white/60">Carlos M.</span>
            <div className="bg-fbm-orange flex h-8 w-8 items-center justify-center rounded-full">
              <span className="text-xs font-semibold text-white">CM</span>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="text-white sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="bg-fbm-navy-light border-t border-white/10 px-4 pb-3 pt-2 sm:hidden">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white/15 font-medium text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}
            <div className="mt-2 flex items-center gap-2 border-t border-white/10 px-3 pt-3">
              <div className="bg-fbm-orange flex h-7 w-7 items-center justify-center rounded-full">
                <span className="text-xs font-semibold text-white">CM</span>
              </div>
              <span className="text-xs text-white/60">Carlos Martínez (Demo)</span>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <Toaster />
    </div>
  )
}
