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
