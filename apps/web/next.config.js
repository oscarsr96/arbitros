/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14: instrumentation.ts (hidratación de mockDesignations al arrancar)
  // requiere este flag explícito. En Next 15+ está habilitado por defecto.
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig
