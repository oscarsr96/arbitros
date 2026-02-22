import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar Sesión — FBM Designaciones',
}

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Iniciar Sesion</h1>
      <p className="text-sm text-gray-500">
        Accede con el enlace magico enviado a tu correo electronico. Si eres administrador, puedes
        iniciar sesion con tu cuenta de Google del dominio FBM.
      </p>

      <div className="mt-6 space-y-4">
        <div className="h-10 rounded-md border border-gray-200 bg-gray-100" />
        <div className="h-10 rounded-md border border-orange-200 bg-orange-100" />
        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
        <div className="h-10 rounded-md border border-gray-200 bg-gray-100" />
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        Placeholder — formulario de acceso pendiente de implementacion
      </p>
    </div>
  )
}
