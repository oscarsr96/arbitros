// Hidrata `mockDesignations` desde disco UNA vez al arrancar el server, antes
// de servir requests. Requiere el flag `experimental.instrumentationHook` en
// next.config.js (Next 14.x; en Next 15+ está habilitado por defecto).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureDesignationsHydrated } = await import('./lib/designation-persistence')
    ensureDesignationsHydrated()
  }
}
