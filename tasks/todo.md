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
