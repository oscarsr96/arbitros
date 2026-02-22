'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => {
      router.push('/disponibilidad')
    }, 1500)
  }

  const handleDemoAccess = () => {
    router.push('/disponibilidad')
  }

  return (
    <div>
      <h1 className="text-fbm-navy mb-2 text-2xl font-bold">Iniciar sesión</h1>
      <p className="text-muted-foreground text-sm">
        Accede con el enlace mágico enviado a tu correo electrónico.
      </p>

      {sent ? (
        <div className="mt-6 rounded-lg bg-green-50 p-4 text-center">
          <p className="text-sm font-medium text-green-800">Enlace enviado a {email}</p>
          <p className="mt-1 text-xs text-green-600">
            Revisa tu bandeja de entrada (modo demo: redirigiendo...)
          </p>
        </div>
      ) : (
        <form onSubmit={handleMagicLink} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative mt-1">
              <Mail className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                id="email"
                type="email"
                placeholder="tu.email@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="bg-fbm-navy hover:bg-fbm-navy-light w-full">
            Enviar enlace mágico
          </Button>

          <div className="relative flex items-center gap-3">
            <div className="border-border flex-1 border-t" />
            <span className="text-muted-foreground text-xs">o</span>
            <div className="border-border flex-1 border-t" />
          </div>

          <Button type="button" variant="outline" className="w-full" disabled>
            Acceder con Google (requiere Supabase)
          </Button>
        </form>
      )}

      <div className="border-fbm-orange/30 bg-fbm-orange/5 mt-6 rounded-lg border border-dashed p-3">
        <p className="text-fbm-orange-dark text-xs font-medium">Modo demostración</p>
        <p className="text-fbm-orange/80 mt-0.5 text-xs">
          Sin Supabase configurado, accede directamente con datos de ejemplo.
        </p>
        <Button
          size="sm"
          className="bg-fbm-orange hover:bg-fbm-orange-dark mt-2 w-full text-white"
          onClick={handleDemoAccess}
        >
          <LogIn className="mr-2 h-3.5 w-3.5" />
          Acceder como Carlos Martínez (demo)
        </Button>
      </div>
    </div>
  )
}
