import { defineConfig } from 'vitest/config'
import path from 'path'
import { createRequire } from 'module'

// `require.resolve` en vez de una ruta fija: con pnpm el paquete real vive bajo
// node_modules/.pnpm/<version>/ y solo hay un symlink en apps/web/node_modules.
// Se resuelve el entry point (index.js, el que lanza) y se cambia por su vecino
// empty.js; el package.json no se puede resolver porque no está en `exports`.
const serverOnlyEmpty = path.join(
  path.dirname(createRequire(__filename).resolve('server-only')),
  'empty.js',
)

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `mock-data.ts` importa 'server-only' para que el build FALLE si un
      // componente cliente lo importa (arrastraría el seed de partidos, ~10 MB).
      // Ese paquete solo resuelve a un módulo vacío bajo la condición
      // `react-server`, que aplica Next en su capa de servidor; en Node a secas
      // resuelve a un index.js que LANZA. Vitest corre en Node plano, así que se
      // apunta al mismo `empty.js` que usaría Next: sin este alias, todas las
      // suites que tocan mock-data explotan al importar.
      'server-only': serverOnlyEmpty,
    },
  },
})
