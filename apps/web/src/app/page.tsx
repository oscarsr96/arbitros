import Image from 'next/image'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="bg-fbm-navy flex min-h-screen flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
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
            Demo
          </Link>
        </div>
      </div>
    </main>
  )
}
