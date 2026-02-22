import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="bg-fbm-navy flex h-16 w-16 items-center justify-center rounded-2xl p-2">
            <Image src="/logo-fbm.png" alt="FBM" width={48} height={48} className="h-12 w-auto" />
          </div>
          <div className="text-center">
            <h2 className="text-fbm-navy text-2xl font-bold">FBM Designaciones</h2>
            <p className="text-muted-foreground mt-1 text-sm">Federación de Baloncesto de Madrid</p>
          </div>
        </div>
        <div className="border-border bg-card rounded-lg border p-8 shadow-sm">{children}</div>
      </div>
    </div>
  )
}
