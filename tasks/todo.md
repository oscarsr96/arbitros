# Rendimiento del solver — diagnóstico (2026-07-23)

Estado: 📋 DIAGNÓSTICO CERRADO (solo medición y plan; sin cambios de código — la
instrumentación temporal de timing se revirtió, árbol limpio).

## 1. Magnitud real medida: los "4,5-7 min" están DESMONTADOS

Bench oficial (`apps/web/src/lib/__tests__/solver.bench.jornada-real.test.ts`, `BENCH=1`),
jornada punta REAL 2025-10-25: **1.309 partidos, 1.279 personas activas, 3.686 slots**,
temporada sin designar (peor caso: designar de cero). Tres corridas frías hoy:

| Corrida | `solve()` |
| ------- | --------- |
| 1       | 8,52 s    |
| 2       | 8,83 s    |
| 3       | 15,43 s   |

**Mediana 8,8 s, peor caso 15,4 s. El objetivo <30 s se cumple HOY en todas las
observaciones.** Trazabilidad completa del número fantasma:

- Los "4,5-7 min" **nunca se midieron**: eran extrapolación del punto sintético 800×480 →
  61,9 s (todo-import-temporada.md §0.4), invalidada ya el 2026-07-21 con medición real
  (mediana 20,8 s, §10 de ese fichero). La memoria auto (`import-temporada-completa`)
  **aún repite los 4,5-7 min y debe corregirse**.
- El "~3 s" del plan de distancias reales (tabla de abajo en este fichero) es el mismo
  bench en condiciones más favorables. La varianza entre sesiones/procesos es grande
  (3-27 s según carga de máquina), pero **ninguna medición real ha superado jamás los 27 s**.
- Los minutos reales solo aparecen al resolver la TEMPORADA entera de golpe (24.508
  partidos), que es un bug de alcance ya erradicado del flujo (se designa semana a semana,
  regla de dominio 2026-07-21), no un caso de uso.

## 2. Complejidad y hotspots (con instrumentación real, 1 corrida, ya revertida)

El bucle principal es greedy: por cada slot libre (S=3.686) recorre el roster del rol
(~645 de media) → **O(S×P) = 2.378.606 iteraciones de candidato, 188.028 candidatos
puntuados**. No hay cuadrático accidental M×P×M: los índices por persona/partido de los
micro-refactors previos ya lo eliminaron. Todo el coste restante es factor constante por
candidato. Desglose medido (corrida instrumentada de 6,61 s; secciones ≈ 5,96 s):

| Hotspot                                                                                  | Dónde                    | ms    | %    | Causa                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------ | ----- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isPersonAvailable`                                                                      | `mock-data.ts:2183-2197` | 2.956 | ~45% | ~2,3 M llamadas; cada una construye la clave string `personId\|weekStart\|dayOfWeek` y re-parsea "HH:MM" (`toMinutesOfDay`) por franja. El índice es O(1) pero el trabajo por llamada no es gratis a 2,3 M |
| `hasScheduleConflict`                                                                    | `solver.ts:224-255`      | 855   | ~13% | por candidato, `pairOverlap` contra sus asignaciones acumuladas (acotado por carga máx; factor constante, no cuadrático)                                                                                   |
| `getUnassignedReason`                                                                    | `solver.ts:919-1009`     | 791   | ~12% | 1.322 huecos × re-escaneo COMPLETO del roster del rol repitiendo todos los checks que `findBestCandidate` acaba de hacer                                                                                   |
| `maxLoad` por slot                                                                       | `solver.ts:770-773`      | 653   | ~10% | `for..in` sobre Record de 1.279 entradas UNA VEZ POR SLOT (4,7 M iteraciones); trivialmente incremental (ya previsto en B2.3 de todo-import-temporada)                                                     |
| `calculateMarginalTravelCost`                                                            | `solver.ts:283-296`      | 483   | ~7%  | 188 k llamadas con `filter`+`map`+`Set`+spread (presión de GC); correcto, solo alocación                                                                                                                   |
| resto (elegibilidad 76, km/haversine 82, sort 60, incompat 40, preámbulo 0, totalCost 4) | —                        | ~260  | ~4%  | ninguno es cuello                                                                                                                                                                                          |

## 3. Opciones

### Opción A — optimizar el solver TS (recomendada)

<30 s no solo es plausible: **ya se cumple**. Estas 4 optimizaciones construyen margen
(mediana esperada ~3-5 s, ~2-3× de speedup):

1. **Cache de disponibilidad por (fecha, hora)** → `Map<'date|time', Set<personId>>`
   construida perezosamente (pocas decenas de combinaciones por jornada; hoy 2,3 M llamadas
   → ~130 k). Ataca el 45%. Alternativa mínima: pre-parsear los minutos en las entradas
   del índice y cachear la clave por persona×fecha.
2. **`maxLoad` incremental** (mantener el máximo al incrementar `personLoadCount`). Ataca
   el 10%. Ya especificado en B2.3.
3. **`getUnassignedReason` sin re-escaneo**: acumular los contadores de rechazo DENTRO de
   `findBestCandidate` (ya visita a todos) y devolverlos cuando no hay candidato. Ataca el 12%.
4. (Menor) evitar alocaciones en `calculateMarginalTravelCost` (contar munis distintos sin
   `Set`+spread). Ataca el 7%.

Riesgo: bajo; el invariante "mismas asignaciones" está blindado por los fingerprints
(`solver-fingerprint-baseline.json` + `solver-fingerprint-jornada-real.json`). 1 y 3 no
cambian resultados; 2 exige puntuación bit a bit idéntica (verificable con el arnés).

### Opción B — microservicio Python OR-Tools (Fase 3)

Implica: servicio nuevo (FastAPI + CP-SAT), Dockerfile, deploy en Railway/Fly, serializar
~1.300 partidos + 1.279 personas + matriz de distancias por request, latencia de red, ops
y un segundo lenguaje. **Por RENDIMIENTO no se justifica: el cuello nunca fue el tamaño del
espacio de búsqueda ni la implementación TS, y el objetivo ya se cumple.** Su escenario
correcto es la CALIDAD de la solución: el greedy deja 1.322/3.686 huecos (cobertura 64,1%)
en el montaje idealizado y optimiza coste localmente; si la FBM exige cobertura/coste
globalmente óptimos o restricciones combinatorias duras (parejas, equidad multi-semana),
eso es CP-SAT, no micro-optimización. Esa decisión es de producto, no de rendimiento.

## 4. Recomendación

**Opción A, sin /council.** No hay decisión arquitectónica irreversible que tomar: el
objetivo se cumple hoy y la Opción A es reversible, barata y verificable con los
fingerprints. La Fase 3 (OR-Tools) queda aparcada hasta que la COBERTURA/calidad (no la
velocidad) sea el problema declarado; ese día sí merecería /council (introduce stack,
deploy y ops nuevos).

## 5. Desglose tentativo (Opción A)

| Tarea | Qué                                                                                                                                                          | Ejecutor         | Esfuerzo |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------- |
| A0    | Corregir la memoria `import-temporada-completa` (retirar "4,5-7 min"; solver medido en segundos)                                                             | sesión principal | trivial  |
| A1    | Cache disponibilidad por (fecha,hora) en `mock-data.ts` + invalidación junto a `invalidateAvailabilityIndex`                                                 | sonnet           | medio    |
| A2    | `maxLoad` incremental en `solver.ts` (B2.3)                                                                                                                  | sonnet           | bajo     |
| A3    | Contadores de rechazo en `findBestCandidate` → eliminar re-escaneo de `getUnassignedReason`                                                                  | sonnet           | medio    |
| A4    | Micro-alocaciones de `calculateMarginalTravelCost` (opcional, solo si A1-A3 no bastan)                                                                       | haiku            | bajo     |
| A5    | Verificación: fingerprints intactos (baseline sintética + jornada real) + mediana de 3 corridas frías del bench, criterio ≤30 s con margen (esperado ~3-5 s) | team-lead        | bajo     |

Nota: A1-A3 no deben cambiar ni una asignación; correr `BENCH=1` con baseline ANTES de
tocar nada (ya commiteada en `f008736`).

---

# Plan: Distancias reales en el solver (coords OSM en coste y feasibility) (2026-07-23)

Estado: ✅ EJECUTADO Y VERIFICADO (Fase A módulo `geo-distance.ts` + Fase B integración en el
solver + Fase C review adversarial, 3 reservas cerradas) · SIN COMMITEAR (pendiente push)

## Resultado (2026-07-23)

Decisiones A-D resueltas según la recomendación marcada (★): A3 híbrido (coste/liquidación
sigue muni→muni, sin tocar; feasibility del coche + `distanceKm` persistido pasan a
persona→pabellón), B2 haversine × 1.3, C2 Griñón con centroide manual + fallback genérico,
D1 matriz muni→muni cacheada + persona→pabellón on-the-fly.

**Fase A** — `apps/web/src/lib/geo-distance.ts`: `haversineKm`, `roadKm` (× `ROAD_FACTOR`
1.3), `getMuniCentroid` (lee `addresses-cm.json`, incluye Griñón manual), `roadKmBetween`
(persona↔pabellón, opcional, cae a `undefined` si falta o no es finita alguna coord).

**Fase B** — El solver (`apps/web/src/lib/solver.ts`) usa `roadKmBetween(persona, venue)`
para la feasibility del coche (hard-cut >30 km, penalización 15-30 km) y el `distanceKm`
reportado, con fallback a la matriz muni→muni si falta alguna coordenada. `api/optimize/
route.ts` propaga `latitude/longitude` reales de persona y venue al enriquecer. El COSTE
(`calculateDailyTravelCost`/`getPersonTravelCost`) NO se tocó: sigue siendo estrictamente
muni→muni (regla FBM de liquidación por municipio destino).

**Fase C** — Review adversarial: **LISTO CON RESERVAS, 0 bugs de producción**, 3 reservas
de test cerradas por esta sesión:

1. Guard NaN en `roadKmBetween`: `typeof === 'number'` dejaba pasar `NaN`; ahora usa
   `Number.isFinite` (helper `isFiniteCoord`) → coordenada `NaN`/`Infinity` cae a
   `undefined` (fallback muni→muni), con test en `geo-distance.test.ts`.
2. Test de coste invariante (`travel-cost-daily.test.ts`): dos personas reales del mismo
   municipio con coordenadas exactas distintas liquidan EXACTAMENTE igual el mismo
   partido vía `getPersonTravelCost` — blinda que la distancia real no se ha colado en
   la liquidación.
3. Arnés del bench (`solver.bench.jornada-real.test.ts`) realineado con
   `api/optimize/route.ts`: ya no pisa el venue con `latitude:0, longitude:0` ni omite
   las coords de la persona; ambos llevan sus coordenadas reales, igual que producción.

**Números del bench** (`solver.bench.jornada-real.test.ts`, jornada punta 2025-10-25,
1309 partidos / 1279 personas activas / 3686 slots), baseline regenerada tras el
realineamiento:

| Métrica              | Antes (arnés con venue 0,0) | Después (coords reales) | Delta             |
| -------------------- | --------------------------- | ----------------------- | ----------------- |
| totalCost            | 6047,76 €                   | 6076,70 €               | +28,94 € (+0,48%) |
| coverage             | 64,1%                       | 64,1%                   | =                 |
| coveredSlots         | 2361/3686                   | 2364/3686               | +3                |
| tiempo de resolución | ~3 s                        | 3,01 s                  | =                 |

Impacto real de las distancias reales sobre una jornada completa de temporada: marginal
(cobertura igual, coste +0,48%, +3 slots cubiertos) — el arnés anterior nunca ejercitó de
verdad la distancia real (persona sin coords → `roadKmBetween` siempre `undefined` →
fallback muni→muni), así que el delta medido ahora es la primera cifra honesta del efecto
de esta tanda.

Verificación: `geo-distance.test.ts` (11/11), `travel-cost-daily.test.ts` (11/11),
`solver.test.ts` (33/33) y `optimize-range.test.ts` (16/16, ruta que consume el enriquecido
real) verdes. `npx tsc --noEmit` en `apps/web`: limpio. Sin huérfanos.

## Plan original (contexto, decisiones y task breakdown T1-T6)

T6 (qué hacer con los `distanceKm` YA persistidos en designaciones nacidos del mock)
queda fuera de esta tanda, sin decidir — anotado para el usuario.

## Contexto verificado (2026-07-23)

Cómo se calcula la distancia HOY (todo sintético, sin datos reales):

- `getMockDistance(originId, destId)` en `apps/web/src/lib/mock-data.ts:2065-2068`: mismo
  municipio → 0; si no, lookup O(1) en `distanceIndex` (Map construido en 2059-2063 desde
  `mockDistances`); par desconocido → **fallback fijo de 35 km**.
- `mockDistances = generateDistances()` en `mock-data.ts:224-241`: matriz muni→muni
  **sintética**: coordenadas x/y en km desde Madrid colocadas a mano (`MUNI_COORDS`,
  58 municipios; los 27 ampliados salen de una regresión lineal x=f(lon), y=f(lat),
  R²≈0,98), distancia euclídea × **1.3 (factor carretera)**, redondeada a entero, mínimo 1.
- Tabla `distances` de Drizzle (`lib/db/schema.ts`) solo la usa la ruta DB legacy
  `lib/travel-cost.ts:18-42` (estimación por partido, "probablemente no usada en modo mock").
- **NO existe haversine en el repo** (ni en `apps/web` ni en `scripts/geo/*.mjs`): habría
  que escribirla (~10 líneas).

Coordenadas reales disponibles (trabajo geo previo):

- **Personas**: `referee-roster.ts:57-58` (`latitude?/longitude?`), pobladas por
  `pickRealAddress` (`referee-roster.ts:1764-1789`) desde `lib/data/addresses-cm.json`
  (57 municipios con `centroid` + `points`). **Griñón (muni-041) NO está en el JSON** →
  sus personas quedan con lat/lon `undefined` (rama 1780-1788, centroide `undefined`).
- **Venues**: `lib/data/venue-coords.json`, 394/394 con lat/lon; 89 con `approx: true` →
  flag `coordsApprox` al mergear en `mock-data.ts:1473-1483`.
- **Ojo**: `EnrichedPerson` y `EnrichedMatch.venue` (`lib/types.ts:21-32, 87-105`) NO
  llevan lat/lon; si se elige granularidad persona→pabellón hay que extender tipos y
  enrichers.

## Consumidores de distancia (grep completo, qué necesita cada uno)

| Consumidor                                          | Dónde                                                                                                                                                                                             | Tipo de distancia                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Solver: feasibility coche (hard >30, soft 15-30)    | `solver.ts:805-808, 825`                                                                                                                                                                          | DIRECTA persona→pabellón (hoy muni persona→muni venue)                      |
| Solver: diagnóstico "sin coche >30km"               | `solver.ts:975`                                                                                                                                                                                   | persona→pabellón                                                            |
| Solver: `distanceKm` reportado en asignaciones      | `solver.ts:423`                                                                                                                                                                                   | persona→pabellón                                                            |
| Solver: viaje entre partidos consecutivos (solape)  | `solver.ts:218` → `overlap.ts:76`                                                                                                                                                                 | venue→venue (muni→muni entre pabellones)                                    |
| `calculateDailyTravelCost` (liquidación real/día)   | `mock-data.ts:2104-2118` (línea 2111)                                                                                                                                                             | muni persona→muni venue; la regla FBM agrega POR MUNICIPIO destino distinto |
| `calculateMockTravelCost` (badges picker + persist) | `mock-data.ts:2085-2097`; se persiste como `distanceKm` en `api/admin/designations/route.ts:77`                                                                                                   | persona→pabellón sería lo honesto (es orientativo)                          |
| `calculatePersonTravelCost`/`getPersonTravelCost`   | `mock-data.ts:2123, 2150`; dashboard `api/admin/dashboard/route.ts:150`, reportes `api/admin/reports/route.ts:158,190`, persons/me, admin/persons                                                 | vía `calculateDailyTravelCost` (muni→muni)                                  |
| Panel verificación pre-publicación                  | `schedule-conflicts.ts:88-207`; cliente construye lookup desde `/api/catalog` (`asignacion-view.tsx:105-122`, fallback 35 replicado)                                                              | venue→venue                                                                 |
| `getDepartureInfo` (hora de salida)                 | `utils.ts:37-43`; consume el `distanceKm` PERSISTIDO en la designación (`designation-card.tsx:66`, `match-detail-row.tsx:151`)                                                                    | persona→pabellón (hoy hereda el muni→muni guardado)                         |
| Tests que fijan la semántica                        | `travel-cost-daily.test.ts`, `solver.test.ts` (mock local), `solver.bench.test.ts`, `overlap.test.ts`, `schedule-conflicts.test.ts`, `fbm-seed-municipality-coverage.test.ts` (asume fallback 35) | varios                                                                      |

## Mini-spec

Sustituir la geometría sintética (x/y a mano × 1.3) por distancias derivadas de las
coordenadas reales OSM, sin cambiar la regla de negocio FBM (coste por persona y día,
un trayecto por municipio de destino distinto, fijo diario si no sale de su municipio).
El contrato `getMockDistance(muniA, muniB)` y `/api/catalog` se conservan salvo que la
decisión A elija persona→pabellón, en cuyo caso se añade una función nueva junto a la
actual (no se rompe la firma consumida por overlap/schedule-conflicts, que es muni→muni
por naturaleza: viaje entre pabellones).

## Decisiones abiertas (elige el usuario; recomendación marcada con ★)

**A) Granularidad**

- A1 persona→pabellón en todo: máxima precisión, pero contradice la regla FBM de
  liquidación (que agrega por MUNICIPIO destino) y obliga a extender tipos/enrichers.
- A2 solo recomputar muni→muni con centroides reales de `addresses-cm.json`: cambio
  mínimo, mantiene firma y semántica; pierde precisión intra-municipio (Madrid capital
  es enorme y seguiría siendo 0 km).
- ★ A3 híbrido: liquidación/coste marginal sigue muni→muni (centroides reales, regla FBM
  intacta); feasibility del coche + `distanceKm` persistido + hora de salida pasan a
  persona→pabellón (es donde la precisión importa de verdad).

**B) Métrica**

- B1 haversine pura: gratis y offline, pero infraestima carretera ~1,2-1,4x → el
  hard-cut de 30 km se volvería MÁS permisivo que hoy.
- ★ B2 haversine × factor carretera 1.3 (calibrable con pares conocidos): gratis,
  offline, y mantiene la escala del mock actual (que ya usa ×1.3), mínima perturbación
  del hard-cut.
- B3 Google Distance Matrix API: carretera real, pero de pago (~6,5 USD la matriz),
  necesita key y seed; dejar como mejora futura solo para la matriz muni→muni (32k pares).

**C) Fallback sin coordenada (Griñón, muni-041)**

- C1 caer al mock actual (x/y sintético): mezcla dos métricas, comportamiento raro.
- ★ C2 centroide manual de Griñón añadido a `addresses-cm.json` (+ flag approx): 1 dato,
  unifica métrica; red de seguridad genérica en código: sin coord persona → centroide de
  su municipio → si tampoco, fallback 35 km actual.
- C3 excluir personas sin coord: pierde árbitros reales, descartada salvo veto del usuario.

**D) Cache vs on-the-fly**

- ★ D1 matriz muni→muni precalculada a la carga del módulo (58×58, como hoy: el Map
  `distanceIndex` no cambia) + persona→pabellón on-the-fly (haversine es ~1µs, comparable
  al lookup; el bench del solver decide si hace falta memoizar por par persona|venue).
- D2 precalcular también persona×venue por jornada: solo si el bench (T5) detecta
  regresión; añade complejidad sin evidencia aún.

**Aviso transversal**: cambiar la métrica MUEVE el hard-cut del coche (30 km) y la
penalización 15-30: personas hoy feasibles pueden dejar de serlo y viceversa. T5 mide el
delta antes de dar por bueno el cambio.

## Criterios de aceptación verificables

- Pares conocidos dentro de rango carretera real (test unitario nuevo): Madrid–Alcalá
  de Henares 25-35 km, Madrid–Móstoles 15-25 km, Madrid–Villarejo de Salvanés 40-58 km,
  Alcalá–Torrejón 8-15 km.
- Invariantes de `getMockDistance` conservados: simetría, mismo municipio = 0, munis
  distintos ≥ 1, par desconocido → fallback 35.
- Suite existente verde (`npm run test`): travel-cost-daily, solver, overlap,
  schedule-conflicts, fbm-seed-municipality-coverage, geo-data (los tests de coste usan
  `getMockDistance` para construir el esperado, así que son robustos al cambio de valores).
- Persona de Griñón: obtiene coste finito y feasibility coherente según la decisión C
  (test explícito con una persona sin lat/lon).
- Bench del solver (`solver.bench.test.ts`): sin degradación >10% del tiempo actual.
- Comparativa antes/después en una jornada de referencia (script one-off en scratchpad):
  histograma de distancias, nº de candidatos feasibles por partido y coste total de la
  propuesta; se revisa con el usuario si el delta de cobertura es material.

## Task breakdown (tras decidir A-D)

- **T1** (sonnet, low): módulo `lib/geo-distance.ts`: haversine + `ROAD_FACTOR`,
  centroides de municipio leídos de `addresses-cm.json` (+ Griñón según C), tests
  unitarios con los pares conocidos.
- **T2** (sonnet, low): `generateDistances()` pasa a construir `mockDistances` desde
  centroides reales (contrato de `getMockDistance` y `/api/catalog` intactos); revisar
  el redondeo a entero y el mínimo 1.
- **T3** (fable, high, solo si A1/A3): feasibility coche + `distanceKm` reportado con
  persona→pabellón: extender `EnrichedPerson`/`EnrichedMatch.venue` con lat/lon, tocar
  `solver.ts:423, 805, 975` y los enrichers de las rutas API; recalibrar el hard-cut si
  el histograma lo pide.
- **T4** (sonnet, low): fallback C implementado (dato de Griñón + red de seguridad en
  `pickRealAddress` + test).
- **T5** (sonnet, low): verificación de regresión: suite completa + bench + script
  comparativo antes/después (histograma, feasibility, coste por jornada).
- **T6** (fable, low): decidir qué pasa con los `distanceKm` YA persistidos en
  designaciones (nacieron del mock): ¿recalcular al vuelo o dejar los históricos? Afecta
  a `getDepartureInfo` y badges; proponer al usuario.

## Fuera de scope (anotado)

- Google Distance Matrix (B3) como seed de la tabla `distances` de Drizzle: fase DB real.
- Persistencia en Supabase de la matriz: el modo mock sigue siendo la fuente de la verdad.
- Cambiar la regla FBM de liquidación (por municipio destino): NO se toca.

---

# Plan: Aplicar propuesta con forceExisting=false — reemplazo de designaciones existentes (2026-07-23)

Estado: ✅ EJECUTADO Y VERIFICADO (fix de borrado + T1/T2 completos + review adversarial fable APROBADO CON
RESERVAS, reservas de test ya cerradas) · integridad de datos del flujo semanal real

## Resultado (2026-07-23)

Fix de borrado en el POST en lote (`api/admin/designations/route.ts`): `replaceMatchIds` elimina las
designaciones `pending` de los partidos reemplazados ANTES de insertar (protege `notified`/`completed`, que
nunca se tocan). T1 (tests de contrato) y T2 (fix) completados.

Reservas de test del juez adversarial (fable) cerradas: se añadieron los 4 casos que faltaban a
`route.test.ts` (matchId en `replaceMatchIds` sin designaciones previas → `removed=0`; `completed` sobrevive
al replace igual que `notified`; `replaceMatchIds: []` → no-op; el borrado se refleja en el JSON persistido
tras la operación). Suite del fichero: **23/23 verdes**. `npx tsc --noEmit` en `apps/web`: limpio.

**SEGUIMIENTO PENDIENTE (no bloqueante)**: edge semántico detectado por el juez — al aplicar sin forzar, un
partido con una designación `pending` manual cuyo slot el solver deja `unassigned` mientras asigna otro slot
del mismo partido → el `pending` se borra sin reposición y la cobertura baja. Coherente con "sin forzar" y
visible en la propuesta, pero podría querer un guard/aviso. Sin fix por decisión de alcance quirúrgico.

Nota: la suite completa da 1 fallo pre-existente ajeno (`dashboard route.test.ts`, umbral <200ms), flaky solo
bajo carga concurrente, no relacionado con este fix.

## Diagnóstico verificado contra el código (corrige el reporte previo)

El diagnóstico de las reviews estaba MEDIO desfasado:

- **El POST SÍ deduplica y SÍ corta la sobre-cobertura** desde el commit `7726818`
  ("designations: rechazar duplicados y sobre-cobertura en el POST"):
  `checkDesignationConflict` (`apps/web/src/lib/designation-validation.ts:29-45`) rechaza
  persona repetida en el partido y exceso por rol, invocada en
  `apps/web/src/app/api/admin/designations/route.ts:66-75`; el modo lote valida contra el
  array VIVO (ve lo insertado antes en el mismo lote). Hoy NO se producen filas duplicadas
  ni sobre-cobertura por partido/rol.
- **La causa raíz REAL y sin fix es el borrado ausente**: nadie elimina las designaciones
  que la propuesta reemplaza.
  - Cliente: `handleApplyProposal`
    (`apps/web/src/app/(admin)/asignacion/asignacion-view.tsx:359-398`) solo POSTea inserts
    (366-377); ninguna llamada DELETE.
  - Servidor: el modo lote (`apps/web/src/app/api/admin/designations/route.ts:104-136`)
    solo inserta vía `createDesignation` (120-127); no existe semántica de reemplazo.
- **Síntoma actual** con forceExisting=false sobre una jornada con designaciones previas:
  cada asignación nueva que choca con una vieja cae en `conflicts` → aplicación A MEDIAS
  (mezcla incoherente vieja+nueva), visible solo como toast "X aplicadas, Y fallidas".
  Las viejas nunca se van.
- **Hallazgo colateral del solver (fuera de alcance, NO tocar en esta tanda)**: con
  forceExisting=false el solver mete TODAS las designaciones existentes en
  `assignmentsByPerson` (`solver.ts:442-450`), así que el titular actual "solapa consigo
  mismo" (`hasScheduleConflict`, `solver.ts:230-238`) y nunca puede ser re-propuesto para
  su propio partido. Lado bueno: garantiza que la propuesta tampoco re-usa titulares en
  partidos solapados → borrar sus designaciones al aplicar es SEGURO. Lado malo: las
  propuestas "desde cero" excluyen a los titulares (subóptimas). Anotado para una tanda
  futura del solver.

## Mini-spec

Comportamiento correcto al aplicar una propuesta:

- **forceExisting=false**: para el conjunto de partidos que la propuesta cubre (matchIds
  con ≥1 asignación `isNew`), BORRAR primero las designaciones existentes con
  `status !== 'completed'` (misma regla que `DELETE /api/admin/designations/[id]`) y
  DESPUÉS insertar las nuevas, todo en el MISMO request (atómico en servidor; el modo lote
  existe precisamente porque N fetches del cliente eran frágiles). Partidos en scope sin
  asignación en la propuesta conservan las suyas.
- **forceExisting=true**: comportamiento actual intacto (rellena huecos libres, conserva
  existentes).
- **Invariante post-aplicación**: por partido y rol, designaciones ≤ needed; ninguna
  persona dos veces en el mismo partido (lo garantiza `checkDesignationConflict`; los
  tests lo fijan como invariante).

Diseño cerrado:

1. `lib/types.ts`: añadir `forceExisting: boolean` a `Proposal` (el cliente no debe
   depender del toggle del store al aplicar: puede haber cambiado tras generar).
2. `api/optimize/route.ts:125-132`: estampar `forceExisting: parameters.forceExisting` en
   cada propuesta.
3. `api/admin/designations/route.ts` (modo lote): campo opcional
   `replaceMatchIds: string[]`. Si viene y no es array de strings → 400. Antes del bucle
   de inserts: eliminar de `mockDesignations` toda designación con
   `matchId ∈ replaceMatchIds` y `status !== 'completed'`; responder `removed: number`
   además de applied/failed/conflicts. `persistDesignations()` una sola vez al final (ya
   está).
4. `asignacion-view.tsx` `handleApplyProposal`: si `!activeProposal.forceExisting`, enviar
   `replaceMatchIds = [...new Set(newAssignments.map(a => a.matchId))]`; toast con
   "N reemplazadas" si `removed > 0`.

## Criterios de aceptación verificables

- Test de reproducción: partido con cobertura completa (2/2 árbitros) + lote de 2 árbitros
  distintos SIN `replaceMatchIds` → `applied=0`, las 2 viejas siguen (documenta el "a
  medias" actual); CON `replaceMatchIds` → viejas fuera, nuevas dentro, exactamente
  `refereesNeeded` designaciones del rol y JSON persistido coherente. Rojo antes del fix,
  verde después.
- `completed` sobrevive al replace; el insert que choca con ella cae en `conflicts`
  (visible, no silencioso).
- Invariante global tras cualquier combinación (con/sin replace, con completed en medio):
  ningún partido supera `needed` por rol; nadie dos veces en el mismo partido.
- Regresión forceExisting=true: lote SIN `replaceMatchIds` = comportamiento actual; los
  tests existentes de `route.test.ts` siguen verdes sin modificarlos.
- `pnpm typecheck` 0 · suite completa verde (407 actuales + nuevos).

## Task breakdown

**T1. Tests de contrato del reemplazo (TDD, rojos primero)** · ejecutor: `sonnet` · esfuerzo: `low`
(a) `apps/web/src/app/api/admin/designations/__tests__/route.test.ts` (infra ya montada:
FBM_DATA_DIR temporal, fixture de partido propio, beforeEach que vacía `mockDesignations`).
(b) Nuevo describe "POST lote con replaceMatchIds" con los casos de los criterios de
aceptación + `replaceMatchIds` mal tipado → 400.
(c) Aceptación: los tests nuevos fallan contra el código actual por el motivo esperado
(replace ignorado), el resto de la suite intacta.

**T2. Fix: replace en lote + `Proposal.forceExisting` + cliente** · ejecutor: `sonnet` · esfuerzo: `high` · depende de T1
(a) Ficheros: `api/admin/designations/route.ts`, `lib/types.ts`, `api/optimize/route.ts`,
`(admin)/asignacion/asignacion-view.tsx` (4 ficheros, según diseño 1-4).
(b) Surgical: NO tocar `solver.ts` ni `designation-validation.ts`; el hallazgo colateral
del solver queda anotado, no se corrige.
(c) Aceptación: T1 en verde + criterios globales.

**T3. Verificación adversarial independiente** · ejecutor: `fable` · esfuerzo: `low` · depende de T2
(a) Re-medir el criterio con VOLUMEN REAL, no fixtures: sobre el seed completo (24.508
partidos), designar una jornada, generar propuesta forceExisting=false, aplicarla vía el
route handler y comprobar el invariante global (≤ needed por partido/rol, nadie duplicado,
nadie en dos partidos solapados vía `getPublishConflicts`).
(b) Grep de otros llamadores del POST lote (hoy solo `asignacion-view.tsx`) y del contrato
de respuesta (`applied/failed/removed`).
(c) Aceptación: invariante en verde con datos de producción; veredicto LISTO / NO LISTO.

Lecciones a inyectar en los handoffs (de `tasks/lessons.md`):

- Verificar el informe del subagente re-midiendo el criterio de aceptación de forma
  independiente; los verdes con datos de juguete no dicen nada del caso real.
- Si la premisa de un plan es un dato (aquí, un diagnóstico), el primer paso es
  re-verificarlo (este plan ya corrigió medio diagnóstico contra el código real).

## Decisión abierta (para el usuario, no bloquea T1)

- ¿El replace debe borrar también designaciones `notified` (ya publicadas)? Provisional:
  SÍ (misma regla que `DELETE /[id]`, que solo protege `completed`). Si se prefiere
  proteger lo publicado, el filtro pasa a `status === 'pending'` (una línea en T2).

---

# Plan: Terminar la geolocalización real (direcciones de personas + coords de venues) (2026-07-22)

Estado: ✅ EJECUTADO Y VERIFICADO (gate + review adversarial fable) · SIN COMMITEAR (pendiente push) · project-claude · tipo ampliar+modificar · tamaño M · ejecutor: MIXTO (fetch mecánico en background + sesión cableado/tests + fable review)
Decisiones del usuario (AskUserQuestion 2026-07-22): (1) alcance = **A+B** (direcciones de personas Y coordenadas de venues); (2) los fetch externos (Overpass/Nominatim) los corre la sesión en background.

## Fase 4 — resultado (2026-07-22)

Gate: **typecheck 0 · 407 tests / 0 fallos (2 skipped) · build OK 38s** (sin violar server-only; First Load JS
compartido 87,5 kB pese a 1,6 MB de addresses-cm.json → server-only mantiene los datos en servidor). Un fallo
transitorio de test bajo carga concurrente (no reproducido en la corrida limpia, no era de los tests de geo).

Cobertura final: 57/58 municipios con direcciones reales (16.213 puntos, 0 CP fuera de la CM); solo **Griñón**
sin cobertura (Overpass da "sin relation" para ese nombre) → sus ~2-5 personas quedan con lat/lon undefined,
anotado. Venues: **394/394 con coordenada** (305 geocode real + 89 centroide `approx`), 0 fuera de la CM.

Review adversarial fable → **LISTO CON RESERVAS, 0 blockers**. Reservas aplicadas por la sesión:

- [IMPORTANTE] flag `approx` se perdía en el lookup de venues → propagado a `MockVenue.coordsApprox` (para el
  futuro coste por coordenadas: distingue centroide de geocode exacto).
- [MENOR] 3 puntos con CP 13200 (Ciudad Real, tagging OSM) → guard "CP debe empezar por 28" en el build + test.
- [MENOR] tests de venues laxos (umbral 97%) → endurecidos a exacto (394/394, 0 fuera CM) + test de coordsApprox.
- [MENOR] `byName` last-wins silencioso → warn en nombre duplicado.
- [COSMÉTICO] comentario contradictorio en referee-roster (server-only) → corregido.
- No aplicadas (anotadas): municipalities.json es copia manual de mockMunicipalities (deriva asumida, doc en
  README); PRNG shift materializa la orfandad ya declarada de designations.json; `eval` en extract-venues
  (one-shot, offline). Griñón sin resolver.

Cambios: `point-in-polygon.mjs` (cosido de anillos), `fetch-boundaries-bulk.mjs`/`fetch-overpass.mjs` (CM_BBOX),
`build-address-dataset.mjs` (CP guard), nuevo `merge-venue-coords.mjs`, `referee-roster.ts` (pickRealAddress +
lat/lon + server-only), `mock-data.ts` (MockVenue lat/lon/coordsApprox + lookup), nuevos datasets
`lib/data/{addresses-cm,venue-coords}.json`, nuevo `geo-data.test.ts` (12 tests), `README.md`, `.gitignore`.
Caché OSM (`scripts/geo/cache/`, MB) fuera del repo. **Pendiente: commit + push (ofrecido al usuario).**

## Progreso y hallazgos (2026-07-22, sesión en curso)

Fetch completados: geocode venues 394/394 (305 real + 89 fallo→centroide). Boundaries/raw 57/58 (solo
**Griñón** sin resolver: Overpass da "sin relation" para ese nombre; municipio diminuto → fallback anotado).

**BUG 1 (grave) — cosido de anillos en `point-in-polygon.mjs` (CORREGIDO)**: `extractOuterRings` trataba cada
`way` miembro `outer` como anillo cerrado, pero OSM parte el límite en varios `way` que hay que COSER por
extremos. Sin coser, municipios multi-way daban ~0 direcciones dentro del polígono (16 munis a 0; Alcorcón
inside=5 de 1142). Fix = cosido por extremos coincidentes. Tras el fix: 16→1 muni a 0 (solo Griñón), invariante
`inside≈raw` cumplido (Alcorcón 5→973).

**BUG 2 (crítico) — boundary del municipio equivocado (CORRIGIENDO)**: la query Overpass por nombre sin
restricción geográfica casaba homónimos: **muni-001 Madrid→Madrid IOWA**, muni-021 Pinto→Argentina,
muni-033 Arroyomolinos→Cáceres. Contaminaba centroide Y direcciones (raw se fetch-eaba del bbox equivocado).
Detectado por el test de bbox de venues (42 venues de Madrid caían en Iowa vía centroide). Fix = añadir
`CM_BBOX=39.8,-4.7,41.2,-3.0` a las queries de boundary en `fetch-boundaries-bulk.mjs` y `fetch-overpass.mjs`;
borrados los 3 boundary+raw contaminados; re-fetch en curso (bg `bgticmztq`). Guard permanente añadido a
`geo-data.test.ts`: todo centroide y todo punto del dataset DEBE caer en la CM.

Datasets consumibles generados (se regeneran tras el re-fetch): `apps/web/src/lib/data/addresses-cm.json`
(~1,5 MB) y `venue-coords.json` (31 KB, 394/394 venues con coord). Cableado hecho: `MockVenue.latitude/longitude`

- lookup en `mockVenues` (mock-data.ts); `referee-roster.ts` ya consumía addresses-cm. typecheck 0. Tests:
  `geo-data.test.ts` nuevo (direcciones reales + coords venues + integridad CM). Falta: re-fetch → rebuild →
  `pnpm test` verde → gate/build → review fable → commit. Griñón: 1 muni sin cobertura (fallback), anotado.

## Contexto verificado (2026-07-22)

Trabajo iniciado hoy y dejado a medias/sin commitear. Diff sin commitear: `referee-roster.ts` (+63/-10,
ya cableado a `addresses-cm.json` + campos `latitude?/longitude?` en `MockPerson`), untracked
`apps/web/src/lib/data/addresses-cm.json` (vacío `{}`) y `scripts/geo/` (pipeline).

Pipeline offline (una vez, cacheado, reanudable) y su estado al empezar:

| Paso                   | Script                              | Salida                                            | Estado inicial        |
| ---------------------- | ----------------------------------- | ------------------------------------------------- | --------------------- |
| Extraer venues         | `extract-venues.mjs`                | `venues-all.json` (394 = 108 demo + 286 fbm-seed) | ✅                    |
| Municipios             | (input)                             | `municipalities.json` (58)                        | ✅                    |
| Límites admin          | `fetch-boundaries-bulk.mjs`         | `cache/boundaries/<id>.json`                      | 55/58 (faltan 3)      |
| **Nodos de dirección** | `fetch-overpass.mjs addresses`      | `cache/raw/<id>.json`                             | **0/58 — bloqueo**    |
| Construir dataset      | `build-address-dataset.mjs`         | `apps/web/src/lib/data/addresses-cm.json`         | `{}` (por raw vacío)  |
| Geocode venues         | `geocode-venues.mjs`                | `cache/nominatim/<id>.json`                       | 243/394 (~62%)        |
| Consumir en roster     | `referee-roster.ts#pickRealAddress` | direcciones+coords reales por persona             | cableado, recibe `{}` |

- `pickRealAddress(muni, rand)`: elige un punto real DENTRO del municipio (calle+nº+CP+lat/lon de OSM);
  red de seguridad si el muni no tiene puntos → calle fabricada + **centroide** del muni (nunca lat/lon
  vacío). El municipio NO se reshufflea: es input, se decide antes (madrid 45% / resto). Determinista por
  la PRNG sembrada → sin riesgo de hidratación (lección: datos generados deterministas).
- Seed de venues: `fbm-calendar/fbm-seed.json` (.venues, 286) + `demoVenues` (108, literal TS en
  mock-data.ts). **NO existe** merge de coords geocodificadas de vuelta al seed → construirlo (Track B).
- Consumidores actuales de `lat/lon`: solo `optimize/route.ts`, `solver.bench.jornada-real.test.ts`,
  `db/schema.ts`. Payoff inmediato bajo (el coste usa `getMockDistance` muni→muni, no coords). Se cierra
  igualmente por coherencia del dato y para no dejar trabajo a medias.

## Task breakdown

### Track A — direcciones reales de personas

**A1. Completar boundaries (3 municipios que faltan)** · mecánico (background) · esfuerzo: `low`
(a) `node scripts/geo/fetch-boundaries-bulk.mjs`. (b) Aceptación: `cache/boundaries/` = 58/58, o anotar los
que Overpass no resuelva por nombre (caerán a fallback de centroide nulo → los cubre A3).

**A2. Fetch de nodos de dirección (raw)** · mecánico (background) · esfuerzo: `low`
(a) `node scripts/geo/fetch-overpass.mjs addresses` (bbox por municipio, ~1,2s + reintentos c/u).
(b) Aceptación: `cache/raw/` con ≥55 ficheros; anotar municipios fallidos.

**A3. Construir `addresses-cm.json` + revisar cobertura** · sesión · esfuerzo: `medium`
(a) `node scripts/geo/build-address-dataset.mjs`; leer el informe de cobertura (municipios con 0
direcciones). (b) Decisión: el código ya cae a centroide; si demasiados munis quedan a 0 se valora fase 3
(fallback `highway` con nombre) o se acepta el centroide y se anota. (c) Aceptación: `addresses-cm.json`
poblado (>0 KB, la mayoría de munis con `points`); verificar que los muni ids del roster (`mockMunicipalities`)
están cubiertos por el dataset (reportar % de cobertura del roster, no solo de los 58).

**A4. Verificar consumo en referee-roster** · sonnet · esfuerzo: `medium`
(a) `referee-roster.ts` (+ test). (b) typecheck 0; test nuevo: toda persona generada tiene `address` que
termina en el nombre de su municipio y `latitude/longitude` definidos (real o centroide); determinismo
(doble generación idéntica). (c) Aceptación: `pnpm test` verde; sin persona con lat/lon `undefined` salvo
municipios sin boundary (anotados).

### Track B — coordenadas reales de venues

**B1. Terminar geocode de venues (243→394)** · mecánico (background) · esfuerzo: `low`
(a) `node scripts/geo/geocode-venues.mjs` (reanuda por caché). (b) Aceptación: `cache/nominatim/` = 394;
anotar el nº de fallos (venues sin resultado tras 3 intentos) para el fallback de B3.

**B2. Merge de coords al seed (script nuevo)** · sonnet (diseño de integración) · esfuerzo: `high`
(a) Nuevo `scripts/geo/merge-venue-coords.mjs` + salida de datos consumible por la app.
(b) Lee `cache/nominatim/*`; escribe `latitude/longitude` en cada venue. Decisión de integración (evitar
editar 108 literales a mano): emitir un `apps/web/src/lib/data/venue-coords.json` (`{venueId: {lat, lon}}`)
que mock-data haga lookup al construir `mockVenues` (demo + fbm-seed), en vez de mutar `fbm-seed.json`
(14 MB) ni los literales. `MockVenue` ya tiene `latitude?/longitude?` (verificar en types) → poblarlos por
lookup. (c) Aceptación: typecheck 0; todo venue de `mockVenues` con lat/lon; el import de temporada sigue OK.

**B3. Fallback de venues sin geocodificar** · sesión · esfuerzo: `low`
(a) En el lookup de B2: venue sin coord → centroide de su municipio (de `addresses-cm.json`), nunca vacío.
(b) Aceptación: 0 venues con lat/lon `undefined`; los que caen a centroide, anotados.

**B4. Tests de venues** · sonnet · esfuerzo: `low`
(a) Test: `mockVenues` todos con lat/lon; los geocodificados dentro del bbox de su municipio (sanity
check grosso). (b) Aceptación: `pnpm test` verde.

### Cierre

**G1. Higiene del repo + README** · sesión · esfuerzo: `low`
(a) `scripts/geo/README.md` (orden del pipeline, ya referenciado por un comentario del código);
`.gitignore` += `scripts/geo/cache/` (dumps OSM intermedios, MB) conservando scripts + inputs pequeños +
las salidas consumibles (`addresses-cm.json`, `venue-coords.json`). (b) Aceptación: `git status` limpio de
blobs de caché; el pipeline se puede regenerar siguiendo el README.

**G2. Gate + review adversarial (Fase 4)** · PLANNER (fable, juez) · esfuerzo: `max`
(a) Todo el diff. (b) `pnpm typecheck` + `pnpm test` (+ build cuando el user pare el dev :3001). Review:
determinismo/hidratación (referee-roster con dataset real), surgical changes, huérfanos, que no se
comprometan blobs enormes al repo, cobertura de municipios/venues, fallback siempre pobla lat/lon.
(c) Aceptación: criterios globales. Commit + push.

## Criterios de aceptación globales

- `addresses-cm.json` poblado; toda persona generada con dirección real (o centroide) y lat/lon definidos.
- `venue-coords.json` (o equivalente) integrado; todo `mockVenue` con lat/lon (real o centroide).
- `pnpm typecheck` 0; `pnpm test` verde; sin mismatch de hidratación; determinismo (doble generación =).
- `scripts/geo/cache/` fuera del repo; scripts + salidas consumibles + README commiteados.
- Ni `fbm-seed.json` ni los 108 literales `demoVenues` editados a mano (integración por lookup).

## Fuera de scope (anotado)

- Recalcular la matriz de distancias con coords reales (el solver sigue con `getMockDistance` muni→muni).
- Mapa/visualización de coords en la UI (no hay consumidor hoy; se deja el dato listo).

---

# Plan: Simplificar y mejorar designaciones — Tanda 1 (bug + persistencia + Guardar) (2026-07-12)

Estado: ✅ EJECUTADO Y VERIFICADO (gate estático + review adversarial fable) · SIN COMMITEAR · project-claude · tipo modificar · tamaño L · ejecutor: MIXTO (sonnet impl T1-T4 + fable review T5)

## Fase 4 — resultado (2026-07-12)

Gate: **pnpm typecheck 0 · 173 tests verdes** (172 + 1 nuevo de descarte de huérfanas). `build` NO ejecutado a
propósito (dev server del usuario en :3001; build+dev comparten `.next`). Verificación runtime end-to-end
(visibilidad cruzada + durabilidad a reinicio) = MANUAL del usuario (no puedo levantar un 2º server sin
chocar con el suyo ni mutar sus designaciones reales del piloto).

Ejecución: T1 (store+persistencia+instrumentation) y T3 (fuga substitution-panel) en paralelo (sonnet); luego
T2 (persist en 5 rutas) y T4 (botón Guardar) en paralelo (sonnet); T5 gate + review adversarial (fable) →
**LISTO CON RESERVAS, 0 blockers**. Reservas corregidas por la sesión:

- **[IMPORTANTE] Huérfanas tras reinicio**: `ensureDesignationsHydrated` ahora descarta designaciones cuyo
  `matchId`/`personId` no resuelva (Sets sobre `mockMatches`/`mockPersons`). Test nuevo.
- **[IMPORTANTE] Fichero corrupto = pérdida silenciosa**: `persistDesignations` escribe atómico (tmp+rename);
  si el JSON no parsea al hidratar, se respalda a `.bak` en vez de sobrescribirlo al primer persist.
- **[MENOR] `mockCompetitions` y `mockAlertLog`** añadidos al store globalThis (misma clase de bug).
- **[MENOR] `handleSave`** con try/catch (toast de error en fallo de red) + botón deshabilitado/spinner al guardar.
- No corregidas (anotadas): recomputación eager de `generateSeasonAvailability` en HMR (preexistente, solo
  coste, resultado descartado); redundancia cosmética en `.gitignore`.

### Verificación runtime (2026-07-12) — ✅ CONFIRMADA POR EL USUARIO

Tras reiniciar el dev server, el usuario confirma "ya están los partidos designados": las 90 designaciones
persisten en `apps/web/.fbm-data/designations.json` (22,7 KB) y salen CONSISTENTES en todas las rutas
(verificado por API con server respondiendo: matches=90 embebidas, dashboard=18 cubiertos, designations=90
estable). El temido caveat de transición NO se materializó: los datos estaban en disco y se rehidrataron al
reiniciar. Bug original resuelto de punta a punta.

Nota operativa observada: bajo ráfaga de peticiones pesadas (matches 292 KB + dashboard/persons con 1279
personas) el dev server de un solo hilo se satura y deja de responder (HTTP 000). Es peso PREEXISTENTE de las
páginas admin, no lo introduce Tanda 1 (el SSR renderiza limpio, incl. el botón Guardar). Candidato a quick-win
de Tanda 2: virtualizar el picker de 1279 personas y/o paginar/filtrar partidos en servidor.

## Pendiente Tanda 1

- `pnpm build` cuando el usuario pare el dev server (build+dev comparten `.next`).
- Commit ✅ **765106e** (un commit del conjunto verificado; arrastró trabajo previo entrelazado en mock-data / designations-route / asignacion-view / substitution-panel / proposal-selector, imposible separar limpio sin romper compilación) + **push a origin/main** ✅.

---

## Plan original (referencia)

Decisiones del usuario (AskUserQuestion 2026-07-12):

1. **Persistencia** = `globalThis` (array compartido por todas las páginas/rutas) **+ fichero JSON** en disco (sobrevive a reinicios/HMR). NO se migra a Supabase ahora (fase aparte).
2. **Posiciones** = slots nombrados que elige el designador; se guarda la posición en la designación. Mesa = **Anotador / Cronometrador / 24"**. (→ Tanda 2, feature B.)
3. **Entrega** = bug + persistencia PRIMERO (esta Tanda 1), verificar y entregar; luego B-F (Tanda 2).

## Diagnóstico (confirmado por 3 agentes de exploración)

- **Bug A "las designaciones publicadas no salen en el resto de páginas"**: causa raíz = `mock-data.ts` NO usa `globalThis`. En `next dev`, cada HMR/ruta fría reevalúa el módulo y crea su propia copia aislada de `mockDesignations = []`. El portal las ve porque su ruta estaba "caliente" al publicar; las demás vieron un array recién reseteado. Estructuralmente TODAS las páginas top-level (dashboard, partidos, personal, asignación, reportes, calendario) leen vía `fetch` a rutas API que usan el array vivo → con un único array compartido, todas lo ven. (`mock-data.ts:1567,1587,1496`; INITIAL\_\* y `resetMockData` en `mock-data.ts:2417-2442`.)
- **Fuga secundaria**: `substitution-panel.tsx:10,56` importa `mockDesignations` ESTÁTICO en un `'use client'` (siempre `[]` en el bundle cliente) para el contador `matchesAssigned` de cada candidato → dato erróneo. El resto del panel usa la prop `match.designations` (correcto).
- **Footgun (no es el bug de hoy, se ANOTA)**: `api/admin/matches/import-csv-fbm/route.ts:53` hace `mockDesignations.length = 0` al reimportar el calendario → borra designaciones publicadas. Se documenta; no se cambia el comportamiento en Tanda 1.
- **Feature F "Guardar"**: hoy toda designación ya se persiste en memoria al crearse (`status:'pending'`); no hay estado "borrador" separado (`pending`=trabajo en curso Y guardado; `notified`=publicado). Lo que falta es DURABILIDAD (memoria se pierde al reiniciar) y el botón explícito. El fichero JSON aporta la durabilidad; el botón, la confirmación.

### Límite conocido (documentar al usuario)

El fichero JSON persiste en el disco LOCAL (piloto en local, dev :3001). En Vercel el FS es efímero/solo-lectura → la durabilidad de producción real requeriría la migración a Supabase (opción diferida). Para el piloto local es suficiente.

## Diseño de la persistencia

1. **`globalThis` singleton** en `mock-data.ts`: respaldar los arrays MUTABLES y sus snapshots `INITIAL_*` en un contenedor `(globalThis as any).__fbmMockStore ??= {}` con patrón `??=`, de modo que HMR/ruta fría reutilicen SIEMPRE la misma instancia.
   - Arrays: `mockDesignations` (crítico, con estado de usuario) + por consistencia `mockMatches`, `mockPersons`, `mockAvailabilities`, `mockMatchdayAvailabilities`, `mockIncompatibilities`, `mockCourts`, `mockVenues`.
   - **INITIAL\_\* también en el store** (`??=`): deben capturar el SEED en la primera evaluación, no el estado mutado de una reevaluación posterior (si no, `resetMockData()` restauraría datos ya mutados). Verificarlo con test.
   - Seguridad cliente: `globalThis` existe en el navegador; el bundle cliente obtiene su propia copia vacía, inocuo (nadie del cliente debe depender de `mockDesignations`; la única fuga se corrige en T3). NO importar `fs` en `mock-data.ts` (se importa desde componentes cliente).
2. **Módulo server-only `lib/designation-persistence.ts`** (`import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'`; solo lo importan rutas API, nunca componentes cliente):
   - `ensureDesignationsHydrated()`: idempotente vía flag en `__fbmMockStore`. Si no hidratado y existe el fichero → parsea y hace `mockDesignations.push(...revividos)` (revivir `notifiedAt`/`createdAt` a `Date`). En proceso nuevo (reinicio) el flag está limpio → carga de disco; en HMR el flag persiste en globalThis → no recarga (evita doble carga).
   - `persistDesignations()`: `writeFileSync` del array a JSON (fechas → ISO). Ruta `apps/web/.fbm-data/designations.json` (crear dir si falta).
3. **Hidratación al arrancar**: `apps/web/src/instrumentation.ts` con `register()` que llama `ensureDesignationsHydrated()` una vez al iniciar el server (evita esparcir la llamada por 13 rutas). Si `instrumentation` diera problemas en esta versión de Next 14 → fallback: llamar `ensureDesignationsHydrated()` al inicio de las rutas que leen designaciones. Añadir `experimental.instrumentationHook` en `next.config` si la versión lo requiere.
4. **Persistir tras cada mutación** (solo ~4 rutas, server-only): `POST /api/admin/designations` (crear + batch apply, tras el/los push), `POST /api/admin/designations/publish` (tras mutar status), `DELETE /api/admin/designations/[id]` (tras splice), `api/admin/demo/route.ts` (reset/push) e `import-csv-fbm` (tras el wipe, para que disco = memoria). `resetMockData()` vive en mock-data (no fs) → la ruta que lo llama persiste después.
5. **`.gitignore`**: añadir `apps/web/.fbm-data/`.

## Task breakdown (Tanda 1)

**T1. Store `globalThis` + módulo de persistencia + hidratación** · ejecutor: `sonnet` · esfuerzo: `xhigh`
(a) `mock-data.ts` (arrays + INITIAL\__ al `__fbmMockStore` con `??=`); nuevo `lib/designation-persistence.ts`; nuevo `apps/web/src/instrumentation.ts`; `next.config._`si hace falta el flag;`.gitignore`.
(b) Aceptación: typecheck 0; `mockDesignations`es la MISMA referencia entre dos`require`/evaluaciones del módulo (test); `INITIAL_DESIGNATIONS`sigue siendo el seed tras mutar el array (test de`resetMockData`verde);`mock-data.ts`NO importa`node:fs`(grep); hidratar dos veces no duplica (idempotente, test); persistir → el JSON existe con los datos y revive fechas a`Date`(test del módulo persistencia con fichero temporal).
Justificación etiqueta: bien especificado pero sutil (identidad de arrays, orden de captura de INITIAL, seguridad de bundle cliente, idempotencia) y el fallo = pérdida de estado (el dolor del usuario) →`sonnet xhigh`, escalar a fable si falla 2 veces.

**T2. Cablear persist en las rutas mutadoras** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `api/admin/designations/route.ts`, `.../publish/route.ts`, `.../[id]/route.ts`, `api/admin/demo/route.ts`, `api/admin/matches/import-csv-fbm/route.ts`.
(b) Llamar `persistDesignations()` tras cada mutación; en demo/reset persistir tras `resetMockData()`. `route.ts` solo exporta handlers/config (lección lessons.md); helpers en `lib/`. Comentario `// FOOTGUN` en el wipe del csv-import (comportamiento intacto, solo documentado).
(c) Aceptación: typecheck 0; smoke API (§gate) demuestra visibilidad cruzada y fichero escrito.

**T3. Quitar la fuga estática de `substitution-panel.tsx`** · ejecutor: `sonnet` · esfuerzo: `low`
(a) `components/substitution-panel.tsx`.
(b) `matchesAssigned` de cada candidato se deriva de la prop `matches` (`matches.flatMap(m=>m.designations).filter(d=>d.personId===person.id).length`), no del import estático `mockDesignations`. Eliminar el import huérfano.
(c) Aceptación: 0 imports de `mockDesignations` en componentes cliente (grep); el contador refleja las designaciones reales; typecheck 0.

**T4. Botón "Guardar designaciones" + indicador de guardado** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `asignacion-view.tsx`; nuevo `api/admin/designations/persist/route.ts` (POST → `persistDesignations()` → `{ saved: n }`).
(b) Botón "Guardar" en la barra de acciones junto a "Publicar"; al pulsar, POST al endpoint y toast "Guardado ✓ HH:MM"; texto sutil "Se guarda automáticamente al asignar" para dejar claro que el trabajo está a salvo toda la semana. Publicar sigue siendo la acción de jueves (pending→notified). NO se inventa un estado nuevo del enum: `pending`=borrador guardado, `notified`=publicado.
(c) Aceptación: el botón guarda y confirma; publicar sigue funcionando; typecheck 0; la semántica borrador/publicado queda clara en la UI.

**T5. Gate + review adversarial (Fase 4)** · ejecutor: PLANNER (fable, juez) · esfuerzo: `max`
(a) Todo el diff de Tanda 1.
(b) `pnpm typecheck` + `pnpm test` + `pnpm build`. Smoke runtime por API (rutas calientes, patrón de lessons.md): crear designación vía `POST /api/admin/designations` → leerla desde OTRA ruta (`GET /api/admin/matches` y `/api/admin/dashboard`) → visible (prueba el array compartido); verificar `apps/web/.fbm-data/designations.json` escrito con los datos; publicar → status notified en todas las lecturas. Restart real = manual (el usuario reinicia y confirma que persisten). Review adversarial: identidad de arrays, captura de INITIAL, seguridad del bundle cliente (sin `fs` en cliente), idempotencia de hidratación, huérfanos, surgical changes.
(c) Aceptación: ver criterios globales.

## Criterios de aceptación globales (Tanda 1)

- `pnpm typecheck` 0; `pnpm test` verde (existentes + nuevos de T1); `pnpm build` OK.
- Una designación creada es visible en dashboard, partidos, personal, asignación, reportes y portal SIN necesidad de "calentar" rutas (array único compartido).
- El fichero JSON se escribe al crear/publicar/borrar; al reiniciar el server las designaciones siguen ahí (verificación manual del usuario).
- `substitution-panel` ya no lee el array estático; 0 imports de `mockDesignations` en cliente.
- Botón "Guardar" operativo; "Publicar" intacto.
- Sin regresión en `resetMockData()` ni en el índice de disponibilidad.

## Fuera de scope de Tanda 1 (anotado)

- Footgun del wipe en import-csv-fbm (solo documentado).
- Migración a Supabase (diferida por decisión del usuario).
- Features B-F → Tanda 2 (abajo).

---

## Esbozo Tanda 2 (features B-F; se detalla y verifica con el usuario tras entregar Tanda 1)

- **B. Nick + categoría + posición en cada partido**: añadir campo de posición a la designación (árbitro: `principal|auxiliar`; anotador: `anotador|cronometrador|24`), propagar `nick`/`refereeLevel` en `getMockDesignationsForMatch` + `EnrichedDesignation.person` (hoy no lo hacen, `mock-data.ts:1894-1913`, `types.ts:60-68`); slots nombrados en el picker (`assignment-slot.tsx`, `person-picker.tsx`, `asignacion-view.tsx`); render en las 3 tarjetas (match-detail-row, assignment-slot, demo-view). Reutilizar el precedente `person-card.tsx:60-82` (nick «…» + badge categoría). Considerar conectar la matriz `referee-eligibility.ts` (principal/auxiliar) ya existente para validar/sugerir.
- **C. Nicks de una palabra sin determinantes**: reescribir `buildNickPool()` (quitar compuestos "X DE Y" y artículos EL/LA) y los 9 demo (`mock-data.ts:1341-1477`). TENSIÓN: ~200 palabras sueltas < 1279 personas y sin sufijos → ampliar el pool a ≥1300 palabras sueltas curadas (topónimos + apodos sin artículo + más), determinista.
- **D. Disponibilidad visible en Asignación**: badge positivo/negativo de disponibilidad en los slots YA asignados (`assignment-slot.tsx` hoy no muestra nada) usando `isPersonAvailable`; el picker ya marca "No disponible" (negativo).
- **E. Panel de verificación pre-publicación**: por persona designada, comprobar (1) dentro de disponibilidad; (2) sin solape real ni hueco insuficiente entre partidos (usar MINUTOS + duración de partido, no hora entera; umbrales: <2h aviso, <1h30 error, solape=error) con EXCEPCIÓN "mismo pabellón + misma categoría → mismo cuerpo arbitral esperado (OK)". Sustituye/extiende `PublishDialog`. Necesita una función de solape NUEVA correcta (la actual `hasTimeOverlap` es no-op en cliente y trunca a hora). Umbrales a confirmar con el usuario.
- **F. (parcial en Tanda 1)** El botón Guardar se hace en Tanda 1; en Tanda 2 solo se pule si hiciera falta.

---

# Fix: "Aplicar propuesta no designa" — hidratación rota + robustez batch (2026-07-12)

Estado: ✅ EJECUTADO Y VERIFICADO (sin commitear) · project-claude · tipo modificar · tamaño M · ejecutor: sesión
Decisión usuario (AskUserQuestion 2026-07-12): "Hidratación + robustez batch"; simplificación DESPUÉS.

## Resultado (Fase 4)

Gate: typecheck 0 · 163 tests verdes. Build NO ejecutado a propósito (dev server del usuario corriendo en
:3001; build+dev comparten `.next` → riesgo de corromper su sesión). Verificación de runtime por API (lo que
importa): batch aplica 90 → **18/18 partidos cubiertos, 90 designaciones persistidas y visibles en
/api/admin/matches**; re-aplicar el mismo lote → applied=0, conflicts=90 (idempotente, sin duplicados/
sobre-cobertura); modo unitario intacto (404 en datos inválidos). Consola: el warning de `<button>` anidado
DESAPARECIÓ tras T1.

- **T1 (ProposalSelector) ✅**: tarjeta `<button>`→`<div role="button" tabIndex onKeyDown>`. Elimina el HTML
  inválido (botón anidado) que rompía la hidratación del panel de propuestas. Verificado en consola.
- **T2 (batch) ✅ con corrección de diseño**: PRIMER intento con ruta NUEVA `/api/admin/designations/apply`
  → reportaba applied=90 pero NO persistía (0/18) y re-aplicar daba applied=90 otra vez. Causa: una ruta
  NUEVA y "fría" en Next dev re-evalúa `mock-data` y tiene su propio `mockDesignations` AISLADO del que lee
  `/api/admin/matches` (lección de lessons.md). Fix: borrar la ruta nueva y **plegar el batch en la ruta
  EXISTENTE `/api/admin/designations`** (ya caliente, comparte módulo con el lector). Rama por
  `assignments[]` = lote; `{matchId,personId,role}` = unitario. Cliente postea el lote a esa ruta.
- **T3 (AdminSidebar) — NO es bug de código**: el mismatch `<aside>` vs `<div>` NO se toca. El HTML del SSR
  emite `<div class="...flex min-h-screen"><aside ...>` correcto (verificado por curl) → el mismatch lo
  induce una **extensión del navegador** que inyecta DOM antes de la hidratación (el harness lleva la
  extensión de Claude; por eso las congelaciones de 30s+ en dev). En un navegador limpio no ocurre. Cambiar
  AdminSidebar sería a ciegas y contra surgical-changes. Anotado.
- Limitación de verificación: el navegador de test se congela por esa extensión → no pude hacer el clic
  end-to-end; verificado por API en su lugar. El usuario puede recargar /asignacion (hot-reload) y reintentar.

### Seguimiento: "Publicar designaciones" deshabilitado (mismo día)

Reporte usuario: "ahora sí sale bien [aplicar] pero no deja Publicar designaciones".

- **Causa**: `asignacion-view.tsx` calculaba `pendingDesigs`/`personsToNotify` (y el "asignados" del
  picker) desde el `mockDesignations` IMPORTADO, que en el cliente es la copia estática del seed (siempre 0)
  → el botón `disabled={pendingDesigs === 0}` quedaba siempre deshabilitado. La lista de partidos sí reflejaba
  el server (via fetchMatches); solo esos contadores leían la copia stale.
- **Fix ✅**: derivar `pendingDesigs`/`personsToNotify` de `matches.flatMap(m => m.designations)` (estado real
  del server, `EnrichedDesignation` trae `status`+`personId`). Igual para la carga del picker (`assignedByPerson`
  precomputado O(designaciones), evita O(matches×personas) en el hot path). Eliminado el import huérfano
  `mockDesignations`.
- **Verificado por API (rutas calientes)**: aplicar → pending 90 → botón habilitado; publicar → "90 publicadas",
  notified 90 / pending 0 → botón deshabilitado. typecheck 0 · 163 tests.
- **Fragilidad de Next dev observada (PREEXISTENTE, no la introduce el fix)**: el primer hit de una ruta FRÍA
  (p. ej. `publish` recién usada) re-evalúa `mock-data` y puede PERDER las mutaciones en memoria (en el test,
  publicar en frío borró los 90). Una vez caliente persiste. Mitigado calentando las rutas en el server del
  usuario. **Candidato para la fase de simplificación/robustez: guardar los arrays mock en `globalThis`
  (patrón singleton Next dev) para que HMR/recompilación no los resetee — eliminaría toda esta clase de bugs
  que ya está en lessons.md y ha mordido 2 veces hoy.**

Pendiente: commit; que el usuario reconfirme Publicar en su navegador; build cuando pare el dev server;
proponer el singleton `globalThis` en la fase de simplificación.

## Diagnóstico (systematic-debugging, reproducido)

- Backend OK (probado por API con 25/09–02/10, 1ª Nac + Junior ORO): optimizar → aplicar 90 → 90/90
  aplicadas, 18/18 partidos cubiertos y persistidos. `POST /api/admin/designations` + `GET
/api/admin/matches` comparten el módulo mock en :3001.
- En navegador, "Aplicar seleccionada" NO lanza ningún POST a `/api/admin/designations` (traza de red) →
  0 designaciones. Reproducido 2x. La pestaña se congela 30s+.
- Causa raíz (consola): `ProposalSelector` renderiza `<button>` DENTRO de `<button>` (tarjeta = botón,
  con la "X" de borrar y el toggle de "slots sin cubrir" como botones internos) → HTML inválido → el
  parser cierra el botón exterior antes de tiempo → hidratación de React falla → re-render de toda la raíz
  en cliente, con jank/congelación y clics perdidos. 2º foco: `AdminSidebar` (`<aside>` vs `<div>`),
  page-wide, preexistente.
- "Nuevas" = nº de designaciones nuevas (isNew) que crearía la propuesta. Las 3 propuestas NO son idénticas
  por dentro (P1≠P2≠P3), solo comparten métricas visibles (coste≈189,8 · 100% · 90 · tiempo).

## Tareas

**T1. ProposalSelector: quitar botones anidados (raíz)** · sesión · esfuerzo: high
(a) `components/proposal-selector.tsx`: tarjeta exterior `<button>` → `<div role="button" tabIndex={0}>`
con onClick + onKeyDown (Enter/Space). Botones internos intactos.
(b) Aceptación: 0 `<button>` dentro de `<button>`; consola sin warning de nested button; seleccionar
propuesta funciona; clics fiables.

**T2. Endpoint batch + wire cliente (robustez)** · sesión · esfuerzo: high
(a) Nuevo `app/api/admin/designations/apply/route.ts`: POST `{ assignments: {matchId,personId,role}[] }`,
valida cada una con `checkDesignationConflict` contra `mockDesignations` VIVO (ve las que va insertando
→ sin duplicados/sobre-cobertura intra-lote), inserta las válidas, devuelve `{applied, failed, conflicts}`.
(b) `asignacion-view.tsx#handleApplyProposal`: una sola llamada al batch (en vez de N POST secuenciales),
luego clearAllProposals()+fetchMatches(), toast con applied/failed. Manual/sustitución/re-optimizar
siguen usando el POST unitario (no se tocan).
(c) Aceptación: aplicar propuesta = 1 request; designaciones creadas; feedback correcto.

**T3. AdminSidebar hidratación** · sesión · esfuerzo: medium
(a) Diagnóstico empírico tras T1 (consola en recarga limpia). Fix quirúrgico si la causa es clara; si
resulta ambiental (extensión/primer paint), reportar honesto sin parche ciego.

**T4. Verificar (Fase 4)** · sesión · esfuerzo: high
(a) `pnpm typecheck` + `pnpm test` (designation-validation + suite) + `pnpm build`.
(b) Smoke navegador: reset → optimizar → aplicar → designaciones creadas, slots pintados, sin congelación,
consola sin el warning de nested button.

---

# Follow-up: fix duplicados / sobre-cobertura en el POST de designaciones (2026-07-12)

Estado: ✅ EJECUTADO Y VERIFICADO · tamaño S · ejecutor: sesión.
Origen: hallazgo IMPORTANTE del 2º review de F2 (preexistente): el POST de `api/admin/designations` hacía
`push` sin validar → la misma persona podía quedar dos veces en un partido (duplicado) y un rol podía superar
lo necesario (sobre-cobertura), sobre todo al aplicar una propuesta con "Mantener existentes" desactivado.
Fix (raíz, en el endpoint → protege manual, sustitución, re-optimizar y aplicar): nuevo helper puro
`lib/designation-validation.ts#checkDesignationConflict(existing, match, personId, role)` (persona ya en el
partido → conflicto; rol ya completo → conflicto), invocado en el POST que devuelve **409** con motivo.
8 tests unitarios del helper. Gate: typecheck 0 · 163 tests · build OK. Los flujos por defecto solo rellenan
huecos vacíos → no se ven afectados. Pendiente aparte (no corrupción, UX): que aplicar con forceExisting=false
BORRE las reemplazadas en vez de que los POST sobrantes fallen con 409.

---

# Follow-up: default de Asignación = jornada completa viernes→jueves (2026-07-12)

Estado: ✅ EJECUTADO Y VERIFICADO · tamaño S · ejecutor: sesión.
Contexto: el usuario confirmó que el piloto real tiene partidos ENTRE SEMANA (lunes→jueves), menos que en
finde. La jornada se mantiene viernes→jueves (el usuario descartó cambiarla a jueves→miércoles). El default
de rango en Asignación era solo `[sábado, domingo]`, así que los partidos entre semana quedaban fuera de la
designación por defecto y el tope "máx. partidos por jornada" (carga acotada al rango, decisión I2) no
abarcaba la jornada completa.
Cambio: `asignacion-view.tsx` — el default pasa a la jornada COMPLETA vía `getMatchdayWindow(sábado)` →
`[window.friday, window.thursday]`. Eliminado el helper huérfano `addOneDay`. Gate: typecheck 0 · build OK
(`/asignacion` compila). El coste NO se toca (es por día, independiente de la jornada). Sin commitear aún → se
commitea junto con este follow-up.

---

# Plan: Coste REAL por día en el solver (marginal por persona/día) (2026-07-12)

Estado: ✅ EJECUTADO Y VERIFICADO (sin commitear) · project-claude · tipo modificar · tamaño M · ejecutor: MIXTO (sonnet impl + fable review)
Elección del usuario (AskUserQuestion 2026-07-12): "Coste real por día" como primer eje de mejora del modelo
de designaciones.

## Fase 4 — resultado

Gate: **pnpm typecheck 0 · 154 tests verdes · build OK**. Archivos: `solver.ts`, `solver.test.ts`, `CLAUDE.md`.
Ejecución: subagente sonnet (T1+T2), doc por la sesión (T3), review adversarial fable (T4).

- **Bug encontrado por la sesión (no lo cazaron los tests del subagente) — CORREGIDO**: al permitir coste
  marginal NEGATIVO (día que pasa de fijo en casa a salida barata), la selección con rng usaba umbral
  multiplicativo `base·1.05`, que con `base<0` vaciaba el filtro → `topCandidates[0]` undefined → slot sin
  cubrir (solo con numProposals≥2 + costWeight alto). Fix: umbral aditivo `base + 0.05·|base|` + test de
  regresión.
- **F1 (importante, review fable) — CORREGIDO**: con `forceExisting=false` + designaciones existentes en
  rango, `metrics.totalCost` contaba doble el slot (existente descartada + sustituta). Fix: el total se
  regrupa sobre `assignments` (la solución propuesta), no sobre `assignmentsByPerson` (acumulador de solape).
  Test de regresión añadido.
- **F4 (menor, latente) — CORREGIDO**: la penalización sin-coche ×2 podría premiar viajes largos si en el
  futuro un marginal saliera negativo con directKm>15 (hoy imposible con las tarifas actuales). Guarda
  `Math.max(0, normalizedCost)`.
- **F2 (importante) — CORREGIDO (profundizar, decisión usuario)**: el coste marginal (y `metrics.totalCost`)
  ahora ven el día COMPLETO de cada persona, incluidas designaciones cuyo partido cae FUERA del scope
  (otra categoría o fuera del rango). `solver.ts` resuelve fecha+municipio de esas designaciones vía
  `mockMatchById`+`getMockVenue` y las añade al acumulador de coste (NO a la carga, que sigue acotada al
  scope por I2, ni a la salida `assignments`). `totalCost` = coste INCREMENTAL sobre el día real:
  `dia(base ∪ propuesto) − dia(base)`, con `base` = municipios fuera de scope. El modo `partial` de
  `/api/optimize` va por `solve` (matches=[1 partido]) → queda cubierto por F2 automáticamente. Test F2
  añadido; I2 y F1 siguen verdes (sin regresión). Decisión de coherencia: la CARGA se mantiene acotada al
  scope (I2), solo el COSTE ve el día completo (el coste es dinero y debe ser exacto; la carga es un tope
  configurable por tanda). Anotado como asimetría deliberada.
- Menores anotados (no bloquean): F3 (coste de designación de persona inactiva se excluye del total, caso
  raro); F5 (el test replica `calculateDailyTravelCost` a mano → puede quedar obsoleto si cambia la regla;
  la regla real está testeada aparte en `travel-cost-daily.test.ts`); F6 (badge de propuesta puede mostrar
  marginal negativo "-1,22 €" — cosmético, el total regrupa bien); F7 (`solvePartial` sigue siendo código
  muerto preexistente, actualizado por coherencia).

### Review adversarial de F2 (fable, 2º pase, post-commit 27c07fa) → LISTO CON RESERVAS

Mecanismo F2 confirmado correcto (out-of-scope robusto ante datos inconsistentes; `totalCost` incremental
independiente del orden; carga in-scope respetada; modo partial —el caso que motivaba F2— cubierto; umbral
rng aditivo y F1 confirmados). Reservas, ninguna bloquea, ninguna corregida (menores/cosméticas/preexistentes):

- **[IMPORTANTE, PREEXISTENTE, ajeno a este commit] → ticket aparte**: aplicar una propuesta con
  `forceExisting=false` solo hace POST de las nuevas designaciones sin borrar las reemplazadas, y el POST no
  deduplica (`asignacion-view.tsx:296`, `api/admin/designations/route.ts`). Como el solver no marca las
  existentes cuando `!forceExisting`, puede re-proponer a la MISMA persona en el MISMO partido → designación
  duplicada / sobre-cobertura al aplicar, y el `totalCost` mostrado diverge del real en BD. No lo introduce
  esta tanda.
- [MENOR, nuevo F2, presentación] `metrics.totalCost` puede ser NEGATIVO (base fuera de scope = día 100% en
  casa con fijo, la propuesta añade un away barato → incremental < 0) y `proposal-selector` lo muestra como
  "Coste" con `toFixed(0)` ("-0 €"/"-1 €"), sin indicar que es incremental. Correcto matemáticamente, feo.
- [MENOR, nuevo F2] los badges de las existentes MANTENIDAS dependen del orden de `mockDesignations` (su
  marginal se calcula al insertar) → suma de badges ≠ `totalCost` (que sí es orden-independiente). No afecta a
  la optimización.
- [MENOR] `solvePartial` NO recibió F2 y sigue sin llamadores (código muerto): borrar o revivir con F2.
- [MENOR, mixto] venue con municipio sin resolver ('') → 35 km fallback = 9,10 € fantasma y exclusión de
  sin-coche in-scope (preexistente); dos venues '' distintos el mismo día se dedupen como uno (nuevo, solo con
  datos sucios; el seed FBM resuelve todos).
- [COSMÉTICO] metrics no recalculadas en modo partial (cliente no las consume); solape doblemente comprobado;
  `find` O(D×M)/O(D×P) por designación (preexistente, aceptable a la escala actual).

## Problema

El solver (`apps/web/src/lib/solver.ts`) optimiza un coste que la FBM no paga:

- `calculateTravelCost` (solver) = `3€` fijo mismo-muni + `km × 0,10`, **POR PARTIDO**. Hardcodeado.
- Regla real (`calculateDailyTravelCost`, mock-data) = **POR PERSONA Y DÍA**: si hay salida a otro municipio →
  solo km × **0,26** (un trayecto por municipio destino distinto, sin fijo); si todo el día es en el municipio
  propio → fijo por día (Madrid 3 / resto 2).
- Consecuencias: (1) tarifa km errónea (0,10 vs 0,26); (2) el "óptimo" del solver ignora la **sinergia por
  día** (dar a una persona varios partidos el mismo día y mismo municipio destino es casi gratis tras el primer
  trayecto, pero el solver le cobra km por cada uno); (3) el badge de la propuesta (solver, 0,10) diverge del
  badge del picker manual (`calculateMockTravelCost`, 0,26).
- Revisa D1 del plan archivado (se dejó el solver por-partido a propósito); decisión del usuario lo supersede.

## Modelo de coste marginal (contrato)

Para puntuar un candidato en un slot, el coste es el **incremento** que añade a la liquidación del día de esa
persona, no un fijo por partido:

```
munisBefore = municipios de venue ya asignados a ESA persona en ESA fecha (designaciones en scope + propuestas
              ya hechas en este solve)
marginal(home, munisBefore, v) = calculateDailyTravelCost(home, munisBefore ∪ {v})
                               − calculateDailyTravelCost(home, munisBefore)
```

Propiedades que da gratis (mismo día / mismo municipio destino → 0; primer trayecto away → km×0,26; día
solo-casa → fijo 3/2; primer away en un día que era solo-casa → el fijo desaparece y se paga km):

- 2º partido misma fecha y mismo municipio away que el 1º → marginal **0**.
- Partido en el municipio propio en un día con salida away → marginal **0**.
- Primer partido away del día → **km(home,v) × 0,26**.
- Día 100% en municipio propio → **fijo** (Madrid 3 / resto 2), una sola vez.

### Reglas de implementación (para no rederivar)

1. **Fuente de la verdad**: usar `calculateDailyTravelCost` de `mock-data.ts` (no reimplementar la fórmula) para
   que solver y liquidación no puedan divergir. Añadirla al `vi.mock('../mock-data')` de `solver.test.ts` con
   una implementación local fiel + las constantes `TRAVEL_RATE_PER_KM/FLAT_MADRID/FLAT_OTHER`.
2. **Tracking**: añadir `venueMuniId` al `Assignment` interno del solver. Enrutar TODA alta de asignación
   (existentes cargadas por `forceExisting` + picks nuevos) por un único acumulador `Map<personId, Map<fecha,
string[]>>`; calcular el marginal contra el acumulado ANTES de añadir el nuevo municipio. Cuidado con no
   contar dos veces las existentes (hoy se tocan en el bucle de carga L199-217 y en el de `forceExisting`
   L220-242): una sola vía de acumulación.
3. **Feasibility usa distancia DIRECTA, no marginal**: el hard-cut sin coche `>30 km` y la penalización sin
   coche `15-30 km ×2` usan `getMockDistance(home, v)` (la persona conduce igual aunque el marginal sea 0). La
   penalización ×2 multiplica el coste marginal usando el umbral sobre la km directa.
4. **`ProposedAssignment.travelCost`** = coste marginal del pick; **`distanceKm`** = km directa al venue
   (0 si mismo municipio). El badge de la propuesta mostrará el incremento real (un 2º partido del día puede
   salir 0,00 €, que es lo correcto).
5. **`metrics.totalCost`** = total real agrupado por persona/día sobre TODAS las asignaciones en scope
   (existentes + nuevas), calculado al final regrupando con `calculateDailyTravelCost` (orden-independiente),
   NO sumando los `travelCost` por asignación. Así el titular = euros reales.
6. Aplicar el mismo modelo en `solve`, en el bloque `forceExisting` y en `solvePartial`.
7. Manual picker (`calculateMockTravelCost`) se deja como estimación por-partido (fuera de scope; se anota la
   divergencia de método: picker estima por partido, solver optimiza el marginal real).

## Task breakdown

**T1. Coste marginal en el solver** · ejecutor: `sonnet` · esfuerzo: `xhigh`
(a) `apps/web/src/lib/solver.ts`.
(b) Eliminar `calculateTravelCost` (3€/0,10). Añadir `venueMuniId` al `Assignment` interno y el acumulador
único por persona/fecha. Puntuar con el marginal (regla 1-3). Reportar `travelCost`=marginal y
`distanceKm`=km directa (regla 4). `metrics.totalCost` regrupado real (regla 5). Cubrir `solve`,
`forceExisting` y `solvePartial` (regla 6). Importar `calculateDailyTravelCost` de mock-data.
(c) Aceptación: typecheck 0; sin restos del 3€/0,10; feasibility usa km directa; el marginal de un 2º partido
mismo día/municipio es 0. Justificación etiqueta: bien especificado pero fiddly (acumulador, doble conteo
de existentes, reconciliación de métricas) → `sonnet xhigh`, no PLANNER.

**T2. Tests del coste marginal** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `apps/web/src/lib/__tests__/solver.test.ts` (ampliar el `vi.mock` con `calculateDailyTravelCost` fiel +
constantes; añadir un municipio cuyo nombre sea 'Madrid' para el caso del fijo Madrid).
(b) Tests: (1) 2 partidos misma persona/fecha/municipio away → 2º marginal 0 y total = un solo trayecto;
(2) partido en municipio propio en día con away → marginal 0; (3) 1er away → km×0,26;
(4) día solo-casa → fijo (Madrid 3, resto 2); (5) `metrics.totalCost` == total real agrupado en un
escenario pequeño; (6) sin coche y venue >30 km directa → descartado aunque el marginal fuese 0.
(c) Aceptación: `pnpm test` verde; suite solver existente intacta (los fixtures actuales usan `getMockDistance`
20 km → recalcular los importes esperados que dependían de 0,10).

**T3. Doc** · ejecutor: `sonnet` · esfuerzo: `low`
(a) `CLAUDE.md` (sección "Lógica de Coste de Desplazamiento" y la nota de `TRAVEL_COST_SAME_MUNICIPALITY`).
(b) Actualizar la afirmación de que `calculateMockTravelCost` es "la estimación para el solver": el solver ya
optimiza el marginal real por día; `calculateMockTravelCost` queda solo para los badges del picker manual.
(c) Aceptación: la doc describe el objetivo real del solver; sin contradicciones con el código.

**T4. Gate + review adversarial (Fase 4)** · ejecutor: PLANNER (fable, juez) · esfuerzo: `max`
(a) Todo el diff.
(b) `pnpm typecheck` + `pnpm test` + `pnpm build`; smoke runtime en Asignación (una jornada con alguien con
2 partidos el mismo día en el mismo municipio → 2º pick a 0,00 €; `totalCost` de la propuesta = euros
reales). Review adversarial: doble conteo de existentes en el acumulador, feasibility con km directa,
coherencia `solve`/`solvePartial`, `metrics.totalCost` = regrupado, huérfanos, surgical changes.
(c) Aceptación: criterios globales abajo.

## Criterios de aceptación globales

- `pnpm typecheck` 0; `pnpm test` verde (existentes recalculados + nuevos de T2); `pnpm build` OK.
- El solver deja de usar 0,10 €/km y el fijo por partido; puntúa por marginal diario 0,26 €/km + fijo 3/2 por
  día, con sinergia (2º partido mismo día/municipio = 0).
- `metrics.totalCost` de una propuesta coincide con la liquidación real agrupada por persona/día.
- Smoke: en una jornada, un árbitro con 2 partidos el mismo día en el mismo municipio away no paga el trayecto
  dos veces en la propuesta.

## Fuera de scope (anotado, no se toca)

- Picker manual sigue con estimación por partido (`calculateMockTravelCost`).
- Sinergia de días con partidos FUERA del scope filtrado (categoría/rango): se mantiene la consistencia con el
  conteo de carga (solo in-scope), como ya hace `personLoadCount`. Anotado.
- Ejes #2 (motor global OR-Tools), #3 (solapamiento con viaje), #4 (equidad temporada), #5 (categorías reales):
  siguientes tandas.

---

# Plan: Disponibilidad de temporada para todo el roster + rango de fechas en Asignación + landing DESIGNAR/DISPONIBILIDAD (2026-07-11)

Estado: ✅ EJECUTADO Y VERIFICADO · project-claude · tipo ampliar+modificar · tamaño M · ejecutor: MIXTO (sonnet + fable)

Decisiones del usuario (2026-07-11): (1) rango default = **primera jornada**. (2) el bug preexistente de
"Re-optimizar slot" (`/api/optimize` ignora `partial`) **se arregla en esta tanda** → tarea T7b.
Volumen: versión rica confirmada por "muy variada".
Ejecución: 3 tracks paralelos por dueño de ficheros disjunto — A (disponibilidad core: T1-T5),
B (asignación rango + re-optimización: T6, T7, T7b), C (landing: T8) — y T9 gate/review con fable.

## Fase 4 — gate + review (resultado)

Gate: **pnpm typecheck 0 · 145 tests verdes · build OK**. Números: mockAvailabilities = 49.774 slots,
43 registros matchday, arquetipos dentro de ±1,3 pt. Smoke navegador: landing (DESIGNAR/DISPONIBILIDAD, sin
demo); Asignación con rango default = primer finde (6 partidos) y "Toda la temporada"; picker de un partido
muestra "Personal disponible (775)" con candidatos variados y sin jank. Fix del gate: `validateDateRange`/
`filterMatchesByRange` movidas de `route.ts` a `lib/optimize-range.ts` (los `route.ts` de Next solo exportan
handlers/config).

Review adversarial (fable, `max`) → **LISTO CON RESERVAS**. Fondo verificado limpio (determinismo/
hidratación, equivalencia del índice O(1), refactors del solver, huérfanos). Hallazgos:

- **B1 (blocker) CORREGIDO**: partial devolvía designaciones existentes (sin filtrar `isNew`) → el cliente
  creaba duplicados. Fix: `+ a.isNew` en el filtro de `route.ts`; test de regresión añadido (145 tests).
- **I1 (importante) CORREGIDO**: vaciar "Hasta" invertía el rango (`'' < dateFrom`). Guard `value &&` añadido.
- **I2 (importante) CORREGIDO** (decisión usuario: acotar al rango): `personLoadCount` contaba
  designaciones GLOBAL contra `maxMatchesPerPerson`, contra CLAUDE.md restricción 7 (carga por jornada).
  Fix en `solver.ts`: `inScopeMatchIds` acota la carga al conjunto de partidos pasado a `solve()`
  (rango/jornada, o el único partido en partial). Test determinista añadido en `solver.test.ts` (146 tests).
- Menores (no bloquean, anotados): M1 notas de la muestra matchday pueden no casar con sus flags (cosmético
  del badge); M4 `solvePartial` es código muerto preexistente; M2/M3/M5 sin camino de fallo hoy.

Commiteado en 4 commits (f92898a disponibilidad+solver · ede9350 rango+re-optimización · b46f785 landing ·
1672ef7 docs) y pusheado a origin/main.

## Arreglos pendientes (anotados 2026-07-11, fuera del scope de esta tanda)

1. **Error de hidratación preexistente** en `AdminSidebar` (`<aside>` vs `<div>`). Reproduce en `/dashboard`
   y demás páginas admin (contenido no tocado por este trabajo) → ajeno a esta feature, ya venía de antes.
   El header "Temporada 2024/25 · Jornada 15" (`app/(admin)/layout.tsx:15`) es texto hardcodeado y además
   desactualizado (los datos son 2025/26). Pendiente: diagnosticar el mismatch del sidebar y refrescar el
   header a datos reales.
2. **`demo-view.tsx` huérfano**: tras quitar `<DemoView/>` de la landing (T8) el componente no se usa en
   ningún sitio (grep confirmado). Pendiente: borrarlo o reubicar su contenido (lleva el badge "Cómo llegar"
   que CLAUDE.md documenta como una de las 3 vistas). No se borró sin confirmación.
3. **M1 (cosmético)**: en `availability-roster.ts` la nota de los ~40 registros matchday de muestra se asigna
   round-robin, independiente de las franjas booleanas → el badge del picker puede mostrar "Solo disponible
   por la tarde" en alguien con mañana marcada. Los flags/slots sí son coherentes (test lo cubre); solo el
   texto del badge puede contradecir. Pendiente: derivar la nota del patrón real del registro.
4. **Carga en modo `partial`**: al re-optimizar un hueco, la carga se cuenta solo sobre ese único partido
   (consecuencia del acotado I2 + scope partial), no sobre toda la jornada. Improbable que importe (se
   re-optimiza un slot suelto), pero si se quisiera respetar el tope por jornada en partial habría que pasar
   el rango de la jornada además del matchId.

## Petición del usuario

1. Disponibilidad arbitral para CADA árbitro y anotador (1279 personas), muy variada, cubriendo todos o la mayoría de escenarios posibles.
2. En el menú de Asignación, un rango de fechas para el que asignar los partidos (lista + asignación automática).
3. Landing: dos accesos renombrados, "Demo Admin" → **DESIGNAR** (/dashboard) y "Demo página árbitros y anotadores" → **DISPONIBILIDAD** (/disponibilidad); eliminar el bloque "Simulación de demo" (`<DemoView/>`). Conservar "Acceder al portal".

---

## Mini-spec Parte 1: disponibilidad generada para las 1279 personas

### Qué se construye

Un generador determinista (`apps/web/src/lib/availability-roster.ts`, módulo hoja sin imports del proyecto, patrón `referee-roster.ts`) que produce slots de `mockAvailabilities` para TODAS las personas sobre las jornadas reales de la temporada 2025-26, más una muestra de registros `mockMatchdayAvailabilities` con notas para el badge del picker. Las jornadas se derivan de las fechas de `mockMatches` (324 partidos, todos sábado/domingo, 2025-09-21 → 2026-03-22, J ≈ 22-26 sábados de jornada): el generador recibe `persons` y `matchDates` como parámetros y computa los sábados internamente (sábado = la propia fecha si es sábado, fecha-1 si es domingo). Puro y testeable con vitest sin servidor.

### Decisión de volumen y rendimiento (elegida: opción i)

- **Opción (i) elegida**: generar `mockAvailabilities` directamente por arquetipo, sin crear ~28.000 registros matchday intermedios ni pasar por `materializeToSlots`. Se siembran además ~40 registros `mockMatchdayAvailabilities` (muestra determinista de pares persona/jornada) con notas de un pool, COHERENTES con los slots generados para ese par (mismas franjas booleanas). Justificación: la opción (ii) duplicaría memoria y tiempo de init sin beneficio funcional, porque el registro matchday solo alimenta el badge `matchdayNotes` y el formulario del portal; la fuente que consumen solver y picker son los slots.
- **Aclaración bundle**: los slots NO se serializan como literales al bundle (se generan en runtime al evaluar el módulo); el coste real es CPU de init (decenas de ms), memoria (~8-12 MB con ~40k slots) y los hot paths de lectura. Los hot paths se resuelven con el índice (abajo); el volumen se acota por arquetipo y participación.
- **Presupuesto de slots**: participación media ~60-65% de jornadas y ~2 slots por jornada declarada → ~35-45k slots. Test de presupuesto: `12000 ≤ mockAvailabilities.length ≤ 55000`.
- **Franjas**: las mismas fijas del pipeline real (mañana 09:00-15:30, tarde 15:30-22:00, entre semana 17:30-22:00), definidas como constantes locales del módulo hoja (evita el ciclo mock-data → roster → matchday-availability → mock-data) con test anti-drift que las compara con `MATCHDAY_MORNING/AFTERNOON/WEEKDAY_HIGH` de `matchday-availability.ts`. Mañana+tarde marcadas → 2 slots contiguos (misma convención que `materializeToSlots`, cobertura idéntica con intervalos semiabiertos).
- **Sesgo horario obligatorio**: 308 de 324 partidos son de tarde (16-20h) y solo 16 a las 13h; los arquetipos ponderan tarde de sábado/domingo con fuerza para que el demo tenga candidatos. Los arquetipos de solo-mañana son minoría deliberada.

### Arquetipos (asignación determinista por persona, pesos que suman 100)

| #   | Arquetipo                  | Patrón por jornada declarada                                          | Participación | Peso |
| --- | -------------------------- | --------------------------------------------------------------------- | ------------- | ---- |
| 1   | Todoterreno                | sáb M+T, dom M+T                                                      | ~95% jornadas | 10%  |
| 2   | Finde de tarde             | sáb T + dom T                                                         | ~90%          | 18%  |
| 3   | Sábado completo            | sáb M+T                                                               | ~90%          | 10%  |
| 4   | Domingo completo           | dom M+T                                                               | ~90%          | 8%   |
| 5   | Solo sábado tarde          | sáb T                                                                 | ~85%          | 12%  |
| 6   | Solo domingo tarde         | dom T                                                                 | ~85%          | 8%   |
| 7   | Mañanas                    | sáb M + dom M                                                         | ~85%          | 6%   |
| 8   | Alterno quincenal          | finde completo, solo jornadas alternas (paridad + offset por persona) | ~50%          | 8%   |
| 9   | Media temporada            | solo 1ª o 2ª mitad de temporada (lesión/Erasmus), franjas de tarde    | ~45%          | 6%   |
| 10  | Esporádico                 | participa con p=0.4; 1-2 franjas aleatorias con sesgo tarde 70%       | ~40%          | 8%   |
| 11  | Entre semana + finde tarde | 1-3 weekdayDays (17:30-22:00) + sáb/dom tarde                         | ~85%          | 4%   |
| 12  | Fantasma                   | solo 2-3 jornadas en toda la temporada                                | ~10%          | 2%   |

- Toda persona tiene ALGUNA disponibilidad en la temporada (cumple "cada árbitro y anotador"); el escenario "no declaró esta jornada" emerge de la participación <100%.
- Los 9 demo (person-001..009) reciben arquetipos fijos hand-picked variados (predecibilidad del demo) y CONSERVAN sus slots actuales de semana actual/siguiente (el portal /disponibilidad hoy sigue funcionando).
- Determinismo: mulberry32 sembrado con hash del `personId` (añadir personas no reordena decisiones ajenas). PROHIBIDO `Math.random()`/`Date.now()` (hidratación SSR). `updatedAt` de los matchday seeds: timestamp fijo + offset determinista.
- IDs de slot compuestos y autodescriptivos: `avail-fbm-{personId}-{weekStart}-{dayOfWeek}-{startTime}` (únicos sin contador global).
- `INITIAL_AVAILABILITIES`/`INITIAL_MATCHDAY_AVAILABILITIES` ya se capturan tras el spread (mock-data.ts ~2336): al generarse los datos antes de esa línea quedan incluidos y `resetMockData()` los restaura. Verificarlo con test.

### Índice de disponibilidad (resuelve el hot path)

- En `mock-data.ts` (evita import circular): `Map<string, AvailabilitySlot[]>` con clave `${personId}|${weekStart}|${dayOfWeek}`, construcción lazy en el primer uso, lookup O(1).
- `isPersonAvailable` mantiene firma y semántica exactas (minutos, intervalos semiabiertos) pero consulta el índice en lugar de filtrar el array completo (hoy O(n_slots) por llamada; con 40k slots y 1279 personas por render del picker sería jank severo).
- Invalidación: export `invalidateAvailabilityIndex()`, llamada en los sitios que mutan `mockAvailabilities`: `resetMockData()` (mock-data.ts), `api/availabilities/matchday/route.ts` (tras `length = 0` + push), `api/admin/demo/route.ts` (~L297 y ~L415). `api/availabilities/route.ts` POST no muta el array (usa `memoryStore`): no se toca. Belt-and-braces: el índice guarda la longitud indexada y se reconstruye si `mockAvailabilities.length` difiere (cubre mutaciones no señaladas, p. ej. tests existentes).
- **Solver comparte la lógica**: `solver.ts#isAvailable` (L64-86) duplica hoy el cálculo con granularidad de HORAS ENTERAS (`parseInt`), lo que tiene un bug latente: una franja 15:30-22:00 daría disponible un partido a las 15:00. Se elimina y el solver llama a `isPersonAvailable` de mock-data (alineación intencionada con el picker, corrige el bug). `solver.test.ts` mockea `../mock-data` con `vi.mock`: hay que añadir al mock una implementación local de `isPersonAvailable` (misma semántica de minutos sobre su array local); los fixtures actuales usan horas enteras, resultados sin cambio.
- Hot path adicional del solver: `hasTimeOverlapWith` recorre TODOS los `currentAssignments` por candidato (con 324 partidos × 1279 personas es cuadrático). Micro-refactor incluido: mantener `Map<personId, Assignment[]>` incremental dentro de `solve()`.
- `getPickerPersons()` (asignacion-view) se recalcula en cada render: envolver en `useMemo` (deps: activeSlot, matches). Con índice O(1), 1279 iteraciones ligeras por cambio de slot son aceptables.

---

## Mini-spec Parte 2: rango de fechas en Asignación

### Qué se construye

Dos inputs `type="date"` (desde/hasta) en la cabecera de Asignación, con contador "N partidos en el rango" y botón "Toda la temporada" (limpia límites). Filtran client-side la lista de partidos, las métricas de la bottom bar (X de Y cubiertos) y se envían a la asignación automática.

### Decisiones de diseño

- **Default: la primera jornada del calendario** (fin de semana del primer partido: min `match.date` → su sábado y domingo). Justificación: el flujo real del designador es por jornadas; renderizar 324 MatchCards por defecto es inusable (la temporada está en el pasado respecto a hoy, no existe "jornada actual"). "Toda la temporada" queda a un clic.
- Estado local `useState` en `AsignacionView` (filtro de vista, no estado global; no se toca admin-store). El default se calcula cuando llegan los matches del fetch.
- **Solver acotado al rango**: `handleRunOptimization` y `handleReoptimizeSlot` añaden `dateFrom`/`dateTo` al body de POST `/api/optimize`; la ruta filtra `mockMatches` por rango ANTES de enriquecer y pasa solo esos al `solve()`. `SolverParameters`/`SolverInput` no cambian (el solver recibe menos matches); se añade el tipado del body (campos opcionales `dateFrom?: string`, `dateTo?: string`, p. ej. interface `OptimizeRequestBody` en types.ts). Las cargas (`personLoadCount`) y solapamientos siguen contando TODAS las designaciones existentes de `mockDesignations` (correcto: la carga es global aunque se optimice un rango).
- Validación en ruta: formato `YYYY-MM-DD` y `dateFrom ≤ dateTo`, si no → 400 con mensaje. Rango sin partidos → el solver devuelve 0 slots (estado vacío legítimo, la UI ya lo soporta).
- Nota (bug preexistente, NO se arregla aquí): `/api/optimize` ignora el campo `partial` que envía `handleReoptimizeSlot` y ejecuta un solve completo; con `forceExisting=true`, `assignments[0]` puede ser una asignación existente de otro partido. El filtro por rango lo mitiga pero no lo corrige. Surfacear al usuario.
- Nota: "Publicar designaciones" publica TODAS las pendientes (global), no solo las del rango. Se mantiene así (cambiarlo es otra feature).

---

## Mini-spec Parte 3: landing

- `apps/web/src/app/page.tsx`: renombrar "Demo Admin" → **DESIGNAR** y "Demo página árbitros y anotadores" → **DISPONIBILIDAD** (mismos destinos /dashboard y /disponibilidad); conservar "Acceder al portal"; eliminar el bloque `{/* Simulación de demo */}` con `<DemoView/>` y su import (limpieza de huérfanos en el archivo).
- Verificado con grep: `demo-view.tsx` solo se usa en `page.tsx`. Tras el cambio queda huérfano. NO se borra (CLAUDE.md lo documenta como una de las 3 vistas con "Cómo llegar"); se anota al usuario para decisión posterior.

---

## Task breakdown (orden de dependencia)

**T1. Generador puro `availability-roster.ts`** · ejecutor: `sonnet` · esfuerzo: `xhigh`
(a) `apps/web/src/lib/availability-roster.ts` (nuevo).
(b) `generateSeasonAvailability(persons, matchDates)` → `{ slots: AvailabilitySlot&{id}[], matchdayRecords: MatchdayAvailability[] }`. Implementa los 12 arquetipos de la tabla, franjas fijas locales, PRNG mulberry32 por hash de personId, sábados de jornada derivados de matchDates, ~40 matchday records muestreados con notas de un pool (~12 textos) coherentes con los slots del par persona/jornada, ids compuestos, timestamps fijos.
(c) Aceptación: módulo hoja (sin imports de `./mock-data` ni `./matchday-availability`); dos invocaciones consecutivas devuelven resultado idéntico (deep equal); volumen dentro de presupuesto; sin `Math.random`/`Date.now`.
Justificación de etiqueta: la dificultad vive en el diseño (ya especificado arriba: arquetipos, pesos, franjas, determinismo); la ejecución es implementación acotada → `sonnet xhigh`, no PLANNER.

**T2. Integración en mock-data** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `apps/web/src/lib/mock-data.ts`.
(b) Importar el generador; concatenar sus slots a los de `generateAvailabilities()` (los 9 demo conservan semana actual/siguiente); añadir los matchday records generados a `mockMatchdayAvailabilities` (conservando los 3 demo); pasar `mockPersons` y las fechas de `mockMatches` (ambos ya definidos antes de L1608, orden del módulo OK).
(c) Aceptación: `mockAvailabilities.length` dentro de presupuesto; toda persona tiene ≥1 slot en la temporada; `resetMockData()` restaura los datos generados (INITIAL\_\* los captura); typecheck 0.

**T3. Índice de disponibilidad + invalidación** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `mock-data.ts`, `api/availabilities/matchday/route.ts`, `api/admin/demo/route.ts`.
(b) Map lazy con clave `personId|weekStart|dayOfWeek`, `isPersonAvailable` con misma firma/semántica sobre el índice, export `invalidateAvailabilityIndex()`, llamadas en los 3 sitios de mutación + guard por longitud.
(c) Aceptación: tests: (1) lookup equivalente al filtrado lineal sobre un fixture; (2) tras mutar+invalidar, refleja el cambio; (3) mutación de longitud sin invalidar también se detecta; tests existentes de `matchday-availability.test.ts` siguen verdes sin modificarlos (guard por longitud los cubre) o con invalidación explícita añadida.

**T4. Solver: lógica compartida + índice de assignments** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `apps/web/src/lib/solver.ts`, `apps/web/src/lib/__tests__/solver.test.ts`.
(b) Eliminar `isAvailable` local (bug de horas enteras) y usar `isPersonAvailable` de mock-data; `Map<personId, Assignment[]>` para `hasTimeOverlapWith`; añadir `isPersonAvailable` al `vi.mock` del test (implementación en minutos sobre el array local del test).
(c) Aceptación: suite solver verde; test nuevo: partido a las 15:00 con franja 15:30-22:00 → NO disponible (regresión del bug); `solve()` sobre los 324 partidos con el roster completo termina < 5s en local.

**T5. Tests del generador** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `apps/web/src/lib/__tests__/availability-roster.test.ts` (nuevo).
(b) Tests: determinismo (dos llamadas idénticas); distribución de arquetipos (los 12 representados, pesos ±3 pts sobre 1279 personas, vía metadato expuesto por el generador o recuento de patrones); presupuesto (12k-55k); cobertura: para una muestra de ≥20 partidos reales de tarde (18:00-20:00, sáb y dom) hay ≥50 árbitros y ≥30 anotadores disponibles vía `isPersonAvailable`; para partidos de 13:00 hay ≥10 candidatos; ids únicos; franjas del roster == constantes `MATCHDAY_*` (anti-drift); matchday seeds coherentes con slots (para cada record, las franjas booleanas coinciden con los slots del par).
(c) Aceptación: `pnpm test` verde con los nuevos tests incluidos.

**T6. Asignación: UI de rango de fechas** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `apps/web/src/app/(admin)/asignacion/asignacion-view.tsx`.
(b) Dos inputs date desde/hasta + contador "N partidos en el rango" + botón "Toda la temporada"; default = fin de semana del primer partido (calculado al llegar el fetch); filtrado client-side de la lista ordenada y de las métricas de bottom bar; `getPickerPersons` envuelto en `useMemo`.
(c) Aceptación: al cargar se ve solo la primera jornada; cambiar el rango refiltra la lista y el contador; desde > hasta deshabilita/normaliza (elegir: swap silencioso o aviso inline); "Toda la temporada" muestra los 324.

**T7. Asignación automática acotada al rango** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `apps/web/src/app/api/optimize/route.ts`, `apps/web/src/lib/types.ts`, `asignacion-view.tsx` (body de los 2 fetch a /api/optimize).
(b) La ruta acepta `dateFrom`/`dateTo` opcionales, valida formato y orden (400 si inválido), filtra `mockMatches` por rango antes de enriquecer; tipado `OptimizeRequestBody` en types.ts; la UI envía el rango activo en `handleRunOptimization` y `handleReoptimizeSlot`.
(c) Aceptación: test (vitest de la función de filtrado o de la ruta): con rango de 1 jornada, todas las `assignments`/`unassigned` de la propuesta pertenecen a partidos de esa jornada; sin rango, comportamiento actual intacto; rango inválido → 400.

**T7b. Re-optimización parcial real (fix bug `partial`)** · ejecutor: `sonnet` · esfuerzo: `high`
(a) `apps/web/src/app/api/optimize/route.ts`, `asignacion-view.tsx` (ya envía `partial`).
(b) Cuando el body trae `partial: { matchId, role }`, la ruta acota el solve a ESE único partido
(filtra `mockMatches` a `matchId`, ignorando el rango desde/hasta para el caso partial), con
`forceExisting=true`, y devuelve solo la/s asignación/es de ese `matchId`+`role`. Así
`handleReoptimizeSlot` recibe un candidato para el hueco correcto (hoy recibe `assignments[0]` de un
solve global, que puede ser de otro partido). Mantener el comportamiento no-partial intacto.
(c) Aceptación: test — con `partial={matchId,role}`, todas las `assignments` devueltas pertenecen a ese
matchId y al role pedido; sin `partial`, comportamiento actual; el candidato propuesto respeta
disponibilidad/solapamiento/categoría. Smoke: "Re-optimizar slot" en un hueco vacío asigna una persona
válida para ESE partido.

**T8. Landing** · ejecutor: `sonnet` · esfuerzo: `low`
(a) `apps/web/src/app/page.tsx`.
(b) Renombrar los 2 links a DESIGNAR y DISPONIBILIDAD, eliminar bloque `<DemoView/>` + import.
(c) Aceptación: `/` renderiza 3 CTAs (Acceder al portal, DISPONIBILIDAD, DESIGNAR), sin bloque demo; grep `DemoView` en `app/` → 0 usos; typecheck 0.

**T9. Gate final (Fase 4) + review** · ejecutor: PLANNER (fable, juez) · esfuerzo: `max`
(a) Todo el diff.
(b) Verificación adversarial: correr el gate completo, smoke runtime, revisar el diff contra este plan (surgical changes, huérfanos, determinismo).
(c) Aceptación: ver criterios globales abajo.

---

## Criterios de aceptación globales (gate de Fase 4)

- `pnpm typecheck` 0 errores; `pnpm test` verde (116 existentes + nuevos de T3/T4/T5/T7); `pnpm build` OK.
- Smoke runtime (dev server): en Asignación, con el rango default (1ª jornada), expandir un partido de tarde y abrir el picker → mezcla de candidatos disponibles y no disponibles con motivos variados ("No disponible en esta franja" ya no es universal); cambiar el rango refiltra la lista; "Asignación automática" genera propuesta solo con partidos del rango y cobertura > 0%; landing con DESIGNAR/DISPONIBILIDAD y sin bloque demo; portal /disponibilidad sigue mostrando la cuadrícula de los 9 demo.
- Sin jank perceptible al abrir el picker (índice O(1) activo).
- Determinismo: recargar la página no produce mismatch de hidratación (consola limpia).

## Decisiones (resueltas con el usuario 2026-07-11)

- **Default del rango**: ✅ 1ª jornada del calendario (T6).
- **Volumen**: ✅ versión rica (~35-45k slots); ajustable bajando la participación media de los arquetipos.
- **Bug `partial` de "Re-optimizar slot"**: ✅ se arregla en esta tanda → tarea T7b.

---

## Cabos sueltos (fin de sesión 2026-07-11)

- **Todo sin commitear:** seed FBM real + Villaviciosa (muni-031) + roster (500 anotadores, nicks a los 9 demo).
  El repo arrastra además trabajo previo sin commitear. Pendiente: commit acotado (el usuario decide alcance).
- **Fechas FBM en el pasado:** el piloto es temporada 2025-26 (2025-09-21 → 2026-03-22), todo anterior a hoy.
  Opción ofrecida y NO hecha: desplazar las fechas a futuro para la demo. Pendiente de decisión del usuario.

---

# Plan: Roster — 500 anotadores + nicks para demo + categorías de anotador (2026-07-11)

Estado: **✅ EJECUTADO Y VERIFICADO** · project-claude · tipo ampliar+modificar · tamaño M · ejecutor: sesión (yo)
Gate: typecheck 0 · **116 tests verdes** (21 de roster: 500 anotadores, distribución 250/160/90, nicks
únicos y disjuntos de árbitros, determinismo) · build producción OK · runtime OK (Personal: 1279 personas =
Árbitros 775 + Anotadores 504; los 9 demo con nick; anotadores con Escuela/Autonómica/Nacional). Decisiones:
pirámide anotadores 250/160/90; anotadores también llevan nick; person-005 provincial→escuela. NO commiteado.
Requisitos del usuario:

1. Meter ≥500 anotadores.
2. Árbitros sin nick (los 9 demo hand-written person-001..009) → ponerles nick.
3. Anotadores tienen categoría **escuela / autonómica / nacional** (escala propia, distinta de árbitro).

## Contexto

- `mockPersons` = 9 demo (seedPersons, sin nick) + `generateReferees()` (770 árbitros, todos con nick).
  Solo ~4 anotadores (demo). Determinista por hidratación SSR (mulberry32, sin Math.random/Date.now).
- Nicks de árbitro: `nickPool[n]` (pool ~8800). Los sin nick son SOLO los 9 demo.
- `category` (MockPerson) = provincial|autonomico|nacional|feb → añadir 'escuela'.
- `CATEGORY_RANK`/`meetsMinCategory` es solo para árbitros (min-categoría de competición); anotadores no
  se filtran por categoría → NO se toca. `availability-deadline` degrada 'escuela' a default (no rompe).
- 5 mapas `categoryLabels` en UI (person-card, person-picker, matchday-availability-form, profile-view,
  person-detail-sheet): usan `?? cat` (fallback), añadir 'escuela':'Escuela' para etiqueta correcta.
- Demo `person-005` (anotador) tiene category 'provincial' (inválida para anotador) → corregir a 'escuela'.

## Tareas

1. `referee-roster.ts`: category union += 'escuela'; `generateScorers(munis)` → 500 anotadores
   (pirámide nacional 90 / autonómico 160 / escuela 250), deterministas, nick del MISMO pool con offset
   REFEREE_TOTAL (770) → únicos vs árbitros; sin refereeLevel; ids person-s0001…
2. `mock-data.ts`: import generateScorers; nick a los 9 seedPersons (nicks fuera del patrón del pool →
   sin colisión); person-005 provincial→escuela; `...generateScorers(...)` en mockPersons.
3. 5 mapas UI: añadir `escuela: 'Escuela'`.
4. `referee-roster.test.ts`: actualizar integración (779→1279, nicks) + tests de generateScorers
   (500, todos anotador, categorías ⊆ {escuela,autonomico,nacional} con distribución exacta, nicks únicos y
   disjuntos de árbitros, determinista).
5. Verificar: typecheck, tests, build, runtime (Personal: ≥500 anotadores, todos con nick).

## Criterios de aceptación

- mockPersons: 9 + 770 árbitros + 500 anotadores = 1279; todos con nick único.
- ≥500 personas role 'anotador' con category ∈ {escuela, autonomico, nacional}.
- 0 árbitros sin nick. typecheck 0, tests verdes, build OK.

---

# Plan: Seed = calendario FBM real (solo Liga VIPS + Junior ORO) (2026-07-11)

Estado: **✅ EJECUTADO Y VERIFICADO** · project-claude · tipo modificar · tamaño M · ejecutor: sesión (yo)
Gate: typecheck 0 · **109 tests verdes** · build Next OK · smoke runtime: 324 partidos (264 VIPS + 60
Junior ORO), 0 demo, 0 sin competición/pabellón, 0 designaciones. Rango real de fechas 2025-09-21 →
2026-03-22 (temporada 2025-26, jornadas 1-22). **Villaviciosa de Odón añadido** como `muni-031`
(mockMunicipalities + MUNI_COORDS {x:-20,y:-5}) y seed regenerado → **0 partidos sin municipio**,
`unresolvedMunicipalities: []`. Verificadas las 17 poblaciones del CSV: todas resuelven, sin falsos
positivos. Dos tests que usaban "Villaviciosa de Odón" como fixture de población NO resoluble se
reapuntaron a "Chinchón" (real, fuera de la lista mock). Archivos tocados: `mock-data.ts` (seed +
muni-031), `fbm-seed.json` (generado), `scripts/generate-fbm-seed.ts` (generador), 2 tests fbm-calendar.
NO commiteado.
Decisión del usuario (AskUserQuestion): **"Seed = calendario FBM real"** → reemplazar los 10 partidos
demo por los ~324 reales del CSV (Liga VIPS Masculina + Junior Masculino ORO) como datos por
defecto persistentes; al arrancar la app ya están cargados esos y ningún demo.

## Contexto verificado

- Los partidos viven en `mockMatches` (array in-memory, `apps/web/src/lib/mock-data.ts`). No hay DB de partidos aún.
- La ruta `api/admin/matches/import-csv-fbm` YA reemplaza `mockMatches` por el CSV materializado y vacía
  `mockDesignations`, pero es efímero (in-memory) → al reiniciar el server vuelven los 10 demo. Este plan
  hace que ese estado sea el SEED.
- Ambos CSV (`calendario_piloto_fbm.csv`, `_horas.csv`) contienen SOLO 2 categorías: Liga VIPS Masculina
  (264) y Junior Masculino LIGA AHORRAMAS - ORO (60). Ninguna otra. → No hay que filtrar competiciones.
- Se usa `calendario_piloto_fbm_horas.csv` (0 filas con hora "00:00"; el otro tiene horas por confirmar).
- Cadena de imports de mock-data es Node-safe (referee-roster → referee-eligibility, datos puros).
- `resetMockData()` toma los snapshots `INITIAL_*` al final del archivo → capturarán el estado ya con FBM.
- `solver.test.ts` usa mock local (`vi.mock`), NO el seed real → vaciar designaciones no lo rompe.

## Decisiones de alcance (micro, informadas)

- **Partidos**: reemplazo total por los ~324 FBM.
- **Designaciones**: vaciar (las demo referencian match-001..010, que dejan de existir → serían huérfanas;
  es lo que ya hace el import por UI).
- **Competiciones y pabellones**: se **AÑADEN** los FBM (`fbm-comp-*`, `fbm-venue-*`), no se borra el
  catálogo demo. Motivo: los `mockVenues` (venue-001…) son pabellones reales con metro/bus/distrito, y los
  `mockCompetitions` demo son catálogo; borrarlos rompería los fallbacks legacy `?? 'comp-001'` /
  `?? 'venue-001'` de import-xlsx/route.ts e import/route.ts. Es exactamente el estado tras importar por UI.
  (Nota para el usuario: las competiciones demo quedan en el catálogo pero SIN partidos; si se quiere que el
  filtro liste solo VIPS + Junior ORO, se limpia aparte.)

## Tareas

1. `apps/web/scripts/generate-fbm-seed.mts`: lee el CSV `_horas` (windows-1252), corre el pipeline REAL
   (`parseCalendarCsv` + `materializeImport`) y vuelca `apps/web/src/lib/fbm-calendar/fbm-seed.json`
   con `{ matches, venues, competitions }`. Reusar el pipeline probado garantiza ids consistentes.
2. Ejecutar el generador (tsx; fallback vite-node/vitest por el alias `@`). Verificar summary:
   matchesLoaded ≈ 324, competitions = 2, duplicatesSkipped/skippedNoDate/timeTBD razonables.
3. `mock-data.ts`:
   - `import fbmSeed from './fbm-calendar/fbm-seed.json'`
   - `mockMatches` = `fbmSeed.matches as MockMatch[]` (reemplazo de los 10 demo).
   - `mockCompetitions` = demo + `fbmSeed.competitions` (append).
   - `mockVenues` = demo + `fbmSeed.venues` (append).
   - `mockDesignations` = `[]` (borrar el literal demo).
4. Verificar (Fase 4): `pnpm typecheck`, `pnpm test` (vitest), `pnpm build`; smoke runtime del panel de
   partidos (324 partidos, competición y pabellón resueltos, 0 designaciones). Review adversarial del diff.

## Criterios de aceptación

- Al arrancar sin importar nada, la app muestra los ~324 partidos FBM (VIPS + Junior ORO) y 0 demo.
- Cada partido FBM resuelve competición (`fbm-comp-*`) y pabellón (`fbm-venue-*`) en las vistas.
- `mockDesignations` vacío; sin designaciones huérfanas.
- typecheck 0 errores; suite de tests verde; build OK.

---

# (Archivado) Plan: Coste de desplazamiento por persona y día (regla FBM 2026-07-11)

Estado: **✅ EJECUTADO Y VERIFICADO** · Planner: project-claude · Ejecutor: mixto (yo + subagente sonnet)
Decisiones D1/D2 confirmadas: solver estimado por partido; badges por partido en asignación, real por día en portal/reportes. Gate: typecheck 0, **95 tests** (incl. 10 nuevos del modelo por día), smoke runtime OK (Carlos 2 partidos Madrid → 3€/día, no 6€; away = km×0,26; totales dashboard=reportes=27,06€). Extra: el subagente detectó y corrigió 3 sitios más que sumaban por partido (persons route, demo route, person-detail-sheet).

**Cabo suelto (pendiente de decisión del usuario):** en el DETALLE de liquidación (XLSX/PDF/reportes) las filas por partido muestran el coste ESTIMADO por partido, así que la suma de filas no cuadra con el total real por día. La API ya expone `liquidation[].byDay`. Opción ofrecida: cambiar el detalle a desglose por día (fecha · municipios · coste) para que sume al total. Sin hacer hasta confirmar.

---

# Plan: Tanda 2 — Feature B (posiciones/slots nombrados + nick+categoría) + Feature D (disponibilidad en slots) (2026-07-16)

Estado: ✅ EJECUTADO Y VERIFICADO (gate + review adversarial fable) · project-claude · tipo ampliar · tamaño M · ejecutor: MIXTO (fable T1 xhigh + sonnet T2/T3/T5 + fable review T6)

## Fase 4 — resultado (2026-07-16)

Gate: **pnpm typecheck 0 · 220 tests verdes** (173 previos + 47 nuevos: 23 designation-positions,
14 route POST, +7 validation, +3 persistencia round-trip). `pnpm build` NO ejecutado a propósito (dev
server del usuario en :3001 comparte `.next`, precedente Tanda 1). Runtime end-to-end en navegador =
MANUAL del usuario (la extensión de Claude no es fiable en páginas admin).

Ejecución: T1 (fable, xhigh) hilo de datos completo → T2+T5 (sonnet, fusionadas: mismos ficheros) ∥
T3 (sonnet) → T6 (fable, max) gate + review adversarial → **LISTO, 0 blockers**.

- **T5 fusionada en T2** por la sesión: tocan exactamente `assignment-slot.tsx` + `asignacion-view.tsx`
  → una sola tanda de edición (economía de presupuesto).
- **Desviaciones (todas justificadas)**: `autoFillPosition` exportada desde `designation-positions.ts`
  (el route no puede exportar helpers); fichero de test extra `designations/__tests__/route.test.ts`
  (probar POST auto-fill/400/409 sin escribir en el `.fbm-data` real, vía `FBM_DATA_DIR` temporal);
  `status` explícito en los errores de `createDesignation` (distinguir 400 inválida de 409 ocupada);
  `emptyOrdinal` en `proposedForSlot` (con slots nombrados los huecos ya no son los últimos del array).
- **Datos legacy CONFIRMADOS intactos** (criterio nº1): las 90 designaciones reales del piloto sin
  `position` hidratan sin cambios (round-trip vía `Omit`+spread; `JSON.stringify` omite `undefined`),
  se pintan en Asignación y Partidos sin badge de posición y sin desplazar slots (`mapDesignationsToSlots`
  2ª pasada las coloca en orden de inserción = orden visual antiguo), nunca se les inventa posición.

### Reservas del review (no bloquean, anotadas)

- **[MENOR]** Mezcla legacy+propuesta en el mismo partido/rol: una propuesta pintada sobre el hueco
  visual "Auxiliar" (con legacy sin position en Principal) recibe `principal` al aplicarse y el render
  siguiente la coloca en el slot 0, corriendo la legacy al 1. Sin pérdida de datos; es el auto-fill
  especificado; solo reordena visualmente en partidos con cobertura legacy parcial.
- **[MENOR]** En modo LOTE una posición inválida se reporta como conflicto (200 con `conflicts[]`) en
  vez de 400; coherente con el contrato de lote existente (la spec 400/409 se enunció para el unitario).
- **[COSMÉTICO]** `match-detail-row.tsx` llama `refereeLevelLabel` dos veces (guard + render).
- **[COSMÉTICO/inalcanzable]** Caso `needed` > catálogo de posiciones (2 árbitro / 3 mesa): dos slots
  vacíos con `position===undefined` se resaltarían a la vez. Los datos reales FBM siempre son 2/3 →
  no se dispara; el desempate por índice se descartó por Simplicity First.
- **[PREEXISTENTE]** El route no valida que `role` ∈ {arbitro, anotador}; `api/admin/demo` inserta sin
  `position` (fuera de scope, quedan legacy sin badge).

### Pendiente

- Verificación runtime end-to-end del usuario (asignar por posición, aplicar propuesta con auto-fill,
  sustituir heredando posición, reiniciar server y ver que `designations.json` rehidrata con/sin position).
- `pnpm build` cuando el usuario pare el dev server.
- Commit ✅ + push (esta sesión; diff limpio y autocontenido, sin trabajo entrelazado).
- **Tanda 2 restante: C (nicks de una palabra) + E (panel de verificación)** planificadas abajo, sin ejecutar.

## Contexto verificado contra el código (2026-07-16)

- `getMockDesignationsForMatch` (`mock-data.ts` L1963-1982) construye `personWithAddress` con SOLO
  `{id, name, role, category, municipalityId, hasCar, address}` → **confirmado: NO propaga `nick` ni
  `refereeLevel`** aunque `MockPerson` (referee-roster.ts L26-44) los tiene y TODAS las personas del
  roster (9 demo + 770 árbitros + 500 anotadores) llevan `nick`. `EnrichedDesignation.person`
  (`types.ts` L60-68) tampoco los tipa. Anotadores NO tienen `refereeLevel` (solo `category`
  escuela/autonomico/nacional) → el badge cae al fallback de category, como en person-card.
- Precedente de render (person-card.tsx L60-83): nick como `«{nick}»` en gris junto al nombre; badge
  de categoría = `refereeLevelLabel(person.refereeLevel) ?? categoryLabels[person.category]`
  (`refereeLevelLabel` de `referee-eligibility.ts` L229, devuelve null si no hay nivel).
- Vistas que pintan designaciones (grep `EnrichedDesignation` + `.designations.map`):
  `components/assignment-slot.tsx` (asignación), `app/(admin)/partidos/match-detail-row.tsx` (OJO:
  vive en `app/(admin)/partidos/`, no en `components/`), `components/demo-view.tsx` (DesignationRow
  L727). **CAMBIO relevante: `demo-view.tsx` está HUÉRFANA** (grep `DemoView` → 0 imports; la landing
  la eliminó en la tanda anterior, T8) → se EXCLUYE del scope por defecto (tocarla es trabajo muerto;
  ver T4 opcional). El portal (`designation-card.tsx`) muestra las designaciones propias del árbitro;
  fuera de scope ahora, pero `position` le llegará gratis vía spread de `getMockDesignationsForPerson`.
- Slots hoy: `asignacion-view.tsx` L739-875 itera `Array.from({length: match.refereesNeeded})` y mapea
  designación→slot **por índice de array** (`refDesigs[i]`); `onActivate` solo si `i >= refDesigs.length`.
  `activeSlot` en `admin-store.ts` (L18-19) = `{matchId, role}` sin índice ni posición.
- Partidos reales FBM (fbm-seed.json): `refereesNeeded: 2`, `scorersNeeded: 3` en todos. Los slots
  nombrados cubren exactamente 2 y 3.
- POST `/api/admin/designations` (route.ts): helper module-local `createDesignation` (no exportado, OK
  con la lección route.ts) + dos modos: unitario `{matchId, personId, role}` y lote
  `{assignments: [...]}`. Valida con `checkDesignationConflict` (designation-validation.ts, pura:
  duplicado de persona + sobre-cobertura por rol). `persistDesignations()` tras mutar. DELETE en
  `[id]/route.ts` también persiste.
- Persistencia (`designation-persistence.ts`): serializa `JSON.stringify(mockDesignations)` y revive
  con spread `...d` + fechas; `SerializedDesignation` deriva de `MockDesignation` vía `Omit` →
  **añadir un campo opcional a `MockDesignation` round-trippea SIN tocar código de persistencia**
  (se verifica con test). Los datos reales del piloto (`.fbm-data/designations.json`, ~90
  designaciones) NO tienen `position` → deben seguir hidratando y pintándose.
- `isPersonAvailable(personId: string, date: string, time: string): boolean` (`mock-data.ts` L2174):
  date `YYYY-MM-DD`, time `HH:MM`; compara EN MINUTOS contra franjas indexadas
  (`personId|weekStart|dayOfWeek`), semántica `[start, end)`. Client-safe (ya la importan
  `asignacion-view.tsx` L430 y `substitution-panel.tsx` L74 para el motivo "No disponible en esta
  franja" del picker). Caveat lección 3: en cliente lee la copia estática del seed (determinista);
  es la MISMA fuente que usa hoy el picker → el badge del slot será consistente con el picker.
- Otras rutas que crean designaciones: `api/admin/demo/route.ts` (push directo L693, sin posición) →
  fuera de scope, quedan como legacy sin badge de posición (fallback). Solver/propuestas
  (`ProposedAssignment`) no llevan posición: el auto-fill del servidor (mini-spec) las posiciona al
  aplicar.

## Mini-spec Feature B — modelo de datos (FIJADO)

**Nuevo módulo hoja** `apps/web/src/lib/designation-positions.ts` (sin imports de mock-data ni fs;
importable desde cliente y server):

```ts
export const REFEREE_POSITIONS = ['principal', 'auxiliar'] as const
export const SCORER_POSITIONS = ['anotador', 'cronometrador', 'veinticuatro'] as const
export type DesignationPosition =
  | (typeof REFEREE_POSITIONS)[number]
  | (typeof SCORER_POSITIONS)[number]

export const POSITION_LABELS: Record<DesignationPosition, string> = {
  principal: 'Principal',
  auxiliar: 'Auxiliar',
  anotador: 'Anotador',
  cronometrador: 'Cronometrador',
  veinticuatro: '24"',
}

export function positionsForRole(role: 'arbitro' | 'anotador'): readonly DesignationPosition[]
export function positionForSlot(
  role: 'arbitro' | 'anotador',
  slotIndex: number,
): DesignationPosition | undefined // fuera de rango → undefined
export function isValidPositionForRole(position: string, role: 'arbitro' | 'anotador'): boolean

// Reconciliación slots↔designaciones (el punto delicado, con datos legacy sin position):
// 1ª pasada: designaciones con position válida para el rol reclaman SU slot (si dos reclaman la
//   misma, la primera gana y la otra pasa a la 2ª pasada).
// 2ª pasada: designaciones sin position (o con position duplicada/invalida) rellenan los huecos
//   restantes en orden de llegada.
// Sobrantes (> needed, datos raros): se anexan al final (longitud devuelta = max(needed, ocupadas))
//   para no ocultar designaciones existentes. Determinista, pura, con tests.
export function mapDesignationsToSlots<T extends { role: string; position?: DesignationPosition }>(
  designations: T[],
  role: 'arbitro' | 'anotador',
  needed: number,
): (T | undefined)[]
```

**Campo en la designación**: `position?: DesignationPosition` (OPCIONAL) en `MockDesignation`
(mock-data.ts L1636) y en `EnrichedDesignation` (types.ts L50). Opcional para no romper el JSON
existente ni los pushes de tests/demo. `EnrichedDesignation.person` gana además
`nick?: string | null` y `refereeLevel?: string | null`.

**Cómo se fija la posición al crear** (`createDesignation` en el route):

- Si el body trae `position`: validar `isValidPositionForRole` (si no → 400) y unicidad
  match+rol+posición vía `checkDesignationConflict` extendida (si ocupada → 409).
- Si NO trae `position` (aplicar propuesta, re-optimizar slot, llamadores legacy): **auto-fill
  determinista** = primera posición de `positionsForRole(role)` no reclamada explícitamente por las
  designaciones existentes de ese partido+rol. Si todas ocupadas → queda `undefined` (la
  sobre-cobertura ya la corta el conflicto por rol). Así TODA designación nueva nace con posición
  sin obligar a los llamadores a conocerla.

**Mapeo slot→posición en la UI**: el slot i del rol r ES la posición `positionForSlot(r, i)`. El
slot vacío se pinta "Asignar Principal / Auxiliar / Anotador / Cronometrador / 24\"" y al activarlo
`activeSlot` pasa a `{matchId, role, position}` (admin-store). Slots ocupados: se resuelven con
`mapDesignationsToSlots` (NO por índice crudo). El badge de posición en un slot ocupado muestra SOLO
`designation.position` guardada (una legacy sin position no muestra badge: no inventamos posiciones
no guardadas).

**Persistencia/revive**: automático (spread + `Omit`); test de round-trip obligatorio (con y sin
`position`).

**Sustitución**: `SubstitutionContext` gana `position?: DesignationPosition` (capturada de la
designación eliminada en `handleRemove` antes del DELETE); `handleSubstitute` la envía en el POST →
el sustituto hereda la posición liberada.

**Fuera de scope B (decisión ya tomada)**: NO se conecta `referee-eligibility.ts` (matriz 7 niveles)
para validar/sugerir por posición; la categoría se MUESTRA tal cual. El solver NO propone posiciones.

## Mini-spec Feature D — disponibilidad en slots asignados

`AssignmentSlot` recibe 2 props nuevas obligatorias: `matchDate: string`, `matchTime: string`
(asignacion-view tiene `match` en scope en ambos bucles). En la rama de slot ocupado:
`const available = isPersonAvailable(designation.personId, matchDate, matchTime)` → badge
`Disponible` (verde, `border-green-200 bg-green-50 text-green-700`) o `No disponible` (rojo,
`border-red-200 bg-red-50 text-red-700`). Misma fuente y semántica (minutos, `[start,end)`) que el
motivo del picker → nunca se contradicen. Sin `Date.now()`/`Math.random()` (determinista). Solo
`assignment-slot.tsx` (el picker ya lo hace; match-detail-row y demo-view fuera de scope D).

## Task breakdown

**T1. Hilo de datos posición+nick+categoría (types → positions lib → mock-data → validación → route) + tests** · ejecutor: **PLANNER (fable)** · esfuerzo: `xhigh`
(a) `apps/web/src/lib/designation-positions.ts` (NUEVO), `apps/web/src/lib/types.ts`,
`apps/web/src/lib/mock-data.ts`, `apps/web/src/lib/designation-validation.ts`,
`apps/web/src/app/api/admin/designations/route.ts`, tests:
`apps/web/src/lib/__tests__/designation-positions.test.ts` (NUEVO),
`designation-validation.test.ts` y `designation-persistence.test.ts` (extender).
(b) Implementa el módulo de posiciones completo (unions, labels, `positionForSlot`,
`isValidPositionForRole`, `mapDesignationsToSlots` con las 2 pasadas + sobrantes); añade
`position?` a `MockDesignation` y a `EnrichedDesignation` (+ `nick`/`refereeLevel` en su `person`);
`getMockDesignationsForMatch` propaga `nick: person.nick ?? null` y
`refereeLevel: person.refereeLevel ?? null`; `checkDesignationConflict` gana el parámetro opcional
`position` (chequeo de posición ocupada, mensaje claro); `createDesignation` acepta/valida
`position` en modo unitario Y lote, con auto-fill determinista si falta. `route.ts` sigue exportando
SOLO handlers.
(c) Aceptación: tests nuevos verdes — `mapDesignationsToSlots` (legacy sin position en orden;
position explícita reclama su slot aunque llegara después; duplicada degrada a hueco; sobrantes no
se pierden); validación (posición inválida para rol → ok:false; ocupada → ok:false; sin position →
comportamiento actual intacto); round-trip persistencia con/sin position; POST unitario con
position guarda y devuelve la designación con position; POST sin position auto-fill 'principal' y
luego 'auxiliar'; **`pnpm typecheck` 0** (toca route.ts → lección 1: typecheck obligatorio, vitest
no basta) y suite completa verde (los push de solver.test/optimize-range.test NO se tocan: campo
opcional).
Justificación fable: es el hilo con más riesgo de romper (datos reales del piloto sin position,
persistencia, contrato del route, reconciliación con legacy); un reintento aquí invalida todo lo
demás.

**T2. UI Asignación: slots nombrados + nick/categoría + picker consciente de posición** · ejecutor: `sonnet` · esfuerzo: `high` · depende de T1
(a) `apps/web/src/stores/admin-store.ts`, `apps/web/src/app/(admin)/asignacion/asignacion-view.tsx`,
`apps/web/src/components/assignment-slot.tsx`, `apps/web/src/components/person-picker.tsx`,
`apps/web/src/components/substitution-panel.tsx`.
(b) `activeSlot` → `{matchId, role, position?: DesignationPosition}` (store + los 2 `setActiveSlot`
de asignacion-view + prop de PersonPicker). En asignacion-view: sustituir el mapeo por índice
(`refDesigs[i]`) por `mapDesignationsToSlots(refDesigs, 'arbitro', match.refereesNeeded)` (ídem
anotadores); `isActive`/`onActivate` comparan por `positionForSlot(role, i)` y activan cualquier
slot VACÍO (ya no solo `i >= length`); `handleAssign` envía `activeSlot.position`; `handleRemove`
captura `desig.position` al `SubstitutionContext`; `handleSubstitute` la envía. En assignment-slot:
slot vacío = "Asignar {POSITION_LABELS[position] ?? '<rol> N'}"; slot ocupado = nombre + `«nick»`
(estilo person-card) + badge categoría (`refereeLevelLabel(refereeLevel) ?? categoryLabels[category]`,
mapa local con 'escuela' incluida, como los 5 mapas existentes) + badge posición (solo si
`designation.position` existe) + badge estado actual. PersonPicker: el header muestra la posición
activa ("Asignando: Principal") si viene en activeSlot.
(c) Aceptación (typecheck + smoke): partido FBM expandido muestra "Asignar Principal"/"Asignar
Auxiliar" y "Asignar Anotador"/"Asignar Cronometrador"/"Asignar 24\""; asignar desde el picker a
Auxiliar con Principal vacío guarda position='auxiliar' y el slot Principal SIGUE vacío y activable;
las ~90 designaciones legacy del piloto se pintan sin badge de posición y sin huecos corridos;
quitar+sustituir hereda la posición; nick y categoría visibles en cada slot ocupado.

**T3. Vista Partidos (match-detail-row): nick + categoría + posición** · ejecutor: `sonnet` · esfuerzo: `low` · depende de T1 · paralelo con T2
(a) `apps/web/src/app/(admin)/partidos/match-detail-row.tsx`.
(b) En cada fila de designación (L94-169): junto al nombre, `«nick»` gris (patrón person-card);
badge de posición (`POSITION_LABELS[d.position]`, solo si existe) al lado del badge de rol
Árbitro/Anotador ya existente; badge de categoría (`refereeLevelLabel ?? categoryLabels`). No tocar
"Cómo llegar" ni el badge de hora de salida.
(c) Aceptación: typecheck 0; smoke: partido designado en /partidos muestra nick+categoría+posición;
designación legacy sin position no muestra badge de posición ni rompe el layout.

**T4. (OPCIONAL — descartada por defecto) demo-view.tsx** · ejecutor: `sonnet` · esfuerzo: `low`
`demo-view.tsx` está huérfana (0 imports desde la limpieza de la landing). Tocarla es trabajo
muerto. Solo si el usuario decide conservarla viva: replicar T3 en `DesignationRow` (L727). Si no,
candidata a borrado en una limpieza aparte (decisión del usuario, no de esta tanda).

**T5. Feature D: badge de disponibilidad en slots ocupados** · ejecutor: `sonnet` · esfuerzo: `low` · depende de T2 (mismos ficheros)
(a) `apps/web/src/components/assignment-slot.tsx`, `apps/web/src/app/(admin)/asignacion/asignacion-view.tsx`.
(b) Props `matchDate`/`matchTime` en AssignmentSlot (pasadas desde los 2 bucles de asignacion-view,
`match.date`/`match.time`); en slot ocupado, badge Disponible/No disponible vía
`isPersonAvailable(designation.personId, matchDate, matchTime)` con los colores de la mini-spec.
(c) Aceptación: typecheck 0; smoke: asignar a alguien disponible → badge verde; una designación de
una persona SIN franja en esa fecha/hora (p. ej. creada antes de cambiar su disponibilidad) → badge
rojo, y el veredicto coincide con el motivo que daría el picker para esa persona; sin mismatch de
hidratación (consola limpia).

**T6. Gate final + review adversarial** · ejecutor: **PLANNER (fable, juez)** · esfuerzo: `max` · depende de T2, T3, T5
(a) Todo el diff de la tanda.
(b) `pnpm typecheck` 0 + `pnpm test` verde (173 previos + nuevos de T1); `pnpm build` SOLO si el dev
server del usuario está parado (comparten `.next`, precedente Tanda 1). Smoke runtime completo del
flujo: asignar por posición, aplicar propuesta del solver (auto-fill), sustituir, recargar server
(hidratación de designations.json con y sin position). Review adversarial: surgical changes (cada
línea traza a B o D), huérfanos (imports/props que los cambios dejen muertos), datos legacy sin
`position` intactos en TODAS las vistas, determinismo/hidratación (nada de Date.now/Math.random en
módulos cliente), route.ts solo exporta handlers, persistencia tras cada mutación.
(c) Aceptación: criterios globales de abajo, con veredicto explícito LISTO / LISTO CON RESERVAS /
NO LISTO y reservas corregidas o anotadas.

### Grafo de dependencias

```
T1 (fable, xhigh)
 ├─→ T2 (sonnet, high) ─→ T5 (sonnet, low) ─┐
 └─→ T3 (sonnet, low)  ────────────────────┼─→ T6 (fable, max)
     [T4 opcional, descartada]              ┘
T2 ∥ T3 (ficheros disjuntos). T5 tras T2 (comparten assignment-slot.tsx y asignacion-view.tsx).
```

## Criterios de aceptación globales (Tanda 2 · B+D)

- `pnpm typecheck` 0 errores; `pnpm test` verde (todos los previos + nuevos de T1); build OK cuando
  el dev server lo permita.
- Toda designación NUEVA (manual, propuesta aplicada, re-optimización, sustitución) queda con
  `position` guardada y sobrevive a un reinicio del server (JSON round-trip).
- Las designaciones EXISTENTES del piloto (sin `position`) siguen hidratando, pintándose en
  Asignación/Partidos sin badge de posición y sin desplazar slots; nunca se les inventa posición.
- En Asignación cada slot muestra: nombre + «nick» + badge de categoría (refereeLevel si existe,
  category si no, 'Escuela' incluida) + badge de posición (si guardada) + badge de estado + badge
  Disponible/No disponible coherente con el motivo del picker.
- No se puede crear por API una posición inválida para el rol (400) ni duplicada en el mismo
  partido (409). El modo lote respeta lo mismo dentro del propio lote.
- Determinismo: recarga sin mismatch de hidratación; sin `Math.random`/`Date.now` nuevos en módulos
  importados por cliente.

## Tanda 2 restante (planificado, siguiente sesión — esbozo, NO al nivel de B/D)

- **C. Nicks de una sola palabra**: hoy el pool (`referee-roster.ts#buildNickPool`) mezcla motes de
  1 palabra con compuestos "APODO DE LUGAR" (p. ej. "EL FLACO DE VALLECAS") para tener holgura.
  Pasar a 1 palabra exige un pool curado de **≥1300 palabras sueltas únicas** (770 árbitros + 500
  anotadores + 9 demo + margen) sin sufijos numéricos/romanos ni determinantes ("EL", "LA"). Tensión
  sin resolver: curar ~1300 palabras con calidad (barrios, parajes, apodos castizos) sin repetirse
  ni degenerar en ruido; probablemente requiera generación asistida + filtro manual del usuario.
  Mantener determinismo (mismo PRNG/semillas) y unicidad árbitro/anotador (offset actual).
- **E. Panel de verificación pre-publicación**: chequeo previo a "Publicar designaciones" que lista
  problemas por persona/día. Necesita una **función de solape NUEVA en minutos** que use duración
  real del partido (hoy `hasTimeOverlap` compara solo horas enteras con ventana fija de 2h) y
  distancia entre pabellones. Umbrales propuestos (A CONFIRMAR con el usuario): partidos de la misma
  persona a <2h → aviso; <1h30 → error; solape directo → error. Excepción confirmada: **mismo
  pabellón + misma categoría → mismo cuerpo arbitral OK** (encadenar partidos seguidos en la misma
  pista es práctica deseada, no error). UI: panel/diálogo antes de publicar con errores (bloquean) y
  avisos (no bloquean).

---

# Plan: Tanda 2 — Feature C (nicks de una palabra) + Feature E (panel de verificación pre-publicación) (2026-07-16)

Estado: ✅ EJECUTADO Y VERIFICADO (gate + review adversarial fable) · project-claude · tipo ampliar · tamaño M · ejecutor: MIXTO (fable C1 xhigh + sonnet C2/C3/E1/E2 + fable review G1)

## Fase 4 — resultado (2026-07-16)

Gate: **pnpm typecheck 0 · 234 tests verdes** (220 previos + 14 nuevos: 11 de `schedule-conflicts.test.ts`

- 3 de formato de nick en `referee-roster.test.ts`). `pnpm build` NO ejecutado a propósito (dev server
  del usuario en :3001 comparte `.next`). Runtime navegador no fiable (extensión) → verificación end-to-end
  = MANUAL del usuario.

Ejecución: C1 (fable, xhigh) ∥ C2 (sonnet) ∥ E1 (sonnet) → C3 (sonnet) ∥ E2 (sonnet) → G1 (fable, max)
review adversarial → **LISTO CON RESERVAS, 0 blockers vivos** (el juez corrigió 3 defectos y re-verificó).

- **C**: pool de **1470 palabras sueltas únicas** (≥1300, `pool[1269]`='LAGO' definido, 0 fuera de la regex
  de una palabra, 0 colisión con las 9 demo, 0 nicks vacíos); compuestos "APODO DE LUGAR" eliminados;
  `buildNickPool` exportada; 9 demo sin artículo (DECANO/JEFA/...); determinismo intacto (semilla
  `0x5eed_a17b`); unicidad 1279; `resetMockData`/`INITIAL_*` sin regresión. **Los 1270 nicks generados
  cambian TODOS de valor** (shuffle sobre otro array); nada persistido los referencia (designations.json
  usa personId).
- **E**: `lib/schedule-conflicts.ts` (hoja pura, minutos, duración 90 + margen 30 + viaje entre pabellones);
  `estimateTravelMinutes` exportada de `utils.ts`; panel en `PublishDialog` (errores rojos / avisos ámbar,
  agrupado por persona, "Nombre «NICK»", etiqueta "Local vs Visitante (hora)"); botón "Publicar con N
  conflictos" (N = solo errores) que **NO bloquea**. `hasTimeOverlap` (mock-data), `solver.ts` y
  `publish/route.ts` SIN diff.

### Defectos corregidos por el juez (G1)

- **[IMPORTANTE] Falso negativo con partidos importados**: `getMatch` usaba `getMockMatch` (copia cliente
  del seed) → designaciones sobre partidos importados por CSV (la vía real de datos) se saltaban la
  detección en silencio. Corregido: resuelve desde el estado `matches` del servidor (Map por id +
  venue→municipio del enriquecido, fallback `getMockVenue`); import huérfano eliminado; deps del `useMemo`
  a `[matches, allDesignations]`.
- **[MENOR] Etiqueta de conflicto**: `matchId` en bruto → "Local vs Visitante (hora)" vía prop `matchLabels`.
- **[MENOR] Botón fuera de spec**: contaba avisos → ahora N = errores; cabecera de persona "Nombre «NICK»".

### Reservas anotadas (no corregidas)

- **[MENOR]** Orden dentro de persona no estrictamente por hora (solapes antes que huecos); irrelevante con
  carga máx. 3 partidos/día.
- **[MENOR]** Las filas no muestran la FECHA del conflicto (solo horas); `ScheduleConflict.date` está
  disponible si se quiere añadir.
- **[PREEXISTENTE]** El panel evalúa solo los partidos cargados en la vista (rango fetched), coherente con
  los contadores del diálogo.
- **[MENOR, follow-up ya en plan]** Unificar la semántica de solape solver (horas enteras) vs panel
  (minutos + distancia): el solver sigue con `hasTimeOverlapWith` de horas. Fuera de esta tanda.

### Pendiente

- Verificación runtime end-to-end del usuario (nicks de una palabra en Personal/Asignación; panel de
  conflictos al publicar una jornada con solapes).
- `pnpm build` cuando el usuario pare el dev server.
- Commit + push (esta sesión).

Decisiones de diseño CERRADAS por el usuario (no reabrir). Tracks C y E tocan ficheros
DISJUNTOS: se pueden ejecutar en paralelo. Contexto verificado contra el código el 2026-07-16.

## Mini-spec C: nicks de una sola palabra

Hoy `buildNickPool` (`apps/web/src/lib/referee-roster.ts:426-442`) baraja 200 singles
(130 `LUGARES` L207-338 + 70 `APODOS` L342-413) y les concatena 9100 compuestos "APODO DE
LUGAR". Los árbitros consumen `pool[0..769]` (L490) y los anotadores `pool[770..1269]`
(L564): todos los anotadores y 570 árbitros llevan hoy nick compuesto.

Cambios decididos:

1. `buildNickPool` pasa a devolver SOLO palabras sueltas: se elimina el bucle de compuestos
   (L428-431). Se conserva PRNG (`mulberry32(0x5eed_a17b)`), shuffle y dedup con Set. Los
   tramos disjuntos árbitro/anotador (offset `REFEREE_TOTAL=770`) no cambian.
2. Pool ampliado a ≥1300 palabras únicas post-dedup (objetivo raw ~1450 para holgura).
   Consumo real: 1270 (770+500). Estilo actual: MAYÚSCULAS con tildes, sin artículos, sin
   "DE", sin espacios, sin dígitos ni ordinales romanos.
3. Normalizar los 7 apodos actuales con artículo: 'EL FLACO'→'FLACO', 'EL RUBIO'→'RUBIO',
   'EL LARGO'→'LARGO', 'EL CHATO'→'CHATO', 'EL ZURDO'→'ZURDO', 'EL GRECO'→'GRECO',
   'EL CID'→'CID'.
4. Los 9 demo hardcoded (`mock-data.ts:1398-1534`) pierden el artículo: DECANO, JEFA,
   CATEDRÁTICO, CONDESA, CRONISTA, COMENDADOR, VIRTUOSA, SIBILA, ESCRIBANO. Esas 9 palabras
   quedan EXCLUIDAS del pool (disjunción demo/generados garantizada por construcción).
5. Fixture afectado detectado: `app/api/admin/designations/__tests__/route.test.ts:223,251`
   espera 'EL DECANO' y 'LA JEFA' → actualizar a 'DECANO'/'JEFA'.

Estrategia de curación (cuotas orientativas, total raw ~1450):

- Base actual normalizada: 200 (LUGARES + APODOS sin artículo).
- Municipios CM, token distintivo de una palabra (GETAFE, ARGANDA, BOADILLA, PATONES...): ~140.
- Barrios y distritos de Madrid capital (USERA, TETUÁN, MORATALAZ, ORCASITAS, ABRANTES...): ~110.
- Sierra: cumbres, puertos, collados (PEÑALARA, MALICIOSA, MORCUERA, ABANTOS, NAJARRA...): ~50.
- Ríos, arroyos y embalses (JARAMA, LOZOYA, TAJUÑA, ATAZAR, PINILLA, VALMAYOR...): ~40.
- Parajes, dehesas, montes y cañadas (PEDRIZA, HERRERÍA, PARDO...): ~40.
- Calles, plazas y puertas castizas de una palabra (CIBELES, CALLAO, ATOCHA, PRECIADOS...): ~60.
- Pueblos y pedanías de sierra norte y vegas no cubiertos arriba: ~80.
- Apodos castizos ampliados: oficios tradicionales (SERENO, CHISPERO, AGUADOR, PREGONERO...),
  rasgos y motes (CANIJO, ESPIGADO...), taurino-deportivos: ~300.
  Dedup interno obligatorio en la curación (el Set final protege, pero merma la holgura si el
  raw trae repetidos). Guardia dura: test `pool.length >= 1300`.

Consecuencia asumida: los 1270 nicks generados CAMBIAN todos de valor (el shuffle opera
sobre otro array). Nada persistido referencia nicks (designations.json usa personId), y el
único fixture con nicks literales es el del punto 5. Presupuesto de init MEJORA (desaparece
la combinatoria 70×130).

## Mini-spec E: panel de verificación pre-publicación

Hoy `PublishDialog` (`components/publish-dialog.tsx`) muestra 4 contadores + Alert no
bloqueante de cobertura; `handlePublish` (`asignacion-view.tsx:260-266`) llama a
`/api/admin/designations/publish` sin validación y la ruta (`publish/route.ts`, solo
exporta POST) pasa pending→notified. `hasTimeOverlap` (`mock-data.ts:2202-2221`) compara
horas enteras con ventana fija de 2h.

Cambios decididos:

1. Nuevo módulo hoja `apps/web/src/lib/schedule-conflicts.ts` (client-safe, sin fs, sin
   `Date.now()`/`new Date()`/`Math.random()`), cálculo en MINUTOS desde medianoche.
   Constantes exportadas: `MATCH_DURATION_MIN = 90`, `CONFLICT_MARGIN_MIN = 30`.
2. Dos capas para testabilidad:
   - `detectDayConflicts(entries)` PURA sobre entradas ya preparadas
     `{ personId, personName, date, startMin, venueId, municipalityId, matchId, hasCar }`:
     sin imports de mock-data. Es la que se testea unitariamente.
   - `getPublishConflicts()` wrapper que recorre `mockDesignations` (excluyendo
     `status === 'rejected'`), resuelve partido/venue/municipio con `getMockMatch`,
     `getMockVenue`, `getMockDistance` y persona (nombre, nick, hasCar, municipalityId),
     agrupa por personId+fecha y delega en la pura.
3. Reglas (partido = `[start, start + MATCH_DURATION_MIN]`; pares ordenados por inicio;
   solape contra CUALQUIER partido del día, huecos solo entre consecutivos; un conflicto
   por par, el de mayor severidad):
   - Viaje A→B: mismo `venueId` → 0 min; si no,
     `estimateTravelMinutes(getMockDistance(muniA, muniB), hasCar)` de `lib/utils.ts`
     (hoy NO exportada, L23-28: exportarla; NO reutilizar `getDepartureInfo`, que usa
     `new Date()`). Mismo municipio distinto pabellón → suelo 15/20 min de la propia
     `estimateTravelMinutes`.
   - ERROR `overlap`: los intervalos se solapan. Se marca SIEMPRE, incluso mismo pabellón
     (decisión fijada por el planner, ver Notas).
   - ERROR `insufficient-gap`: `gap < viaje` (no llega físicamente).
   - AVISO `tight-gap`: `gap < viaje + CONFLICT_MARGIN_MIN`. EXENTO si mismo `venueId`
     (encadenar en la misma pista es deseable).
4. Tipo exportado:
   `ScheduleConflict { personId, personName, personNick?, date, matchAId, matchBId,
severity: 'error'|'warning', reason: 'overlap'|'insufficient-gap'|'tight-gap',
gapMin, travelMin }`.
5. UI: `asignacion-view.tsx` calcula los conflictos en cliente (useMemo, recalculado al
   abrir el diálogo o al cambiar designaciones) y los pasa por props a `PublishDialog`,
   que los lista agrupados por persona (errores en rojo, avisos en ámbar, con hora de
   ambos partidos y hueco/viaje). NO BLOQUEA: con N errores el botón pasa a
   "Publicar con N conflictos" (mismo patrón que el Alert de cobertura); solo avisos →
   botón normal + resumen ámbar. Lista con scroll si es larga.
6. NO se toca: `hasTimeOverlap` de mock-data, `hasTimeOverlapWith` del solver
   (`solver.ts:93-125`), ni `publish/route.ts` (E no toca rutas API: todo el cálculo es
   cliente; confirmado que la ruta solo exporta el handler POST).
7. Follow-up anotado (fuera de tanda): unificar la semántica de solape del solver y del
   panel en un único módulo de minutos.

## Task breakdown

### Track C (ficheros: referee-roster.ts, mock-data.ts nicks demo, tests de roster)

**C1. Pool curado de ≥1300 palabras + refactor `buildNickPool`** · ejecutor: **fable** · esfuerzo: `xhigh` · sin dependencias
(a) Fichero: `apps/web/src/lib/referee-roster.ts` (arrays L207-413 + `buildNickPool` L426-442).
(b) Curar ~1450 palabras raw según las cuotas de la mini-spec (arrays literales, orden
alfabético o por categoría con comentarios de bloque para mantenimiento); normalizar los 7
apodos con artículo; excluir las 9 palabras demo; eliminar el bucle de compuestos; conservar
semilla, shuffle, dedup y offsets. Sin dígitos, romanos, espacios, "DE" ni artículos en
ninguna entrada.
(c) Aceptación: typecheck 0; `buildNickPool(...)` devuelve ≥1300 entradas únicas, todas
`/^[A-ZÁÉÍÓÚÜÑ]+$/` (una palabra); `pool[1269]` definido; ninguna de las 9 palabras demo en
el pool; `generateReferees`+`generateScorers` deterministas (doble ejecución idéntica); los
tests existentes de unicidad/disjunción/determinismo siguen pasando (excepto los que C3
amplía).

**C2. Nicks demo sin artículo + fixture** · ejecutor: **sonnet** · esfuerzo: `low` · sin dependencias (paralela a C1)
(a) Ficheros: `apps/web/src/lib/mock-data.ts` (9 literales L1398-1534) y
`apps/web/src/app/api/admin/designations/__tests__/route.test.ts` (L223: 'EL DECANO'→'DECANO';
L251: 'LA JEFA'→'JEFA').
(b) Sustituir los 9 nicks por DECANO, JEFA, CATEDRÁTICO, CONDESA, CRONISTA, COMENDADOR,
VIRTUOSA, SIBILA, ESCRIBANO. Ningún otro cambio en mock-data.
(c) Aceptación: typecheck 0; `route.test.ts` verde; los 9 seed conservan id/orden
(test de integración "9 seed al frente" verde).

**C3. Tests de una-palabra y de holgura del pool** · ejecutor: **sonnet** · esfuerzo: `medium` · depende de C1 y C2
(a) Fichero: `apps/web/src/lib/__tests__/referee-roster.test.ts`.
(b) Añadir: (i) aserción "una sola palabra" para los 1279 nicks de `mockPersons` (sin
espacio, sin ' DE ', sin prefijo 'EL '/'LA ': con el formato una-palabra basta
`!nick.includes(' ')` + regex de mayúsculas); (ii) `pool ≥ 1300` y sin colisión con los 9
demo (exportar `buildNickPool` o un `NICK_POOL_SIZE` de test si hace falta, decisión del
ejecutor); (iii) mantener unicidad 770/500/1279, disjunción, determinismo y sin-sufijos
(regex existente L41-47) intactos.
(c) Aceptación: `pnpm test` verde completo; la suite falla si se reintroduce un compuesto o
un artículo (test rojo comprobado mutando temporalmente un valor en local).

### Track E (ficheros: schedule-conflicts.ts nuevo + test, utils.ts export, asignacion-view.tsx, publish-dialog.tsx)

**E1. Módulo `schedule-conflicts.ts` + tests unitarios (TDD)** · ejecutor: **sonnet** · esfuerzo: `high` · sin dependencias
(a) Ficheros: `apps/web/src/lib/schedule-conflicts.ts` (nuevo),
`apps/web/src/lib/__tests__/schedule-conflicts.test.ts` (nuevo),
`apps/web/src/lib/utils.ts` (solo `export` de `estimateTravelMinutes`, L23).
(b) Implementar según mini-spec E puntos 1-4 (tests primero). Casos de test mínimos:
solape=error (incluido mismo pabellón); `gap<viaje`=error; `viaje ≤ gap < viaje+30`=aviso;
mismo pabellón back-to-back sin aviso (exención); hueco holgado=limpio; agrupación correcta
por persona/día (entrada multi-persona multi-fecha, sin cruces); designación 'rejected'
excluida (test del wrapper con datos de mock-data reales o entrada preparada); sin coche vs
con coche cambia el veredicto en el mismo hueco (1.5 vs 3 min/km).
(c) Aceptación: typecheck 0; tests nuevos verdes; el módulo no importa fs/APIs Node ni usa
`Date.now`/`new Date`/`Math.random` (grep limpio); `detectDayConflicts` no importa
mock-data; diff de `solver.ts` y de `hasTimeOverlap` en mock-data VACÍO.

**E2. UI del panel en PublishDialog** · ejecutor: **sonnet** · esfuerzo: `medium` · depende de E1
(a) Ficheros: `apps/web/src/app/(admin)/asignacion/asignacion-view.tsx` y
`apps/web/src/components/publish-dialog.tsx`.
(b) `asignacion-view`: useMemo con `getPublishConflicts()` (recalcula al cambiar
designaciones/al abrir), prop `conflicts` al diálogo. `publish-dialog`: sección de
conflictos agrupada por persona (nombre + «nick»), errores en rojo y avisos en ámbar, hora
de ambos partidos + hueco/viaje en el copy; con N errores el botón pasa a
"Publicar con N conflictos" (sigue habilitado, `handlePublish` intacto); solo avisos →
botón normal; sin conflictos → diálogo idéntico al actual. Scroll interno si hay muchos.
(c) Aceptación: typecheck 0; smoke: dos designaciones de la misma persona a la misma hora →
error rojo en el diálogo y botón "Publicar con 1 conflicto" que publica igual (respuesta
200 y pending→notified); partidos encadenados en el mismo pabellón → sin aviso; sin
conflictos → diálogo como antes; consola sin mismatch de hidratación.

**G1. Gate final + review adversarial** · ejecutor: **PLANNER (fable, juez)** · esfuerzo: `max` · depende de C3 y E2
(a) Todo el diff de la tanda (C+E).
(b) `pnpm typecheck` 0 + `pnpm test` verde (previos + nuevos); `pnpm build` SOLO si el dev
server del usuario está parado (comparten `.next`, precedente Tanda 1). Smoke runtime:
recarga de Asignación y Personal (nicks nuevos renderizan, cero compuestos visibles),
diálogo de publicación con y sin conflictos, publicar con errores presentes. Review
adversarial: surgical changes (cada línea traza a C o E); huérfanos; determinismo (sin
`Math.random`/`Date.now` en módulos cliente tocados); solver y `hasTimeOverlap` sin diff;
`publish/route.ts` sin diff; consumidores de nick (`assignment-slot.tsx`,
`match-detail-row.tsx`, `person-card.tsx`, `person-detail-sheet.tsx`, `persons/route.ts`)
renderizan bien nicks cortos; `resetMockData`/`INITIAL_*` conserva nicks tras reset;
designations.json legacy hidrata (referencia personId, no nick).
(c) Aceptación: criterios globales de abajo con veredicto LISTO / LISTO CON RESERVAS /
NO LISTO y reservas corregidas o anotadas.

### Grafo de dependencias

```
Track C: C1 (fable, xhigh) ─┐
         C2 (sonnet, low) ──┼─→ C3 (sonnet, medium) ─┐
                            │                         ├─→ G1 (fable, max)
Track E: E1 (sonnet, high) ─┴─→ E2 (sonnet, medium) ─┘
C1 ∥ C2 ∥ E1 (ficheros disjuntos). C3 tras C1+C2; E2 tras E1. Tracks C y E paralelos.
```

## Criterios de aceptación globales (Tanda 2 · C+E)

- `pnpm typecheck` 0 errores; `pnpm test` verde (todos los previos + nuevos de C3/E1);
  build OK cuando el dev server lo permita.
- Los 1279 nicks de `mockPersons` son únicos, de UNA sola palabra (sin espacios, sin "DE",
  sin artículos), sin dígitos ni romanos; pool post-dedup ≥1300; generación determinista
  (misma semilla → mismo roster).
- El diálogo de publicación lista errores (rojo) y avisos (ámbar) por persona y NUNCA
  bloquea la publicación; sin conflictos se comporta como hoy.
- `hasTimeOverlap` (mock-data), `hasTimeOverlapWith` (solver.ts) y `publish/route.ts` sin
  ningún cambio en el diff.
- Sin `Math.random`/`Date.now`/`new Date()` en `schedule-conflicts.ts` ni en ningún módulo
  cliente tocado; recarga sin mismatch de hidratación.
- Follow-up registrado (no ejecutar): unificar semántica de solape solver+panel en minutos.

## Notas del planner (decisiones menores fijadas al planificar)

- **Solape en mismo pabellón = error**: la excepción de mismo `venueId` cerrada por el
  usuario se aplica al AVISO de hueco (encadenar partidos es deseable); un solape real de
  intervalos se marca como error también en el mismo pabellón (nadie pita dos pistas a la
  vez). Reversible con una línea si el usuario prefiere la exención total.
- **Estados considerados en E**: todas las designaciones con `status !== 'rejected'` (un
  pending puede chocar con un confirmed ya publicado y hay que verlo).
- **`estimateTravelMinutes` se exporta de utils.ts** en lugar de duplicarla: una sola fuente
  de verdad para min/km y suelo intra-municipal (15/20 min); `getDepartureInfo` NO se
  reutiliza porque depende de `new Date()`.
- **E1 en sonnet, no fable**: la función es sutil pero la spec quedó cerrada (reglas,
  constantes, exención, capas y casos de test enumerados); el presupuesto fable rinde más
  en la curación del pool de C1 (riesgo real de shortfall y calidad de contenido) y en el
  gate G1 (max), que revisará E1 adversarialmente.
