export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">FBM Designaciones</h2>
          <p className="mt-1 text-sm text-gray-500">Federación de Baloncesto de Madrid</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  )
}
