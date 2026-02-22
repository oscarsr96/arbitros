import type { Metadata } from 'next'
import { ProfileView } from './profile-view'

export const metadata: Metadata = {
  title: 'Mi Perfil — FBM Designaciones',
}

export default function PerfilPage() {
  return (
    <div>
      <h1 className="text-fbm-navy text-2xl font-bold">Mi Perfil</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Consulta tus datos personales, categoría y estadísticas de la temporada actual. Puedes
        actualizar tu número de teléfono y dirección desde aquí.
      </p>

      <div className="mt-6">
        <ProfileView />
      </div>
    </div>
  )
}
