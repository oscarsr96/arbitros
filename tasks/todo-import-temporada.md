# Plan — Importar temporada completa FBM (~24.500 partidos)

Fuente: `partidos_calendarios/{primera_tanda,segunda_tanda}` (303 PDF, **272 únicos**).
Normativa: `Bases_Generales_2026-2027_V.16-06-2026 (1).pdf` (arbitraje p.25, horarios p.55).

## Decisiones del usuario (2026-07-21)

1. **Horarios**: sintetizar según Bases FBM (franja + día oficial por categoría), no al azar.
2. **Alcance**: temporada completa, ~24.500 partidos, 29 jornadas.
3. **Plantilla**: no se toca el roster actual (~1279 personas).

## Datos medidos

| Métrica              | Valor                        |
| -------------------- | ---------------------------- |
| PDF únicos           | 272                          |
| Partidos totales     | ~24.534                      |
| Fechas de jornada    | 29                           |
| Jornada punta        | 1.356 partidos (26/10/2025)  |
| Categorías distintas | 48                           |
| Municipios distintos | ~60                          |
| Horas reales en PDF  | 12,7% (el resto viene 00:00) |
| Días declarados      | Sábado 66%, Domingo 34%      |

## Tablas oficiales extraídas de las Bases

**Arbitraje (p.25)** — sustituye los `needsConfirmation: true` provisionales:

| Categoría                                         | Árbitros | Of. Mesa |
| ------------------------------------------------- | :------: | :------: |
| 1ª Div. Nac. Masculina / Femenina                 |    2     |    3     |
| Liga Universitaria                                |    2     |    2     |
| 1ª Div. Aut. Masc. ORO / PLATA, 1ª Div. Aut. Fem. |    2     |    2     |
| 2ª Div. Autonómica Masculina / Femenina           |    2     |    2     |
| Sub-22 (ORO, Fem., PLATA, BRONCE)                 |    2     |    2     |
| Junior ORO                                        |    2     |    3     |
| Junior PLATA y BRONCE                             |    2     |    2     |
| Junior 1er año, Junior Preferente                 |    2     |    1     |
| Cadete ORO                                        |    2     |    3     |
| Cadete PLATA y BRONCE                             |    2     |    2     |
| Cadete 1er año                                    |    2     |    1     |
| Infantil ORO                                      |    2     |    3     |
| Infantil PLATA y BRONCE                           |    2     |    2     |
| Cadete Preferente                                 |    1     |    1     |
| Infantil Preferente e Infantil 1er año            |    1     |    1     |
| Competiciones Minibasket (Alevín/Benjamín)        |    1     |    1     |

**Horarios (p.55)** — franja y día oficial:

| Categoría                          | Día              | Franja     |
| ---------------------------------- | ---------------- | ---------- |
| 1ª División Nacional               | Sábado o Domingo | 9:00–20:30 |
| 1ª y 2ª División Autonómica        | Domingo          | 9:00–20:30 |
| Sub-22, Junior ORO/PLATA/BRONCE    | Domingo          | 9:00–20:30 |
| Cadete ORO/PLATA/BRONCE            | Sábado o Domingo | 9:00–20:30 |
| Infantil ORO/PLATA/BRONCE          | Domingo          | 9:00–20:30 |
| Junior Preferente y Junior 1er año | Sábado o Domingo | 9:00–20:30 |
| Cadete Preferente                  | Sábado o Domingo | 9:00–20:30 |
| Infantil Preferente                | Sábado           | 9:00–20:30 |
| Cadete 1er año                     | Sábado o Domingo | 9:00–20:30 |
| Infantil 1er año                   | Sábado           | 9:00–20:30 |
| Minibasket (Alevín y Benjamín)     | Sábado           | 9:00–18:30 |

La p.56 obliga a programar **de forma escalonada** → la síntesis escalona por pabellón.

---

## Tareas

### T1 — Generalizar el parser PDF→CSV `[sonnet, effort: high]`

`scripts/fbm-pdf-to-csv.py` hoy tiene coordenadas fijas calibradas en 2 layouts y una lista
`SOURCES` de 4 ficheros. Generalizar:

- Dedup por hash MD5 (272 de 303).
- **Calibración dinámica de columnas**: derivar los límites x de la fila cabecera
  (`EQUIPO/POBLACIÓN/PROV/DÍA/HORA/COLOR/CAMPO`), no hardcodear píxeles.
- Parsear: cabecera (CATEGORÍA/FASE/GRUPO), tabla de equipos (día, hora, campo, población),
  páginas de jornadas (**2 columnas**: ida izquierda, vuelta derecha) y página directorio
  (dirección de campo, CP, teléfono).
- El local aporta día/hora/pabellón; la fecha sale de la cabecera de jornada.
- Emitir CSV con `REQUIRED_COLUMNS` + `IDENTIFICADOR` estable y único.

**Aceptación**: 272 PDF procesados, 0 excepciones, ~24.500 filas, `IDENTIFICADOR` sin colisiones,
recuento por fecha coincide con el medido arriba (±1%).

### T2 — Tabla oficial de arbitraje y horarios `[opus, effort: high]`

Módulo nuevo `apps/web/src/lib/fbm-calendar/bases-fbm.ts` con las dos tablas de arriba.
Sustituye los conteos provisionales de `category-mapping.ts`.

**Aceptación**: cada una de las 48 categorías resuelve a `(refereesNeeded, scorersNeeded, día, franja)`.

### T3 — Ampliar `CATEGORY_FAMILIES` a las 48 categorías `[opus, effort: xhigh]`

Hoy hay 8 familias; lo no mapeado **se descarta en silencio**. Mapear las 48 reales
(Benjamín/Alevín Marco Aldany, Liga AhorraMas ORO/PLATA/BRONCE, Ginos, VIPS, Sub-22,
2ª Div Aut, Preferentes, 1er año…).

**Aceptación**: 0 filas descartadas por categoría no mapeada; si algo no mapea el script
**falla ruidosamente**, no lo omite.

### T4 — Ampliar la matriz fina de 7 niveles `[opus, effort: xhigh]`

`FINE_CATEGORY_BY_CANONICAL` cubre 14 nombres; el resto cae al fallback lineal de 4 niveles.
Mapear los canonical nuevos a `CompetitionCategory` (incluido `minibasket`).

**Aceptación**: toda competición generada resuelve `fineCategory` no nula, o queda
justificada explícitamente por qué usa el fallback.

### T5 — Ampliar municipios y distancias `[sonnet, effort: high]`

Hoy hay **31** municipios en runtime; los calendarios traen ~60. Un pabellón sin municipio
resuelto → `municipalityId: ''` → fallback fantasma de 35 km y colisión entre pabellones
distintos (bug ya documentado).
Añadir los faltantes a `mockMunicipalities` + `MUNI_COORDS`.

**Aceptación**: **0 pabellones con `municipalityId: ''`** tras la importación.

### T6 — Síntesis de horarios escalonada `[opus, effort: xhigh]`

- Respeta la hora real cuando el PDF la trae (12,7%).
- Si no: agrupar por `(pabellón, fecha)` y asignar slots consecutivos desde el inicio de la
  franja cada 90 min, dentro de la franja de la categoría.
- Día: el declarado por el local (S/D), validado contra el día oficial de las Bases.
- PRNG **determinista con semilla fija** (lección: nada de `Math.random()`, rompe hidratación).
- Campo `timeIsEstimated: boolean` en `MockMatch` para no confundir dato real con simulado.

**Aceptación**: ningún pabellón con 2 partidos solapados el mismo día; todas las horas dentro
de la franja de su categoría; regenerar dos veces produce **output idéntico**.

### T7 — Sacar el seed del bundle de cliente `[opus, effort: max]` ⚠️ BLOQUEANTE

**Medido, no hipotético.** `mock-data.ts:7` importa `fbm-seed.json` de forma estática, y 10
componentes `'use client'` importan helpers de `mock-data` → arrastran el seed entero al bundle.
Verificado: la cadena `fbm-match-` aparece en `.next/static/chunks/app/(admin)/{asignacion,partidos}/page.js`
y `(portal)/disponibilidad/page.js`.

Seed medido: **529 bytes/partido** → 171 KB hoy, **~12,4 MB** con 24.534.

| chunk                             | hoy      | proyectado |
| --------------------------------- | -------- | ---------- |
| `(admin)/partidos/page.js`        | 5.418 KB | ~18.250 KB |
| `(admin)/asignacion/page.js`      | 3.036 KB | ~15.869 KB |
| `(portal)/disponibilidad/page.js` | 2.441 KB | ~15.273 KB |

Además `GET /api/admin/matches` devuelve TODOS los partidos enriquecidos sin filtro (~20 MB/request).

Nota: esos 171 KB que hoy viajan al cliente **ya son un bug**, no solo peso — la lección
documentada dice que el cliente lee la copia estática del bundle, nunca lo que mutan las rutas API.

Trabajo: (1) partir `mock-data.ts` en un módulo client-safe sin import del seed y reapuntar los 10
componentes; (2) evaluar carga server-only del seed en runtime en vez de import estático;
(3) filtrado por jornada (ventana viernes→jueves) en servidor.

**Aceptación**: `grep -rl "fbm-match-" .next/static/chunks/app/` → **0 resultados**; los 3 chunks no
crecen con el seed grande; payload de una jornada < 1 MB; `typecheck` y `test` en verde.

### T8 — Multi-CSV y regeneración del seed `[sonnet, effort: high]`

`generate-fbm-seed.ts` apunta hoy a un único CSV hardcodeado. Extender a multi-CSV con dedup
por `IDENTIFICADOR` y regenerar `fbm-seed.json`.

**Aceptación**: `fbm-seed.json` con ~24.500 partidos, ~500+ pabellones y ~250 competiciones;
seed regenerable de forma reproducible.

### T9 — Tests `[sonnet, effort: high]`

Vitest sobre el pipeline puro (sin servidor, según lección): parser PDF, mapeo de las 48
categorías, síntesis de horarios (determinismo + no solape), resolución de municipios.

**Aceptación**: happy path + 2 edge cases por módulo; suite en verde.

---

## Riesgos

| Riesgo                                    | Mitigación                                                 |
| ----------------------------------------- | ---------------------------------------------------------- |
| **20 MB por request tumban la app**       | T7 es bloqueante y va antes de dar por bueno el import     |
| Categorías nuevas descartadas en silencio | T3 convierte el descarte en fallo ruidoso                  |
| Municipios sin resolver → 35 km fantasma  | T5 con criterio de aceptación de cero huérfanos            |
| Reimportar borra TODAS las designaciones  | Footgun conocido; aceptable en carga masiva única          |
| Cobertura ~70% en jornada punta           | Esperado: 1279 personas × máx. 3 = 3.837 vs ~5.400 puestos |
| Bases 2026/27 vs calendarios 25/26        | Se asume continuidad de tarifas y franjas; documentado     |

---

# ESTADO AL CIERRE DE SESIÓN (2026-07-21)

## Cerrado y verificado de forma independiente

| Tanda           | Resultado                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| T1 parser       | 24.508 partidos, 272/272 grupos exactos contra `n*(n-1)`, 0 auto-partidos, 0 colisiones de ID, 48 categorías   |
| T2 categorías   | 48 categorías mapeadas, Tablas A y B de las Bases en `bases-fbm.ts`, descarte silencioso eliminado             |
| T5 municipios   | 58 municipios con coordenadas (regresión lineal R²=0,977 contra los 31 originales), 0 poblaciones sin resolver |
| T6 horarios     | 3.204 reales + 21.304 estimadas, 0 fuera de franja, determinista, pistas paralelas                             |
| T7 bundle+vista | chunks 13 MB → 2,9 MB, `server-only` + `verify:bundle` en CI, jornada 590 KB                                   |

## EN VUELO al cerrar la sesión (retomar aquí)

- **T8 — regenerar `fbm-seed.json`**: NO HA TERMINADO. El seed sigue en **324 partidos / 171 KB**.
  Los 24.508 partidos NO están todavía dentro de la app. Es el primer paso de la próxima sesión.
- **T10 — optimizar el solver**: en curso. Objetivo <30 s para 1.309×1.279 sin cambiar las
  asignaciones producidas (375 tests fijan el comportamiento).

## Cabos sueltos

1. **Solver lento** (el importante): medido 50×30 → 0,21 s · 800×480 → 61,9 s; crece con el producto
   partidos × personas → 4,5-7 min por jornada real. Puntos calientes localizados:
   `hasIncompatibility` (`solver.ts:154`) escanea toda la lista y rehace `toLowerCase()` en ~1,7 M
   llamadas; búsquedas lineales dentro del bucle por slot.
2. **Test flaky preexistente**: `solver.test.ts:358` ("50 matches <1000ms") falla ~1 de cada 3
   (medido 1.025 ms). Hará flakear el CI recién añadido. Decidir: subir umbral, moverlo a benchmark
   fuera del run, o medir con mediana.
3. **10 nombres de equipo truncados** de 843 (`COLEGIO ESTUDIANTES LAS`, `HYUNDAI ALMOAUTO SAN`…),
   786 filas afectadas. Solo cosmético; se arreglaría tirando del directorio de clubs del PDF.
   Aparte: `HYNDAI`/`HYUNDAI` conviven como equipos distintos — es errata del PDF de origen.
4. **`calendario_temporada_fbm.csv` (6,9 MB) no está trackeado en git.** Afecta a la
   reproducibilidad del seed y hace que el test de cobertura de municipios se salte en un checkout
   limpio. Decidir si se commitea o si el test se reorienta al seed (pedido a T5).
5. **Tarifas en € sin modelar** (Fase 4 liquidaciones). La fuente ya está localizada:
   Bases Generales p. 25, con desglose por rol. Ver memoria `cost-model`.
6. **Etiqueta del filtro "Día"**: solo ofrece Sábado y Domingo mientras la ventana es viernes→jueves.
   Se decidió NO tocarlo: los 24.508 partidos son 100% fin de semana, sería UI muerta. Revisar
   cuando entren datos con partidos entre semana.

## AMPLIACIÓN (cierre de T7, posterior al wrap-up)

**Cuadrático de `/api/admin/matches`: CORREGIDO.** Índice `Map<matchId, Designation[]>` una vez por
request. Medido con 1.309 partidos y 122.670 designaciones: **3.282 ms → 13 ms** (161 M → 0,12 M
comparaciones), mismo resultado. Había un SEGUNDO escaneo que no estaba en mi diagnóstico:
`getMockDesignationsForMatch` llama a `getMockMatch`, otro `find` lineal sobre los 24.508 partidos
(+32 M). Se resolvió extrayendo `enrichMatchDesignations(match, designations)` y dejando
`getMockDesignationsForMatch` como envoltorio de una línea: firma y salida idénticas.

**Payload con temporada COMPLETA designada: 589 KB** (frente a 4,9 MB de la forma anterior), y
589 KB designada vs 590 KB sin designar → plano ante las designaciones por construcción.

### ⚠️ CABO NUEVO Y GRANDE: el mismo cuadrático vive en 4 rutas más

`getMockDesignationsForMatch` dentro de un bucle sobre partidos, SIN corregir:

| ruta                                  | alcance                      |
| ------------------------------------- | ---------------------------- |
| `admin/dashboard/route.ts:21`         | recorre `mockMatches` ENTERO |
| `admin/reports/route.ts:66`           | recorre `mockMatches` ENTERO |
| `api/optimize/route.ts:51`            | por rango                    |
| `admin/demo/route.ts` (241, 451, 724) | varios                       |

Dashboard y reportes son **24.508 × 122.670 ≈ 3.000 M de comparaciones**: bastante PEOR que el de
Partidos que acabamos de arreglar. `enrichMatchDesignations` ya está exportada, así que el arreglo
es el mismo patrón de índice en cada una. **Prioridad alta para la próxima sesión**: el dashboard es
la primera pantalla que abre el designador.

### Decisión pendiente: marcar la hora estimada en la UI

T7 argumenta (y coincido) que hace falta: el 87% de las horas están sintetizadas, y el designador
toma decisiones de disponibilidad y solapamiento sobre ellas. Afecta a solape, coste por día y hora
de salida. Serían pocas líneas en `match-detail-row` (asterisco o tono distinto en la columna Hora).
El dato ya viaja: `timeIsEstimated`. **Consultar al usuario antes de implementar.**

---

# TANDA RENDIMIENTO — temporada completa con solver <30 s (plan 2026-07-21)

Planner: `planner-rendimiento` (Fable 5). Objetivo: que la app aguante la temporada 25/26
completa (24.508 partidos, 1.279 personas) con el solver por debajo de 30 s por jornada,
**sin cambiar las asignaciones que produce** (invariante duro de toda la tanda).

## 0. Corrección del estado (esta sección sustituye a "EN VUELO al cerrar la sesión")

1. **T8 está TERMINADO.** `apps/web/src/lib/fbm-calendar/fbm-seed.json` = 14,3 MB con
   24.508 partidos, 286 pabellones, 48 competiciones y 57 fechas (2025-09-20 → 2026-05-10),
   cableado en `mock-data.ts`. La nota de arriba "el seed sigue en 324 partidos / 171 KB"
   quedó **obsoleta**: se regeneró después del cierre de sesión.
2. **La suite NO está verde**: `pnpm vitest run` da 374 verdes / 4 rojos en 27 ficheros.
   Los 4 rojos son consecuencia directa del crecimiento del seed (detalle en B0).
3. **El diagnóstico del cabo suelto 1 era erróneo**: `hasIncompatibility` (`solver.ts:154-161`)
   NO es el cuello de botella (solo hay 3 incompatibilidades en el seed real; es higiene
   barata). Los cuellos reales, verificados con file:line, son costes fijos por llamada a
   `solve()`/`solvePartial()` más un cuadrático en 4 rutas API:

   | Cuello                                 | Dónde                                                                                               | Coste                                                                                   |
   | -------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
   | `buildOverlapMatchIndex()`             | `solver.ts:201-208` (llamado en `:347` y `:1012`)                                                   | 24.508 partidos × `getMockVenue` lineal (~394 venues) ≈ 9,6 M comparaciones por llamada |
   | Bucle de designaciones existentes      | `solver.ts:381-451` (`matches.find` en `:392`, `persons.find` en `:414`)                            | 122.670 designaciones × 1.309 partidos ≈ 160 M comparaciones                            |
   | `maxLoad` por slot                     | `solver.ts:756-759`                                                                                 | O(slots × personas) extra, trivialmente incremental                                     |
   | `getMockDesignationsForMatch` en bucle | `dashboard/route.ts:21`, `reports/route.ts:66`, `demo/route.ts:241/451/724`, `optimize/route.ts:51` | dashboard y reports ≈ 3.000 M comparaciones (temporada entera)                          |

4. **Baseline medida del solver**: 50×30 → 0,21 s · 200×120 → 2,8 s · 800×480 → 61,9 s ·
   1.309×1.279 extrapolado 4,5-7 min. Objetivo: ≤30 s medidos, no extrapolados.
5. **55 ficheros sin commitear**: todo T1-T8 vive solo en el working tree (ver sección 6).

## 1. Estrategia y orden

La suite tiene que estar verde ANTES de optimizar: el invariante "mismas asignaciones"
necesita una baseline fiable, y una baseline sobre suite rota no prueba nada. Orden:

1. Commitear el trabajo T1-T8 (punto de retorno).
2. Poner la suite en verde y rescatar el arnés de equivalencia (B0). El dashboard (R1) entra
   en esta misma ola por urgencia: es la primera pantalla que abre el designador y hoy hace
   ~3.000 M de comparaciones.
3. Grabar baselines de fingerprint (sintéticas + jornada real) y commitear.
4. Resto de rutas cuadráticas (B1) y pasada de factor constante del solver (B2).
5. **Punto de decisión medido** (B3): si el solver no baja de 30 s, y solo entonces,
   rediseño algorítmico con `fable` (B4).
6. Gate + review adversarial final con `fable, effort: max` (B5).

Reglas transversales (lecciones del proyecto, obligatorias para todo ejecutor):

- `pnpm typecheck` además de vitest: un `app/**/route.ts` solo exporta handlers HTTP y
  config; helpers nuevos van a `lib/*.ts` (TS2344 en `.next/types` no lo caza vitest).
- Nada de `Math.random()`/`Date.now()` en módulos importables desde cliente.
- `mock-data.ts` es `server-only`; no romper la separación con `mock-data-client.ts`
  (`pnpm verify:bundle` lo vigila).
- Verificación independiente: el criterio de aceptación se re-mide, no se acepta el
  autoinforme del subagente.
- Árbol compartido: cada tarea toca SOLO sus ficheros listados; re-verificar contra el
  estado actual antes de escalar un fallo como bug.

## 2. Bloques (mini-specs)

### B0 — Suite verde + arnés de equivalencia

- **P1 · availability-roster**: el test de presupuesto de volumen falla porque la temporada
  pasó de ~44 a 57 fechas y `generateSeasonAvailability` produce 62.471 slots (> tope 55.000).
  El crecimiento es proporcional a las fechas, no una regresión: subir el tope a **70.000**
  con comentario que documente la relación slots↔fechas (57 fechas × ~1.100 slots/fecha).
  62 k objetos ligeros no son un problema de memoria; si el usuario prefiere recortar
  generación, es la decisión 2 de la sección 7.
- **P2 · competition-fine-category**: el test enumera un catálogo CERRADO de ~10
  competiciones y ahora hay 56. Reescribir a dos niveles: (a) spot-checks, las ~10
  originales siguen presentes con los valores esperados exactos; (b) invariante global,
  las 56 competiciones de `mockCompetitions` resuelven `fineCategory` no nula o figuran en
  una lista explícita de excepciones justificadas (que debería quedar vacía tras T4). Nada
  de deepEqual contra listas cerradas de ids.
- **P3 · designations route 409→201**: sin diagnosticar. Aplicar `systematic-debugging`:
  reproducir con `pnpm vitest run src/app/api/admin/designations/__tests__/route.test.ts`,
  aislar causa raíz. Hipótesis a verificar (no confirmadas): el partido que usa el test ya
  viene con designaciones u ocupación del seed grande; colisión de solape con 24.508
  partidos; ids del test chocando con ids reales. PROHIBIDO cambiar el assert sin causa
  raíz identificada; si el test dependía implícitamente del seed pequeño, aislarlo con
  datos propios del test.
- **P4 · rescatar el bench como arnés permanente** (`solver.bench.test.ts`): se rescata, no
  se sustituye (recomendado: ya trae barrido de escala y `fingerprint()` correctos).
  Cambios: (1) sustituir la ruta `SCRATCH` hardcodeada (`:427-428`) por
  `process.env.BENCH_DIR ?? os.tmpdir()`; (2) el barrido de escala (`:443`, hasta 30 min)
  queda tras `describe.skipIf(!process.env.BENCH)`; (3) el test de equivalencia (`:464`)
  pasa a comparar contra fixture commiteado
  `src/lib/__tests__/__fixtures__/solver-fingerprint-baseline.json` y corre SIEMPRE, con
  los casos 200×120 (los 400×240 solo bajo `BENCH`, hoy cuestan ~15 s cada uno);
  (4) regenerar baseline solo con `UPDATE_BASELINE=1`; (5) quitar el comentario
  "BENCH TEMPORAL — borrar antes de entregar" y documentar el uso en cabecera;
  (6) probar determinismo: dos ejecuciones consecutivas → fingerprints idénticos.
- **P5 · flaky perf test** (`solver.test.ts:319-358`, umbral 1.000 ms, falla ~1/3): medirlo
  como mediana de 3 ejecuciones dentro del propio test y subir el umbral a 2.000 ms.
  Sigue siendo canario de regresión (tras B2 debería quedar muy holgado).
- **P6 · grabar baselines** (tras P1-P5 verdes y commit): (a) sintéticas: generar el fixture
  de P4 con `UPDATE_BASELINE=1`; (b) **jornada real**: fingerprint de `solve()` sobre la
  jornada punta del seed real (26/10/2025, ~1.309 partidos), guardado en
  `__fixtures__/solver-fingerprint-jornada-real.json` bajo el mismo mecanismo. Coste único
  asumido: 5-7 min con el solver sin optimizar. Es la garantía fuerte de "mismas
  asignaciones" con datos reales, no de juguete.

### B1 — Cuadráticos de las 4 rutas API

La solución ya existe y está exportada: `enrichMatchDesignations(match, designations)`
(`mock-data.ts:1998-2001`) + el patrón de índice `Map<matchId, Designation[]>` de referencia
en `api/admin/matches/route.ts:44-56` y `:102-110` (medido allí: 3.282 ms → 13 ms). Cada
tarea replica ese patrón en su ruta. Verificación por tarea: (1) equivalencia de salida,
capturar el JSON de respuesta antes y después sobre el MISMO estado y comparar
(normalizando campos volátiles tipo timestamps si los hay); (2) tiempo medido con
`performance.now()` invocando el handler con la temporada completa designada; (3) suite
del fichero + `pnpm typecheck`. Índices nuevos se construyen POR REQUEST (nada de caché de
módulo: el demo route regenera los datos y una caché introduciría bugs de invalidación).

### B2 — Pasada de factor constante del solver (S1, un solo dueño de `solver.ts`)

Sin tocar orden de iteración ni desempates (30 tests con `personId` exacto lo vigilan):

1. `buildOverlapMatchIndex()` (`:201-208`): construir `venuesById: Map` una vez por llamada
   y usarla en el map (24.508 lookups O(1) en vez de ×394 `find`). Sin memoización de
   módulo, por la misma razón de invalidación que en B1.
2. Bucle de designaciones (`:381-451`): `scopedMatchById: Map` construido una vez desde
   `matches` (sustituye `matches.find` de `:392`; ya existe `inScopeMatchIds` al lado) y
   `personsById: Map` (sustituye `persons.find` de `:414`). Para fuera de scope ya existe
   `mockMatchById` (`:403`). Aplicar también en `solvePartial` (`:1012` y su bucle gemelo).
3. `maxLoad` (`:756-759`): mantenerlo incremental (las cargas solo crecen durante solve:
   actualizar el máximo en cada incremento de `personLoadCount`). Si lo incremental sale
   enrevesado, alternativa aceptable: recalcular solo cuando alguna carga cambió desde el
   último slot (dirty flag). La puntuación resultante debe ser bit a bit la misma.
4. Higiene `hasIncompatibility` (`:154-161`): índice `Map<personId, string[]>` con nombres
   ya en minúsculas, construido una vez por solve. No es el cuello: no gastar más de eso.

### B3 — Punto de decisión medido (detalle en sección 5)

### B4 — Rediseño algorítmico (CONDICIONAL, solo si B3 falla)

Ejecutor `fable`. Direcciones candidatas (a re-evaluar con el perfil medido tras S1):
pre-bucketing de candidatos por rol y día vía el índice de disponibilidad de
`mock-data.ts:2163-2187`; poda temprana por distancia (hard-cut 30 km antes de puntuar);
estructuras incrementales para el coste marginal por día. Restricción absoluta: los dos
fixtures de fingerprint (sintético y jornada real) deben seguir verdes. Si un rediseño no
puede preservar la salida exacta, PARAR y consultar al usuario: el objetivo de la tanda
prohíbe cambiar asignaciones.

### B5 — Gate + review adversarial final

Ejecutor `fable, effort: max`. Re-ejecuta TODOS los criterios globales (sección 8) de forma
independiente, y hace review adversarial del diff completo de la tanda desde el commit base
("¿qué rompería esto?": invalidación de índices, mutación de mock-data por rutas admin,
`solvePartial` olvidado, exports ilegales en route.ts, regresiones de bundle).

## 3. Task breakdown

| Id  | Título                                                | Ejecutor  | Effort | Deps             | Ficheros (dueño exclusivo)                                                                                            |
| --- | ----------------------------------------------------- | --------- | ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| P0  | Commit del trabajo T1-T8                              | team-lead | n/a    | decisión 1       | todo el working tree                                                                                                  |
| P1  | Presupuesto availability-roster → 70.000              | sonnet    | low    | P0               | `src/lib/__tests__/availability-roster.test.ts`                                                                       |
| P2  | Reescribir competition-fine-category a invariantes    | sonnet    | high   | P0               | `src/lib/__tests__/competition-fine-category.test.ts`                                                                 |
| P3  | Causa raíz + fix designations 409→201                 | sonnet    | xhigh  | P0               | `src/app/api/admin/designations/__tests__/route.test.ts` (+ `route.ts` de esa carpeta solo si la causa raíz vive ahí) |
| P4  | Bench permanente: SCRATCH, gates, fixture             | sonnet    | high   | P0               | `src/lib/__tests__/solver.bench.test.ts`                                                                              |
| P5  | Des-flakear perf test (mediana de 3, umbral 2.000 ms) | sonnet    | low    | P0               | `src/lib/__tests__/solver.test.ts` (solo bloque `:319-358`)                                                           |
| R1  | Dashboard: índice de designaciones                    | sonnet    | high   | P0               | `src/app/api/admin/dashboard/route.ts`                                                                                |
| P6  | Grabar baselines (sintética + jornada real) y commit  | sonnet    | low    | P1-P5, R1        | `src/lib/__tests__/__fixtures__/*`                                                                                    |
| R2  | Reports: índice de designaciones                      | sonnet    | low    | P6               | `src/app/api/admin/reports/route.ts`                                                                                  |
| R3  | Optimize: enriquecido indexado                        | sonnet    | high   | P6               | `src/app/api/optimize/route.ts`                                                                                       |
| R4  | Demo: 3 maps indexados                                | sonnet    | low    | P6               | `src/app/api/admin/demo/route.ts`                                                                                     |
| S1  | Factor constante del solver (4 puntos de B2)          | sonnet    | xhigh  | P6               | `src/lib/solver.ts` (+ helper en `mock-data.ts` solo si hace falta `venuesById`)                                      |
| D1  | Punto de decisión medido                              | team-lead | n/a    | S1               | ninguno (solo medición)                                                                                               |
| A1  | Rediseño algorítmico (condicional)                    | fable     | xhigh  | D1 en rojo       | `src/lib/solver.ts`                                                                                                   |
| G1  | Gate + review adversarial                             | fable     | max    | todo lo anterior | ninguno (lectura + medición)                                                                                          |

Criterios de aceptación por tarea (comando concreto, número concreto):

- **P1**: `pnpm vitest run src/lib/__tests__/availability-roster.test.ts` → 0 rojos.
- **P2**: `pnpm vitest run src/lib/__tests__/competition-fine-category.test.ts` → 0 rojos;
  el test cubre las 56 competiciones (assert sobre `mockCompetitions.length` incluido) y
  conserva los ~10 spot-checks exactos originales.
- **P3**: `pnpm vitest run src/app/api/admin/designations/__tests__/route.test.ts` → 0
  rojos; el informe del ejecutor nombra la causa raíz con file:line.
- **P4**: `pnpm vitest run src/lib/__tests__/solver.bench.test.ts` termina en <60 s sin
  variables de entorno (barrido saltado, equivalencia 200×120 corriendo contra fixture);
  con `BENCH=1` ejecuta el barrido completo; dos ejecuciones seguidas → fingerprints
  idénticos (diff vacío).
- **P5**: ejecutar 5 veces seguidas
  `pnpm vitest run src/lib/__tests__/solver.test.ts -t "50 matches"` → 5/5 verdes.
- **R1**: handler GET del dashboard con temporada completa designada < **200 ms** (medido
  con `performance.now()`, script temporal en scratchpad); respuesta byte-idéntica a la
  captura previa sobre el mismo estado; `pnpm typecheck` → 0 errores.
- **P6**: existen los 2 fixtures commiteados; `pnpm vitest run
src/lib/__tests__/solver.bench.test.ts` verde contra ellos; commit hecho.
- **R2/R3/R4**: mismo triple criterio que R1 (equivalencia de salida, <200 ms por request
  con temporada completa, typecheck verde).
- **S1**: `pnpm vitest run src/lib/__tests__/solver.test.ts` → 30/30; equivalencia
  sintética Y de jornada real verdes contra los fixtures de P6; barrido `BENCH=1` reportado
  con los 6 tamaños.
- **D1**: sección 5.
- **A1**: mismos criterios que S1 + mediana 1.309×1.279 ≤ 30 s.
- **G1**: sección 8 completa re-medida, review adversarial sin hallazgos bloqueantes.

## 4. Grafo de dependencias

```
P0 (commit T1-T8)
 ├─ Ola 1 (PARALELO, ficheros disjuntos): P1 · P2 · P3 · P4 · P5 · R1
 ├─ P6 (baselines + commit)          ← requiere Ola 1 verde
 ├─ Ola 2 (PARALELO): R2 · R3 · R4 · S1   ← S1 requiere P6; R2-R4 solo requieren el commit de P6
 ├─ D1 (medición)                    ← requiere S1
 ├─ A1 (SOLO si D1 > 30 s, fable)    ← requiere D1
 └─ G1 (gate final, fable max)       ← requiere todo lo anterior
```

R2-R4 podrían adelantarse a la Ola 1 (ficheros disjuntos), pero se colocan tras P6 para que
cada ola parta de un commit limpio y los diffs sean aislables. R1 sí va en Ola 1 por
urgencia de producto (primera pantalla del designador).

## 5. Punto de decisión medido (D1): ¿hace falta rediseño algorítmico?

- **Qué se mide**: tiempo de `solve()` para el escenario 1.309×1.279 del barrido, y de
  propina la jornada real punta vía el test de equivalencia de P6.
- **Comando** (desde `apps/web`, PowerShell):
  `$env:BENCH='1'; pnpm vitest run src/lib/__tests__/solver.bench.test.ts -t 'barrido'`
  ejecutado **3 veces**; tomar la fila `1309 x 1279` de cada salida y calcular la mediana.
- **Umbral**: mediana ≤ **30.000 ms** → objetivo cumplido, A1 NO se lanza y se pasa a G1.
  Mediana > 30.000 ms → lanzar A1 con `fable` entregándole el barrido completo de los 6
  tamaños (para ver dónde se dobla la curva) y los fixtures de fingerprint.
- Quién lo ejecuta: team-lead directamente (no un subagente), y registra los 3 números en
  este fichero.

## 6. Los 55 ficheros sin commitear: recomendación

**Commitear AHORA, antes de tocar nada (P0).** Todo T1-T8 vive solo en el working tree: sin
commit no hay baseline diffable, no hay rollback por tarea y varios subagentes en paralelo
sobre un árbol con 55 ficheros sucios es exactamente el escenario de la lección de "árbol
compartido". Propuesta de troceo (si separar cuesta más de lo que aporta, un único commit
"Importar temporada completa 25/26 (T1-T8)" es aceptable):

1. Pipeline offline (parser PDF, bases-fbm, category-mapping, generate-fbm-seed).
2. Seed + municipios + síntesis de horarios (incluye `fbm-seed.json`, ver decisión 1).
3. Separación server-only / bundle + rutas y UI (T7, fix de `/api/admin/matches`).
4. Tests y utilidades.

El bench (`solver.bench.test.ts`) se commitea tal cual está ANTES de P4 (dentro de P0):
así el rescate de P4 queda diffable.

## 7. Decisiones que necesitan confirmación del usuario

1. **Ficheros grandes en git**: ¿commitear `apps/web/src/lib/fbm-calendar/fbm-seed.json`
   (14,3 MB) y `calendario_temporada_fbm.csv` (6,9 MB) en git normal? Recomendación: SÍ a
   ambos (los tests y la reproducibilidad dependen de ellos; son texto que comprime bien;
   git lo aguanta sin LFS). Alternativa: LFS, con el coste de complicar el clone.
2. **Presupuesto de disponibilidad**: subir el tope del test a 70.000 slots (recomendado:
   el crecimiento es proporcional a las 57 fechas, no una fuga) vs recortar la generación
   de `generateSeasonAvailability`. P1 asume la opción recomendada.
3. **`/api/optimize` sin `dateFrom`/`dateTo`** resuelve la temporada COMPLETA
   (`optimize/route.ts:41-45`). Tras R3 ya no revienta el enriquecido, pero `solve()` sobre
   24.508 partidos sigue sin tener sentido operativo. Opciones: (a) default a la jornada
   actual viernes→jueves (recomendada, coherente con el resto de la app), (b) responder 400
   sin rango, (c) dejarlo y documentar. Es cambio de semántica de API: no se toca sin
   confirmación; NO está incluido en R3.

## 8. Criterios de aceptación globales de la tanda

Desde `apps/web`, todos re-medidos por G1:

1. `pnpm vitest run` → **0 rojos** (≥378 tests, 27+ ficheros) y termina en <5 min sin
   variables de entorno.
2. `pnpm typecheck` → 0 errores.
3. `pnpm verify:bundle` → verde (seed fuera del bundle cliente, sin regresión de T7).
4. Solver: mediana de 3 ejecuciones del escenario 1.309×1.279 ≤ **30 s** (procedimiento D1).
5. **Mismas asignaciones**: fixtures de fingerprint sintético y de jornada real verdes
   (idénticos a la baseline grabada en P6, pre-optimización).
6. Dashboard, reports, optimize y demo: < 200 ms por request con la temporada completa
   designada, salida equivalente a la previa.
7. Todo commiteado en commits lógicos; ningún fichero temporal de bench/captura en el repo.

---

# 9. Revisión de B1 tras la regla semana a semana (2026-07-21)

Planner: `planner-rendimiento`. La regla del usuario ("hay que designar semana a semana,
nunca una temporada completa de golpe") cambia la naturaleza de R1 y R4 y amplía R3.
**Esta sección SUSTITUYE a las filas R1, R3 y R4 de la tabla de la sección 3 y al
criterio global 6.** R2 se mantiene (con alcance ampliado, ver abajo). Todo lo que sigue
está verificado leyendo el código, con file:line.

## Hallazgos (respuestas a las 5 preguntas)

### 1. Dashboard: CONFIRMADO, es un bug de producto, no (solo) de rendimiento

- `dashboard/route.ts:12`: `export async function GET()` **sin parámetros** (ni `request`
  ni `searchParams`): no acepta jornada ni rango de ningún tipo.
- Agrega la TEMPORADA entera: `totalMatches = mockMatches.length` (`:13`), bucle de
  cobertura sobre `mockMatches` completo (`:20-32`), coste estimado sumando TODAS las
  designaciones de cada persona (`:47-50`), y disponibilidad de toda la temporada (`:38-44`).
- El frontend llama sin parámetros: `dashboard-view.tsx:81` → `fetch('/api/admin/dashboard')`.
- **Lo que ve el designador HOY en pantalla**: "24.508 partidos totales", cobertura de la
  temporada completa, una alerta roja tipo "~24.000 partidos sin ninguna asignación" y un
  "coste estimado" que es el de la TEMPORADA. Contra la spec del CLAUDE.md (Fase 2:
  "Resumen de jornada: partidos totales, cubiertos, pendientes, coste estimado") es
  incorrecto, y la regla del usuario lo confirma: nadie opera a escala temporada.
- **El arreglo primario es acotar, no indexar.** Matiz importante: el índice NO queda
  irrelevante, queda subordinado. `mockDesignations` es de temporada (122.670 entradas),
  así que incluso acotado a 1.309 partidos, resolver designaciones por partido con
  `getMockDesignationsForMatch` seguiría siendo 1.309 × 122.670 ≈ 160 M. El índice
  `Map` por request (una pasada, O(D)) sigue haciendo falta: es una línea del patrón ya
  establecido en `matches/route.ts:51-56`, no "el arreglo".
- Cuadrático ADICIONAL no listado en el mapa original: `:47-50` itera
  `mockPersons` (1.279) × `mockDesignations.filter` (122.670) ≈ 157 M para el coste.
  Con el acotado por jornada + índice por persona desaparece.

### 2. Optimize: el default a jornada entra en R3 (decisión 3 aprobada)

- Hoy: `optimize/route.ts:43-45` usa `filterMatchesByRange(mockMatches, body.dateFrom,
body.dateTo)` de `lib/optimize-range.ts:25-36`, que **sin rango devuelve la lista
  completa** (`:30`).
- La convención viernes→jueves YA existe y está en producción en la ruta matches:
  `lib/match-query.ts:30-40` (`parseMatchRange` con `?jornada=` → `getMatchdayWindow`),
  sobre `lib/matchday-availability.ts:47-57` (`getMatchdayWindow`) y `:110-116`
  (`getJornadaSaturdayForDate`, la inversa). También existe `listJornadas`
  (`match-query.ts:74-86`), que enumera las jornadas CON partidos.
- **Fuera de temporada no es hipotético, es el caso de hoy**: seed 2025-09-20 →
  2026-05-10 y hoy es 2026-07-21. `getJornadaSaturdayForDate(hoy)` daría un sábado sin
  partidos → jornada vacía → solve() sobre 0 partidos. Hace falta una regla de fallback.
- Nota de higiene: hay DOS `filterMatchesByRange` (en `optimize-range.ts` y en
  `match-query.ts`, firmas distintas). No se consolidan en esta tanda (cambio quirúrgico);
  queda anotado como cabo.

### 3. Demo: los maps del POST NO son problema; el problema es el GET y es de producto

- El POST **trunca y regenera sus propios partidos**: `demo/route.ts:298`
  (`mockMatches.length = 0`) y `:361-370` genera `numMatches` partidos sintéticos
  (**default 20**, `:280`). Los dos maps del POST (`:448-473` para alimentar el solver,
  `:721-739` para la respuesta) iteran ESOS partidos generados, no la temporada: N≈20-100
  por construcción. Indexarlos no arregla nada real.
- El único map expuesto a la temporada real es el del **GET** (`:238-256`): enriquece
  `mockMatches` ENTERO → con el seed real son 24.508 partidos enriquecidos, ~20 MB por
  response y el cuadrático completo.
- **La ruta está huérfana**: `grep 'admin/demo'` sobre TODO el repo solo aparece en
  `tasks/*.md` (documentación); ningún componente la llama. Encaja con la nota del
  CLAUDE.md: `demo-view.tsx` se eliminó en la Tanda 2.
- Footgun agravado por el seed real (ya anotado en `todo-personal-arbitral.md:12,115`):
  un POST `generate` accidental BORRA la temporada cargada en memoria (`:298`) y además
  persiste (`persistDesignations()`, `:741`). Con el seed de 324 partidos era molesto;
  con la importación real es destructivo.

### 4. Reports: CONFIRMADO como excepción legítima, con un matiz

- La agregación de temporada/mes es el propósito de la ruta (CLAUDE.md Fase 4: "coste
  total por jornada / mes / temporada"; `costByMatchday` `:126-141`, `monthlyLiquidation`
  `:169-218`). Acotarla sería romperla: **el índice es el arreglo correcto y R2 se queda**.
- Alcance ampliado de R2: además del cuadrático de `:65-66` (partidos × designaciones),
  hay DOS pasadas persona × designaciones (`:81` y `:96`, 1.279 × 122.670 ≈ 157 M cada
  una) → añadir también `designationsByPerson: Map` al mismo patrón por request.
- Matiz (NO se toca en R2, cabo nuevo): `CURRENT_MATCHDAY = 15` hardcodeado (`:21`)
  agrupa TODAS las designaciones actuales como "jornada 15", y `:139` + `:223` reportan
  `mockMatches.length` (24.508) como partidos de "la jornada actual". Con el seed
  completo esas cifras de "jornada actual" son ficción. Arreglarlo (agrupar por jornada
  real con `getJornadaSaturdayForDate`) cambia la salida y es decisión de producto:
  fuera de esta tanda, anotado como **cabo para la siguiente**.

### 5. Criterio global 6: se reescribe (ver abajo)

Byte-idéntico solo puede exigirse donde la semántica no cambia (reports). Para las rutas
acotadas el criterio pasa a ser: tiempo sobre la jornada punta + assert de acotamiento.

## Tareas reescritas

### R1' — Dashboard por jornada (corrección de producto + índice) `[sonnet, effort: high]`

Ficheros (dueño exclusivo): `src/app/api/admin/dashboard/route.ts`,
`src/lib/match-query.ts` (helper nuevo), `src/app/(admin)/dashboard/dashboard-view.tsx`
(mínimo), tests de `match-query` y de la ruta.

1. **Helper compartido** en `lib/match-query.ts` (lo consume también R3'):
   `resolveDefaultJornada(matches: MatchLike[], todayISO: string): JornadaSummary | null`.
   Regla determinista: (a) si la jornada de `todayISO` (vía `getJornadaSaturdayForDate`)
   tiene partidos → esa; (b) si no, la primera jornada FUTURA con partidos (pretemporada);
   (c) si no hay futuras, la ÚLTIMA jornada con partidos (caso de hoy: fuera de temporada
   por el final → jornada del 2026-05-09/10). `todayISO` entra por parámetro (puro y
   testeable; el `new Date()` vive solo en el route handler, nunca en el módulo).
2. **Ruta**: `GET` pasa a leer `searchParams` con `parseMatchRange` (mismo contrato que
   `matches/route.ts`: `?jornada=YYYY-MM-DD` o `?from/?to`); sin parámetros → ventana de
   `resolveDefaultJornada`. TODAS las métricas se acotan a la ventana: partidos y
   cobertura (partidos de la jornada), coste estimado (designaciones de esos partidos,
   agrupadas por persona con `getPersonTravelCost` sobre SOLO esas designaciones),
   disponibilidad (persona disponible = ≥1 slot cuya fecha, `weekStart`+`dayOfWeek`, cae
   dentro de la ventana viernes→jueves). Índices por request: `designationsByMatch` y
   `designationsByPerson` (patrón `matches/route.ts:51-56`).
3. **Respuesta**: mantiene `{ stats, alerts }` y AÑADE `jornada: { saturday, from, to }`
   (aditivo, no rompe al cliente actual).
4. **UI mínima**: `dashboard-view.tsx` muestra la jornada que se está resumiendo (una
   línea con la fecha de la ventana). Sin selector de jornada en esta tanda (cabo UI).

Aceptación: (a) tests del helper: dentro de temporada, fuera por delante, fuera por
detrás (hoy 2026-07-21 → jornada del 2026-05-09) y sábado sin partidos entre jornadas;
(b) con el seed completo designado, `GET /api/admin/dashboard` sin parámetros devuelve
`stats.totalMatches` = partidos de la jornada default (≈1.300, NUNCA 24.508) y
`jornada.saturday = '2026-05-09'`; (c) handler < 200 ms medido con `performance.now()`;
(d) suma de `covered+partiallyCovered+uncovered = totalMatches`; (e) `pnpm typecheck` y
suite en verde. La equivalencia byte a byte NO aplica (cambio de semántica intencionado).

### R3' — Optimize: default a jornada actual + enriquecido indexado `[sonnet, effort: high]`

Ficheros: `src/app/api/optimize/route.ts`, tests de la ruta. Depende de R1' (helper
`resolveDefaultJornada`), además de P6.

1. **Default aprobado (decisión 3)**: si `!partial && !body.dateFrom && !body.dateTo`,
   derivar la ventana con `resolveDefaultJornada(mockMatches, todayISO)` y usar
   `from=friday, to=thursday` en `filterMatchesByRange` (`optimize/route.ts:43-45`).
   Si el calendario está vacío (helper devuelve null) → 400 con mensaje claro.
   La UI de Asignación no cambia: ya envía rango siempre (el default solo afecta a
   llamadas API directas).
2. **Transparencia**: la respuesta añade `appliedRange: { from, to, defaulted: boolean }`
   (aditivo).
3. **Enriquecido indexado** (por request): `venuesById`, `competitionsById`,
   `designationsByMatch` para `:48-53`, y `designationsByPerson` para el
   `mockDesignations.filter` por persona de `:73` (1.279 × 122.670 ≈ 157 M hoy).
4. El comentario de `:41-45` se actualiza (ya no "sin rango = temporada completa").

Aceptación: (a) test: body sin rango → `appliedRange.defaulted === true` y ventana de la
jornada del 2026-05-09 (fuera de temporada hoy); (b) test: con `dateFrom/dateTo`
explícitos el comportamiento es EXACTAMENTE el anterior (byte-idéntico); (c) enriquecido
de la jornada punta < 200 ms medido (sin contar `solve()`); (d) los fixtures de
fingerprint del solver siguen verdes (el default no toca `solve()`, solo qué entra);
(e) typecheck y suite en verde.

### R4' — Demo: degradada a decisión de producto + arreglo mínimo del GET

**La tarea original ("3 maps indexados") era el arreglo equivocado**: dos de los tres
maps operan sobre ~20 partidos generados por el propio POST y no tienen problema de
escala; el tercero (GET) no debe devolver la temporada en absoluto. Nueva **decisión de
usuario D4**, la ruta está huérfana (sin consumidores en `src`, página demo eliminada en
Tanda 2):

- **(a) Retirarla** (borrar `api/admin/demo/route.ts`): recomendada. Elimina de paso el
  footgun de que un POST accidental borre la temporada en memoria Y en la persistencia
  JSON (`:298` + `:741`). Borrar ficheros requiere confirmación del usuario.
- **(b) Conservarla como herramienta manual**: entonces R4-lite `[sonnet, effort: low]`,
  ficheros: `src/app/api/admin/demo/route.ts`. Solo el GET: eliminar `matchesDetail` de
  la respuesta (`:238-256`, sin consumidores conocidos) o acotarlo a `?jornada=` con el
  patrón de índice. Los maps del POST NO se tocan. El footgun del wipe queda anotado
  como cabo (no se arregla en una tanda de rendimiento).

Aceptación (b): `GET /api/admin/demo` con seed completo < 200 ms y respuesta < 1 MB;
typecheck y suite en verde. Aceptación (a): ruta eliminada, `pnpm build` y suite verdes.

## Criterio global 6 (REESCRITO)

Sustituye al de la sección 8:

6a. **Rutas acotadas** (dashboard sin parámetros, optimize sin rango): < 200 ms por
request sobre la **jornada punta** con la temporada completa designada, Y assert de
acotamiento verificable: ninguna cifra ni partido de la respuesta proviene de fuera
de la ventana (dashboard: `stats.totalMatches` ≤ partidos de la jornada; optimize:
todos los `match.date` de la propuesta dentro de `appliedRange`).
6b. **Reports** (agregación legítima de temporada): < 200 ms por request con la
temporada completa designada y salida **byte-idéntica** a la previa (solo índices,
sin cambio de semántica).
6c. **Demo**: según D4 (eliminada, o GET < 200 ms y < 1 MB).

## Impacto en el grafo y en la tabla

- R1' sigue en Ola 1 (la urgencia aumenta: era bug de producto visible).
- R3' pasa a depender de **R1' + P6** (consume `resolveDefaultJornada`); sigue en Ola 2.
- R2 sigue en Ola 2 con alcance ampliado (`designationsByPerson` para reports `:81`/`:96`).
- R4' queda BLOQUEADA por la decisión D4 y FUERA del camino crítico (no bloquea S1, D1
  ni G1).

## Cabos nuevos anotados (no se tocan en esta tanda)

1. Reports agrupa todo lo actual como `CURRENT_MATCHDAY = 15` y reporta 24.508 como
   partidos de "la jornada actual" (`reports/route.ts:21,139,223`): decisión de producto
   pendiente (agrupar por jornada real).
2. Doble `filterMatchesByRange` (`optimize-range.ts` vs `match-query.ts`): consolidar
   cuando se toque una de las dos por otra razón.
3. Selector de jornada en el dashboard (UI): hoy solo se muestra cuál se resume.
4. Footgun del POST demo (wipe + persistencia) si el usuario elige conservar la ruta.

## Decisión nueva que necesita al usuario

**D4**: ¿retirar la ruta `/api/admin/demo` (recomendado: huérfana desde Tanda 2 y
footgun destructivo con el seed real) o conservarla como herramienta manual con el
arreglo mínimo del GET (R4-lite)?

---

## 10. MEDICIÓN REAL DEL SOLVER (2026-07-21, team-lead) — invalida la premisa de la tanda

Medido contra el SEED REAL (24.508 partidos, 1.279 personas activas), replicando el
enriquecido de `api/optimize/route.ts`. Jornada punta: **2025-10-25, 1.309 partidos**,
ventana viernes→jueves, **3.686 slots**. Instrumento temporal, ya borrado.

| Escenario                                                    | `solve()`                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Jornada punta, temporada SIN designar (5 procesos fríos)     | 15,07 · 16,59 · 20,77 · 26,04 · 26,87 s → **mediana 20,8 s** |
| Jornada punta, temporada YA designada (67.872 designaciones) | **2,15 s**                                                   |
| Enriquecido de la jornada (partidos + personas)              | 0,69 s                                                       |

**Conclusiones que cambian el plan:**

1. **Los "4,5-7 min" nunca se midieron.** Eran extrapolación del punto 800×480 → 61,9 s del
   barrido sintético, que además contradice al resto de la curva. La memoria
   `import-temporada-completa` debe corregirse.
2. **El objetivo <30 s ya se cumple hoy**, sin optimizar: mediana 20,8 s. Pero el peor caso
   observado (26,9 s) queda solo un 10% por debajo, con una varianza de casi 2x entre
   procesos. No hay margen cómodo.
3. **El cuadrático del bucle de designaciones NO es el cuello**: con la temporada designada
   el solve baja a 2,15 s, porque `forceExisting` deja pocos slots que resolver. El caso
   caro es la jornada VACÍA, que es justamente la operación real (designar de cero).
   El coste dominante es el bucle de candidatos, O(slots × personas).
4. **El barrido sintético de `solver.bench.test.ts` NO es representativo**: da 3,7-6,7 s para
   1.309×1.279 frente a los 15-27 s reales. `buildScenario()` no reproduce la contención real
   (disponibilidad, solapes, elegibilidad). NO usarlo como prueba del objetivo.

**Efecto sobre las tareas:**

- **A1 (rediseño algorítmico, fable) se DESCARTA.** No hay problema que rediseñar.
- **S1 se mantiene**, pero cambia de propósito: ya no rescata un fallo, construye margen
  sobre un objetivo que hoy se cumple por poco. Effort baja de `xhigh` a `high`.
- **D1 se redefine**: se mide la JORNADA REAL en proceso frío, mediana de 3, nunca el
  barrido sintético. Criterio: mediana ≤ 30 s y peor caso de los 3 ≤ 30 s.

---

# ESTADO AL CIERRE — 2026-07-21 (sesión de rendimiento) · CÓMO RETOMAR

## Lo primero que tienes que saber

**La premisa de esta tanda era falsa.** Se planificó contra un solver "de 4,5-7 min por
jornada". Medido de verdad contra el seed real (sección 10): **mediana 20,8 s**, ya por
debajo del objetivo de 30 s. No hay emergencia de rendimiento. Lo que sí apareció, y es lo
valioso, son **tres bugs de producto de alcance** que el volumen real destapó, todos de la
misma familia: pantallas del flujo de designación que agregan la temporada entera cuando el
usuario opera **semana a semana**.

## Commits de la sesión

- `22528e6` — checkpoint T1-T8 (import de la temporada completa; se commiteó a propósito con
  4 tests en rojo, para tener punto de retorno antes de lanzar subagentes en paralelo).
- `0c69448` — los 4 tests arreglados + bench convertido en arnés permanente + retirada de
  `api/admin/demo`.

Gate en ese commit: `pnpm typecheck` 0 errores, suite 384 verdes.

## ⚠️ ACTUALIZACIÓN FINAL (lo de abajo quedó obsoleto en los últimos minutos de la sesión)

**R1' se terminó y está commiteada** (`6c69634`). **No hay nada en vuelo y el árbol está
limpio.** Verificado de forma independiente: `pnpm typecheck` 0 errores y **390 tests verdes,
cero rojos** (28 ficheros). El test de `optimize-range` **también pasa**: confirmado que su
fallo era un timeout dependiente de la carga de la máquina (fallaba con 6 agentes corriendo
vitest a la vez, pasa en reposo), no un fallo real. Sigue siendo una mina latente y R3' debe
reescribirlo a la semántica nueva de todas formas.

Empieza por la tarea **2 (P6, baselines)** de la lista de abajo, no por R1.

Único punto sin verificar: `pnpm verify:bundle` NO se ejecutó (requiere `pnpm build` y el
dev server del usuario comparte `.next`). R1 metió `mockMatches` en `(admin)/layout.tsx`
como Server Component; `mock-data.ts` tiene `import 'server-only'`, que rompe el build si
algo lo arrastra al bundle cliente. **Corre `pnpm verify:bundle` con el dev server parado
antes de dar la sesión anterior por cerrada.**

## EN VUELO (OBSOLETO — ver actualización final arriba)

**R1 — dashboard por jornada.** Ficheros tocados y NO commiteados:
`api/admin/dashboard/route.ts` (+141), `lib/match-query.ts` (+30), `lib/__tests__/match-query.test.ts`,
`(admin)/dashboard/dashboard-view.tsx`, `(admin)/layout.tsx`.
Spec en la sección 9, tarea **R1'**. Estaba a medias al cerrar; su informe no llegó.

⚠️ **1 test rojo, ya diagnosticado**: `api/optimize/__tests__/optimize-range.test.ts` →
"sin rango, el comportamiento actual queda intacto (todos los partidos)". **NO lo rompió R1
ni el borrado de la ruta demo**: el test asserta la semántica ANTIGUA (sin rango = temporada
completa), así que con el seed grande lanza `solve()` sobre los 24.508 partidos y revienta el
**timeout de 90 s**. Al empezar la sesión pasaba raspando; se puso rojo cuando la máquina se
cargó con varios subagentes corriendo vitest a la vez. Es una mina latente que fallará de
forma intermitente según la carga, no un fallo puntual. Confirma por otra vía la medición de
la sección 10: si una jornada son ~21 s, la temporada entera se va muy por encima de 90 s.

**Lo arregla R3'** (tarea 4): al pasar el default a jornada, el test debe reescribirse a la
semántica nueva (`appliedRange.defaulted === true` + ventana de la última jornada). No
intentes arreglarlo antes ni subiéndole el timeout: el problema no es que sea lento, es que
resuelve algo que el usuario dice que nunca se hace.

**Primer paso de la próxima sesión**: leer el diff de R1, decidir si se termina o se
descarta (`git checkout` esos 5 ficheros), y dejar la suite en verde antes de seguir.

## Tareas pendientes, en orden

1. **Terminar R1'** (sonnet, high) — sección 9. Dashboard acotado por jornada + helper
   `resolveDefaultJornada` + cabecera del layout con temporada y jornada reales.
2. **P6 — baselines** (sonnet, low). Regenerar
   `__fixtures__/solver-fingerprint-baseline.json` con `UPDATE_BASELINE=1` sobre árbol
   limpio, y añadir el fingerprint de la jornada real. Es lo que después demuestra "mismas
   asignaciones". Hacerlo ANTES de tocar `solver.ts`.
3. **R2 — reports** (sonnet, low→high). Índice de designaciones + `designationsByPerson`
   para los dos cuadráticos persona×designaciones (`:81`, `:96`). **Ampliado por decisión
   del usuario**: arreglar también `CURRENT_MATCHDAY=15` hardcodeado (`:21,139,223`), que
   reporta los 24.508 partidos como "jornada actual". Reports SÍ agrega temporada/mes por
   diseño: ahí el índice es el arreglo correcto, no acotar.
4. **R3' — optimize** (sonnet, high) — sección 9. Default a jornada actual (aprobado) +
   enriquecido indexado. Hoy 2026-07-21 estamos FUERA de temporada (seed 2025-09-20 →
   2026-05-10), así que el caso por defecto real es "no hay jornada actual" → última con
   partidos (2026-05-09). Actualizar el test de optimize-range a la semántica nueva.
5. **S1 — factor constante del solver** (sonnet, **high**, bajado de xhigh). Cambió de
   propósito: ya no rescata un fallo, construye margen. La mediana es 20,8 s contra un
   objetivo de 30, con varianza de casi 2x entre procesos y un peor caso observado de 26,9 s.
   Los 4 puntos siguen en la sección B2. Ojo: el cuello NO es el bucle de designaciones
   (con temporada designada el solve baja a 2,15 s); es el bucle de candidatos O(slots × personas).
6. **D1 — medición** (team-lead). REDEFINIDO: jornada real en proceso frío, mediana de 3,
   **nunca el barrido sintético** (no es representativo). Criterio: mediana y peor caso ≤ 30 s.
7. **G1 — gate + review adversarial** (fable, max).

**A1 (rediseño algorítmico con fable) queda DESCARTADA.** No hay problema que rediseñar.

## Cómo medir el solver de verdad (el instrumento se borró; recrearlo así)

Test temporal en `apps/web/src/lib/__tests__/`, que replique el enriquecido de
`api/optimize/route.ts` (partidos y personas), acote a la jornada punta **2025-10-25**
(ventana viernes→jueves = 1.309 partidos, 3.686 slots) y cronometre `solve()` con
`performance.now()`. Ejecutarlo 3 veces en procesos separados y tomar la mediana. Borrarlo
después: no puede quedar en el repo.

## Cabos sueltos que NO se tocaron

- Selector de jornada en el dashboard (hoy solo mostrará la jornada por defecto).
- La cabecera de `(admin)/layout.tsx` deriva el "Jornada N" del **primer partido** de la
  ventana, no de la moda. Correcto para los datos de hoy (una ventana = una jornada), pero
  si alguna vez entran partidos con números de jornada mezclados en la misma ventana
  viernes→jueves, mostrará el del primero en vez del mayoritario. Anotado por R1.
- 10 nombres de equipo truncados de 843 (cosmético, viene del PDF de origen).
- Tarifas en € sin modelar (Fase 4, fuente localizada en Bases Generales p. 25).
- El escenario sintético de `buildScenario()` en el bench no reproduce la contención real:
  o se mejora, o se documenta que solo sirve para comparar A/B, nunca para validar objetivos.
