# Lecciones — Sistema de Designaciones FBM

## Fuentes de datos y scraping

- **Regla:** antes de planificar scraping de una web, verificar `robots.txt` PRIMERO y preguntar si hay export oficial (CSV/XLSX/API).
  - **Why:** fbm.es bloquea bots genéricos (`Disallow: /` para `User-agent: *`); el plan de scraping quedó cancelado y se pivotó a su export CSV oficial, más simple y sin deuda.
  - **How to apply:** en tareas con scraping, poner el check de `robots.txt` como criterio de aceptación de la 1ª tarea y ofrecer la alternativa de export oficial antes de construir el scraper.

## Testing de imports sobre mock-data en Next dev

- **Regla:** al smoke-testear una ruta que MUTA los arrays mock (import XLSX/CSV/FBM), calentar las rutas antes, o validar el pipeline puro con vitest.
  - **Why:** en Next dev la 1ª compilación on-demand de cada ruta reevalúa el módulo `mock-data`; una mutación hecha por la ruta de import ANTES de que la ruta de lectura esté compilada se pierde (parece no persistir). En caliente sí persiste. Afecta a todos los importadores.
  - **How to apply:** hacer una request de calentamiento a `/api/admin/matches` (o generar demo) antes del import, o testear `parseCalendarCsv`+`materializeImport` con vitest sin servidor.

## Piloto: reusar el importador, no construir infra nueva

- **Regla:** para el piloto, convertir la fuente (PDF u otra) offline al CSV que ya acepta el importador FBM y subirlo, en vez de meter un parser en runtime + ruta + dependencia.
  - **Why:** el usuario cortó el over-engineering ("nos estamos complicando"); el enfoque offline (`scripts/fbm-pdf-to-csv.py`) reusó el pipeline probado (`parseCalendarCsv`→`materializeImport`) sin pdfjs en runtime ni código frágil commiteado. La integración genérica CSV/Excel se difiere.
  - **How to apply:** ante una fuente nueva para el piloto, ver primero si se normaliza al CSV existente offline; construir runtime solo cuando el usuario pida la integración general.

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
