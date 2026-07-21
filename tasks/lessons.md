# Lecciones — Sistema de Designaciones FBM

> Tope 30 líneas (§3 CLAUDE.md). Lo desplazado vive en `lessons-archive.md`.

## Normativa oficial antes de sintetizar datos de dominio

- **Regla:** si hay que inventar un dato de dominio (horarios, tarifas, nº de árbitros), buscar primero el documento normativo del cliente y preguntarle por él.
- **Why:** propuse sintetizar horarios "por categoría" a ojo; el usuario respondió que las Bases Generales FBM ya traen la franja horaria Y el nº de árbitros/mesa por categoría. Lo inventado habría sido plausible y falso. Las Bases resultaron traer además la equivalencia patrocinador→categoría (Liga Ginos = 1ª Autonómica), que si no se habría inferido a ojo.
- **How to apply:** ofrecer la síntesis como plan B, no como plan A. Preguntar "¿hay bases/reglamento/tarifario?" antes de generar. Ver [[cost-model]].

## Verificar el informe del subagente, no solo leerlo

- **Regla:** re-medir el criterio de aceptación de forma independiente antes de cerrar una tanda.
- **Why:** tres fallos reales sobrevivieron a informes en verde: 7 grupos con más partidos de los posibles (identidades de equipo fundidas), un cuadrático `partidos × designaciones` en una ruta, y un solver que tarda minutos con volumen real. Los tests pasaban con el seed pequeño.
- **How to apply:** los verdes con datos de juguete no dicen nada del caso real. Medir con volumen de producción y con un invariante propio, no con el del autor.

## Invariantes de dominio > heurísticas de cobertura

- **Regla:** para validar un parser, usar un invariante EXACTO del dominio, no una heurística con tolerancias.
- **Why:** la heurística "coverage con tolerancia T-1" daba falsos positivos con los `DESCANSA` y no veía el bug real. El invariante `n*(n-1)` de liga a doble vuelta lo cazó: 259/272 exactos, 6 déficit, 7 imposibles.
- **How to apply:** detectar EXCESO además de déficit (el exceso delata identidades colapsadas). Emparejar contra vocabulario cerrado por coincidencia MÁS LARGA, nunca la primera que encaja.

## Árbol compartido: un gate en rojo puede ser un vecino a media escritura

- **Regla:** con varias tandas en el mismo árbol, re-verificar contra el estado ACTUAL antes de escalar un fallo como "bug de X".
- **Why:** pasó 3 veces en una sesión (un `</content>` ya borrado, un `materialize-import.ts` a medio commit, un `getMockDesignationsForMatch` en refactorización). Cada una costó una ronda.
- **How to apply:** `stat`/`tail` el fichero y reejecutar el gate antes de mandar mensaje. No editar un fichero que otro está escribiendo: avisar a su dueño.

## Escala: lo importado hay que medirlo, no extrapolarlo

- **Regla:** al multiplicar por 75× el volumen, medir bundle, payload y CPU antes de dar la carga por buena.
- **Why:** el seed viajaba entero al cliente (9,5 MB en un chunk compartido), la ruta de partidos devolvía 21 MB y el solver pasó de 0,2 s a minutos. Todo con typecheck y tests en verde.
- **How to apply:** `verify:bundle` en CI tras el build; filtrar por jornada en servidor; barrido con `performance.now()` antes de declarar rendimiento aceptable. Ver [[import-temporada-completa]].

## `pnpm typecheck` obligatorio, no solo vitest

- **Regla:** un `app/**/route.ts` de Next SOLO exporta handlers HTTP y config; los helpers van a `lib/*.ts`.
- **Why:** cualquier export extra rompe el tipo generado en `.next/types` (TS2344); `tsc` lo detecta, `vitest` NO.
- **How to apply:** incluir `pnpm typecheck` en el criterio de verificación de todo subagente que toque rutas.

## Datos generados: deterministas siempre

- **Regla:** PRNG con semilla fija o derivada del dato (p. ej. FNV-1a de `venueId|date`). Nunca `Math.random()`/`Date.now()`.
- **Why:** `mock-data` se importa desde cliente; el no-determinismo rompe la hidratación server/cliente.
- **How to apply:** criterio de aceptación = regenerar dos veces y comparar hash.
