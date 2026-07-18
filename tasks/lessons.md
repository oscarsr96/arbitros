# Lecciones — Sistema de Designaciones FBM

## Datos FBM: export oficial + importador existente, no infra nueva

- **Regla:** antes de scrapear, verificar `robots.txt` y preguntar por export oficial (CSV/XLSX/API); para fuentes nuevas del piloto (PDF, etc.), normalizarlas offline al CSV que ya acepta el importador FBM, no meter parser+ruta+dependencia en runtime.
  - **Why:** fbm.es bloquea bots (`Disallow: /` para `User-agent: *`) → se pivotó a su export CSV oficial; y el usuario cortó el over-engineering ("nos estamos complicando"), reusando el pipeline probado (`parseCalendarCsv`→`materializeImport`) vía `scripts/fbm-pdf-to-csv.py` sin código frágil en runtime. La integración genérica se difiere.
  - **How to apply:** check de `robots.txt` + oferta de export oficial como criterio de la 1ª tarea; normalizar fuentes nuevas al CSV existente offline; construir runtime solo cuando el usuario pida la integración general.

## Testing de imports sobre mock-data en Next dev

- **Regla:** al smoke-testear una ruta que MUTA los arrays mock (import XLSX/CSV/FBM), calentar las rutas antes, o validar el pipeline puro con vitest.
  - **Why:** en Next dev la 1ª compilación on-demand de cada ruta reevalúa el módulo `mock-data`; una mutación hecha por la ruta de import ANTES de que la ruta de lectura esté compilada se pierde (parece no persistir). En caliente sí persiste. Afecta a todos los importadores.
  - **How to apply:** hacer una request de calentamiento a `/api/admin/matches` (o generar demo) antes del import, o testear `parseCalendarCsv`+`materializeImport` con vitest sin servidor.
  - **Corolario (visto en vivo):** NO añadir una ruta NUEVA para mutar los arrays mock (una designación batch en `/api/.../apply`): la ruta fría re-evalúa `mock-data` y tiene su propio array AISLADO del que leen las rutas ya calientes → reporta éxito pero no persiste. Plegar la mutación en una ruta EXISTENTE que ya comparte módulo con el lector.
  - **Corolario cliente (bug "Publicar" deshabilitado):** un componente `'use client'` que importa un array mock MUTABLE (`mockDesignations`) lee la copia ESTÁTICA del bundle de cliente (el seed, casi siempre vacío), NUNCA lo que mutan las rutas API en el server. Derivar contadores de UI (pendientes, carga, cobertura) del estado que viene de `fetch` (`matches[].designations`), no del array importado. **Fix de fondo YA IMPLEMENTADO (765106e):** arrays mock respaldados en `globalThis.__fbmMockStore` (`x ??= init`) + designaciones persistidas a `apps/web/.fbm-data/designations.json` (hidratación en `instrumentation.ts`, hidratación descarta huérfanas). Al añadir un array mutable NUEVO, respáldalo también en el store (mockAlertLog/mockCompetitions ya migrados; `fs` solo en `designation-persistence.ts` server-only, nunca en `mock-data.ts`).
  - **Corolario getters seed (Tanda 2, panel de conflictos):** los GETTERS del seed (`getMockMatch`/`getMockVenue`) también devuelven la copia estática en el bundle cliente → se saltan en silencio los partidos importados por CSV (la vía real de datos). Cualquier cómputo cliente sobre partidos/designaciones (panel de verificación pre-publicación, etc.) debe resolver desde el estado `matches` del `fetch`, no desde `getMockMatch`.

## No borrar entregables del usuario en la limpieza

- **Regla:** en pasos de cleanup, borrar solo temporales propios (scratchpad, logs); dejar intactos los artefactos que son SALIDA para el usuario (CSV a subir, exports), aunque sean regenerables.
  - **Why:** borré `calendario_piloto_fbm.csv` (el entregable a subir) al "limpiar" tras el smoke y tuve que regenerarlo; el usuario podría haberlo perdido.
  - **How to apply:** antes de un `rm`, comprobar que el fichero no es algo que acabo de entregar al usuario para que lo use.

## Datos mock generados: deterministas y nicks únicos sin sufijos

- **Regla:** al generar datos mock por código (roster de personas, etc.), usar PRNG con semilla fija (nada de `Math.random()`/`Date.now()`); para identificadores/nicks únicos pedidos por el usuario, agotar un pool grande de valores DISTINTOS, nunca desambiguar con sufijos numéricos/romanos (II, III...).
  - **Why:** `mock-data` se importa desde componentes cliente → con random no sembrado el server y el cliente generan distinto (mismatch de hidratación); y el usuario rechazó explícitamente "ALTOS II" como nick.
  - **How to apply:** semilla fija + pool con holgura (motes de una palabra + compuestos "APODO DE LUGAR"); mapear categoría fina nueva a la `category` legacy para no tocar `meetsMinCategory`/UI; capturar `INITIAL_*` tras el spread para que `resetMockData` conserve lo generado.
  - **Scripts de (re)generación con tsx:** usa extensión `.ts`, NO `.mts` (el proyecto es CJS → la interop ESM→CJS falla con "does not provide an export named X"); ponlo en `apps/web` para que el alias `@/` y el tsconfig resuelvan; si creas y borras un `.ts` temporal, limpia `tsconfig.tsbuildinfo` o el hook de typecheck falla con TS6053 (referencia a fichero borrado).

## Subagentes que editan `route.ts` deben correr typecheck, no solo vitest

- **Regla:** un fichero `app/**/route.ts` de Next SOLO puede exportar handlers HTTP (`GET`/`POST`/…) y config (`dynamic`, etc.). Extraer helpers puros a un `lib/*.ts` e importarlos; NUNCA `export function` auxiliar en el propio `route.ts`.
  - **Why:** cualquier export extra rompe el tipo generado en `.next/types` (TS2344 "does not satisfy the constraint"), que `tsc --noEmit` detecta pero `vitest` NO. Un subagente que verificó solo con vitest dejó pasar el error al gate integrado.
  - **How to apply:** al delegar edición de rutas, incluir `pnpm typecheck` en el criterio de verificación del subagente (no solo su test); helpers testeable → módulo `lib/`.

## Diagnóstico de "la app va fatal / no entra": no fiarse de la extensión del navegador

- **Regla:** cuando el navegador MCP falla en páginas admin con "Frame ... is showing error page" (o `read_page`/`get_page_text` fallan), NO asumir un 500: la extensión de Claude falla en las páginas admin de esta app aunque el server responda 200. Verificar con `curl` (Bash con `dangerouslyDisableSandbox`, porque el sandbox no alcanza `localhost`) al puerto real (:3001) antes de tocar código.
  - **Why:** perdí varios turnos "arreglando" un 500 inexistente; el `curl` mostró la página completa (200) y APIs con datos. El síntoma real "va fatal / no entra" era saturación del dev server de un solo hilo bajo ráfaga de peticiones pesadas (matches 292 KB, 1279 personas), no un bug.
  - **How to apply:** `curl -s localhost:3001/<ruta>` para ver el HTML/JSON real; para inconsistencias de datos entre rutas, poll x3 (converge = ok). Cambios de `next.config.js`/`instrumentation.ts` exigen reinicio COMPLETO del dev server, no HMR.
