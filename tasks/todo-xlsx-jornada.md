# Plan: Importador XLSX de jornada + disponibilidad real por franjas

Fecha: 2026-07-03 · Planner: pipeline FBM/arbitros · Estado: PENDIENTE DE APROBACIÓN

---

## 1. Spec breve

### Qué se construye

1. **Importador XLSX de partidos** (hermano del importador CSV existente): parsea el workbook real de jornada de la FBM (`JDM 7-8 MARZO.xlsx`, hojas SABADO / DOMINGO / ENTRE SEMANA / MOSTOLES / TORREJON / ARANJUEZ) con su jerarquía distrito → pabellón → pista, y crea partidos en mock-data con preview previo a la importación.
2. **Concepto de "pista"** dentro de un pabellón: nueva entidad ligera `mockCourts` + campo `courtId` en partidos (hueco real del modelo actual).
3. **Seed de pabellones reales** desde la hoja CAMPOS (dirección, distrito, metro/bus, observaciones) en sustitución de los sintéticos actuales.
4. **Disponibilidad de jornada por franjas** (modelo real del Google Form): sábado mañana/tarde, domingo mañana/tarde, días de entre semana, observaciones; anclada a la fecha del sábado de la jornada. Sustituye la cuadrícula horaria como interfaz de declaración.
5. **Antelación por categoría**: tabla de configuración (provincial/autonómico/nacional/FEB → días de antelación) que sustituye al env var global `AVAILABILITY_DAYS_ADVANCE`.

### Qué se descarta explícitamente

| Descartado                                                   | Motivo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoja SANCIONADOS                                             | Disciplina deportiva de jugadores; no afecta a la designación arbitral.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Importar columnas ARBITRO/ANOT del xlsx                      | El valor de la app es _generar_ designaciones, no reimportar las ya publicadas; los nicks del xlsx no cruzan de forma fiable con `mockPersons` y poblarían designaciones inconsistentes. Trade-off: se pierde un seed de designaciones "realistas" de demo, pero se evita construir un matcher nick→persona frágil que nadie ha pedido. Si en el futuro interesa, es una extensión natural del parser (que ya leerá esas celdas y las expondrá como `warnings`/datos crudos ignorados). |
| Disponibilidad GENERAL y bajas temporales                    | Hoy se gestionan por WhatsApp directo al comité; modelarlas exige UI nueva + lógica de precedencia (general vs override de jornada) y no alimenta ninguna feature actual del flujo de designación. La disponibilidad de jornada (la que sí come el solver) queda cubierta. Se deja anotado como evolución futura.                                                                                                                                                                       |
| Importador de respuestas del Google Form (.eml/CSV de Forms) | La declaración pasa a hacerse dentro de la app; el campo NICK solo importa para cruzar respuestas externas, que queda fuera de alcance. No se añade `nick` a `persons`.                                                                                                                                                                                                                                                                                                                 |
| Conectar Drizzle/Postgres o auth                             | Decisión explícita del usuario: todo sigue el patrón mock-data (ver nota final).                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## 2. Decisiones de diseño

1. **XLSX: se abordan ambos usos (a) importador y (b) seed de pabellones, como tareas separadas.** El importador es recurrente (cada jornada) y el seed es one-shot; separarlos permite que el seed use el parser ya testeado de la hoja CAMPOS y que cada uno tenga criterios de aceptación propios.
2. **"Pista" como entidad `mockCourts` (`{ id, venueId, name }`) + `courtId: string | null` en matches, no como string libre en el partido.** Un string duplicado por partido impediría agrupar sesiones por pista (el patrón real de reparto) y no tendría equivalente limpio en el schema Drizzle objetivo; se añade también la tabla `courts` a `schema.ts` como referencia (el schema no corre en runtime pero es la fuente de verdad del modelo objetivo).
3. **Pabellón sin sufijo de pista = 1 pista implícita → `courtId: null`.** Evita crear pistas fantasma "1" para decenas de pabellones de pista única.
4. **El parser XLSX es una función pura en `lib/xlsx-import.ts` (workbook → resultado estructurado), y el diálogo la ejecuta en cliente (SheetJS `xlsx@0.18.5` ya es dependencia).** Mismo patrón que el CSV (parse en cliente con preview → POST de filas validadas a la ruta), y la función pura es testeable con Vitest sin tocar red ni UI.
5. **El diálogo pide la fecha del sábado de la jornada.** El workbook solo tiene horas ("H") y nombres de día en ENTRE SEMANA; anclar la fecha desde la UI es más robusto que inferirla del nombre del fichero. Domingo = sábado+1; los días de entre semana mapean a la única fecha de ese día dentro de la ventana de jornada [viernes anterior al sábado, jueves posterior].
6. **Pabellón no encontrado en importación XLSX → se crea el venue (con distrito) en vez del fallback silencioso `venue-001` del importador CSV.** El xlsx es la fuente autoritativa de pabellones de la FBM; el fallback silencioso corrompe datos. No se retrofitea el CSV (cambio quirúrgico), se deja anotado.
7. **Seed CAMPOS: se sustituyen los datos de los ids `venue-001..020` por pabellones reales equivalentes (mismo id, datos reales) y el resto se añade con ids nuevos.** Así ninguna referencia de `mockMatches`/`mockDesignations` se rompe. El shape de venue se extiende con opcionales `district`, `metro`, `bus`, `observations` (CAMPOS usa distrito, no municipio; el transporte es oro para árbitros con `hasCar=false`).
8. **Disponibilidad de jornada como registro por franjas (`MatchdayAvailability` anclado a `saturdayDate`), materializado a slots del modelo actual al guardar.** Las franjas son el nuevo almacenamiento y UI; la materialización a `mockAvailabilities` (weekStart/dayOfWeek/start/end) mantiene funcionando sin cambios `isPersonAvailable`, el solver y el panel admin. La cuadrícula deja de escribir slots (se retira), así que no hay doble fuente de escritura.
9. **Franjas fijas**: sábado/domingo mañana 09:00–15:30, tarde 15:30–22:00; entre semana 17:30–22:00 por día marcado. `isPersonAvailable` debe pasar a comparar en minutos (hoy trunca a horas: un partido a las 15:00 con franja 09:00–15:30 fallaría).
10. **Antelación por categoría como config en código (`AVAILABILITY_DEADLINE_DAYS: Record<RefereeCategory, number>`), no env var.** Es una tabla de negocio de 4 filas editable por el comité en el futuro admin (Fase 7), consistente con el patrón mock. Defaults propuestos (a confirmar con el comité): feb 12, nacional 10, autonomico 8, provincial 7. Fecha límite = sábado de la jornada − N días.
11. **Fixtures de test sintéticos generados con SheetJS en el propio test, nunca el xlsx real commiteado.** El fichero real contiene datos personales (nombres de árbitros y sancionados); el real se usa solo localmente para el seed y la validación manual.

---

## 3. Task breakdown

Orden = orden de ejecución. `Dep` indica bloqueo.

| #   | Tarea                                                       | Ejecutor | Dep              |
| --- | ----------------------------------------------------------- | -------- | ---------------- |
| T1  | Modelo: pistas + shape extendido de venue                   | sonnet   | —                |
| T2  | Parser XLSX multi-hoja (función pura + tests)               | PLANNER  | T1               |
| T3  | Ruta API + diálogo de importación XLSX                      | sonnet   | T1, T2           |
| T4  | Seed de pabellones reales (hoja CAMPOS)                     | haiku    | T1, fichero real |
| T5  | Config de antelación por categoría                          | sonnet   | —                |
| T6  | Modelo de disponibilidad de jornada + materialización       | sonnet   | T5               |
| T7  | UI del portal: formulario de franjas (sustituye cuadrícula) | sonnet   | T6               |
| T8  | Panel admin: observaciones de jornada visibles              | sonnet   | T6               |
| T9  | Verificación integral                                       | sonnet   | todas            |

### T1 — Modelo: pistas + shape extendido de venue

- **Qué**: añadir `mockCourts: { id, venueId, name }[]` (vacío o con 2-3 ejemplos), campo `courtId: string | null` en `mockMatches` (null en los existentes) y helper `getMockCourt(courtId)`. Extender el shape de venue con opcionales `district?: string`, `metro?: string`, `bus?: string`, `observations?: string`. Añadir tabla `courts` y columnas nuevas de `venues` a `schema.ts` (solo referencia). Actualizar `EnrichedMatch` en `types.ts` si expone venue/court. Incluir `mockCourts` en `resetMockData()`.
- **Ficheros**: `apps/web/src/lib/mock-data.ts`, `apps/web/src/lib/types.ts`, `apps/web/src/lib/db/schema.ts`.
- **Aceptación**: `pnpm -F @fbm/web typecheck` y `pnpm -F @fbm/web lint` en verde; la app arranca (`pnpm -F @fbm/web dev`) y las vistas existentes (partidos, asignación) no cambian de comportamiento (courtId null en todo).

### T2 — Parser XLSX multi-hoja (PLANNER: la dificultad vive en el algoritmo)

- **Qué**: `apps/web/src/lib/xlsx-import.ts` exportando `parseJornadaWorkbook(workbook: XLSX.WorkBook, saturdayDate: string): XlsxImportResult`.
  - `XlsxImportResult = { matches: ParsedXlsxMatch[]; camposVenues: ParsedCamposVenue[]; warnings: string[] }`.
  - `ParsedXlsxMatch = { date, time, venueName, courtName: string | null, district, category, group, homeTeam, awayTeam, refereesNeeded, sheet }`.
  - Algoritmo por hoja de fin de semana (SABADO/DOMINGO): recorrer filas detectando bloques → fila de cabecera de pabellón/pista (texto libre; sufijo ` - N` = pista N de ese pabellón, sin sufijo = pista implícita → `courtName: null`), fila de cabecera de mini-tabla (`H | CAT | GR. | DISTRITO | LOCAL | VISITANTE | ARBITRO | ANOT.`), filas de partido hasta fila vacía o siguiente cabecera. Columnas ARBITRO/ANOT se leen y se ignoran (decisión de diseño 0-import).
  - ENTRE SEMANA: misma estructura pero manteniendo un "día actual" a partir de cabeceras tipo "Martes 3 Marzo" (parsear nombre de día en español, con y sin tilde); cada día mapea a la fecha única de ese día dentro de la ventana [viernes anterior a `saturdayDate`, jueves posterior].
  - Hojas satélite (MOSTOLES/TORREJON/ARANJUEZ): mismo recorrido tolerando cabecera con `ARBITRO 1 | ARBITRO 2` → `refereesNeeded: 2`; una sola columna ARBITRO → `refereesNeeded: 1` (la ruta podrá sobreescribir con el valor de la competición matcheada).
  - CAMPOS: parseo tabular directo → `ParsedCamposVenue = { district, name, address, metro, bus, observations }`.
  - SANCIONADOS: se omite (añadir warning informativo "hoja SANCIONADOS ignorada").
  - Robustez: celdas fusionadas/vacías, horas como número Excel o texto "HH:MM", filas basura → acumular en `warnings`, nunca lanzar.
- **Tests** (Vitest, junto a `lib/__tests__/solver.test.ts`): fixture sintético construido en el test con `XLSX.utils.aoa_to_sheet` que reproduzca: 2 pabellones (uno con 2 pistas, otro sin sufijo), ENTRE SEMANA con 2 días, una hoja satélite con ARBITRO 1/2, hoja CAMPOS con 3 filas, hoja SANCIONADOS. Casos: happy path completo; hoja con filas corruptas → warnings sin excepción; mapeo de fechas de entre semana correcto en la ventana viernes→jueves.
- **Ficheros**: `apps/web/src/lib/xlsx-import.ts`, `apps/web/src/lib/__tests__/xlsx-import.test.ts`, tipos en `apps/web/src/lib/types.ts`.
- **Aceptación**: `pnpm -F @fbm/web test` en verde con los casos anteriores; validación manual: parsear el `JDM 7-8 MARZO.xlsx` real en local (script `tsx` puntual o consola) y revisar que el nº de partidos por hoja cuadra con el fichero.

### T3 — Ruta API + diálogo de importación XLSX

- **Qué**:
  - `apps/web/src/app/api/admin/matches/import-xlsx/route.ts` (hermana de `import/route.ts`): recibe `{ matches: ParsedXlsxMatch[] }` ya parseados; resuelve venue por nombre normalizado (case/tildes-insensitive) → si no existe, crea venue nuevo con `district` (decisión 6); resuelve/crea `mockCourts` por (venueId, courtName); matchea competición por `category` (best-effort como el CSV, con warning); crea partidos `status: 'scheduled'` con `courtId`.
  - `apps/web/src/components/xlsx-import-dialog.tsx` (hermano de `csv-import-dialog.tsx`): input de fichero `.xlsx` + date-picker del sábado de jornada → parse en cliente con `parseJornadaWorkbook` → preview agrupado (hoja → pabellón → pista → partidos) con contadores de válidos/warnings → botón importar → POST.
  - Botón "Importar XLSX" junto al de CSV en `apps/web/src/app/(admin)/partidos/page.tsx` (o el componente cliente que renderice la toolbar de esa página).
- **Ficheros**: los 3 anteriores + `types.ts` si hace falta exportar payloads.
- **Aceptación**: con `pnpm -F @fbm/web dev`, subir el xlsx real en Admin → Partidos importa los partidos (visibles en la tabla con su pabellón/pista), los pabellones desconocidos aparecen creados, y reimportar el mismo fichero no rompe (los duplicados son aceptables en mock, como en el CSV). Typecheck y lint en verde.

### T4 — Seed de pabellones reales (hoja CAMPOS)

- **Qué**: sustituir los datos de `mockVenues` por pabellones reales de la hoja CAMPOS según la decisión 7 (ids `venue-001..020` reciclados con datos reales + resto con ids nuevos), mapeando distrito → `district` y municipio: distritos de Madrid capital → `muni-001`; zonas satélite (Móstoles/Torrejón/Aranjuez) → su municipio existente. `metro`/`bus`/`observations` pobladas. Mecánica de extracción: script puntual con `tsx` + `parseJornadaWorkbook` (de T2) sobre el fichero real, o transcripción directa; el fichero real NO se commitea (contiene datos personales en otras hojas) — colocarlo en local, p. ej. `~/Desktop/.../JDM 7-8 MARZO.xlsx`, y referenciarlo solo desde el script local.
- **Input pendiente**: ruta local del `JDM 7-8 MARZO.xlsx`. Pedir al usuario antes de ejecutar.
- **Ficheros**: `apps/web/src/lib/mock-data.ts` (bloque `mockVenues`).
- **Aceptación**: typecheck en verde; la app arranca y las vistas de partidos/asignación muestran los nombres reales sin referencias rotas (ningún `getMockVenue` devuelve undefined para los partidos seed); nº de venues ≥ decenas (los de CAMPOS).

### T5 — Config de antelación por categoría

- **Qué**: `apps/web/src/lib/availability-deadline.ts` con `AVAILABILITY_DEADLINE_DAYS: Record<RefereeCategory, number>` (defaults decisión 10) y `getAvailabilityDeadline(category, saturdayDate): Date` (sábado − N días, fin de ese día). Retirar `AVAILABILITY_DAYS_ADVANCE` de `.env.example` (y anotar el cambio en el CLAUDE.md del proyecto, sección Variables de Entorno, como parte de esta tarea porque el cambio lo provoca esta feature).
- **Tests**: Vitest: cada categoría devuelve su fecha correcta; categoría null/desconocida → default más restrictivo (12 días); límite exacto (declarar el mismo día del deadline = permitido, día siguiente = bloqueado).
- **Ficheros**: `apps/web/src/lib/availability-deadline.ts`, `apps/web/src/lib/__tests__/availability-deadline.test.ts`, `.env.example`, `CLAUDE.md`.
- **Aceptación**: `pnpm -F @fbm/web test` en verde; `grep AVAILABILITY_DAYS_ADVANCE` solo aparece ya en documentación histórica si procede, no en código ni `.env.example`.

### T6 — Modelo de disponibilidad de jornada + materialización

- **Qué**:
  - Tipo `MatchdayAvailability = { id, personId, saturdayDate, saturdayMorning, saturdayAfternoon, sundayMorning, sundayAfternoon, weekdayDays: number[] /* 0=lunes…4=viernes, ALTA 17:30–22:00 */, notes: string | null, updatedAt }` + array `mockMatchdayAvailabilities` con 2-3 registros demo (incluido `DEMO_PERSON_ID`), incluido en `resetMockData()`.
  - `apps/web/src/lib/matchday-availability.ts`: constantes de franjas (decisión 9), `materializeToSlots(record): AvailabilitySlot[]` (sábado → weekStart lunes de esa semana + dayOfWeek 5; domingo → dayOfWeek 6; días de entre semana → fecha única en la ventana viernes→jueves, con su weekStart correspondiente, franja 17:30–22:00) y helpers de ventana de jornada.
  - Ruta `apps/web/src/app/api/availabilities/matchday/route.ts`: GET por `personId`+`saturdayDate`; POST valida deadline con `getAvailabilityDeadline` (403 si vencido, con mensaje), upsert del registro y re-materializa: elimina de `mockAvailabilities` los slots de esa persona en las semanas afectadas y escribe los derivados.
  - Corregir `isPersonAvailable` en `mock-data.ts` para comparar en minutos (decisión 9).
- **Tests**: materialización de un registro completo (esperar slots exactos con sus weekStart); jornada que cruza mes; `isPersonAvailable` con partido a las 15:00 (mañana → true con franja mañana) y 15:30 (tarde); POST fuera de plazo → 403.
- **Ficheros**: `apps/web/src/lib/matchday-availability.ts`, `apps/web/src/lib/__tests__/matchday-availability.test.ts`, `apps/web/src/lib/mock-data.ts`, `apps/web/src/app/api/availabilities/matchday/route.ts`, `types.ts`.
- **Aceptación**: `pnpm -F @fbm/web test` en verde; con la app corriendo, un POST manual (curl) crea el registro y `GET /api/availabilities?personId=...&weekStart=...` devuelve los slots materializados; el panel de asignación admin refleja la disponibilidad sin haberlo tocado.

### T7 — UI del portal: formulario de franjas

- **Qué**: rehacer `apps/web/src/app/(portal)/disponibilidad/page.tsx` con un componente nuevo `matchday-availability-form.tsx` espejo del Google Form: selector de jornada (sábados futuros), 4 toggles ALTA/BAJA (sáb/dom × mañana/tarde) con las horas de cada franja visibles, multi-select de días de entre semana (17:30–22:00), textarea de observaciones, y aviso de fecha límite según la categoría de la persona (bloqueo de edición + mensaje si vencido). Guardado contra `/api/availabilities/matchday` con toast (sonner, patrón existente). Retirar `availability-grid.tsx` si queda huérfano (verificar con grep antes de borrar; si lo usa la demo, dejarlo y anotarlo).
- **Ficheros**: `apps/web/src/app/(portal)/disponibilidad/page.tsx`, `apps/web/src/components/matchday-availability-form.tsx`, posible borrado de `apps/web/src/components/availability-grid.tsx`.
- **Aceptación**: flujo manual en dev: marcar franjas y guardar → recargar y persisten; con una jornada cuya fecha límite ya pasó, el formulario aparece bloqueado con el mensaje del plazo de su categoría; typecheck y lint en verde.

### T8 — Panel admin: observaciones de jornada visibles

- **Qué**: en el panel de asignación (`apps/web/src/app/(admin)/asignacion/page.tsx` + `person-picker.tsx`/`assignment-slot.tsx`, el que liste personas disponibles), mostrar un indicador (icono con tooltip) cuando la persona tiene `notes` en su disponibilidad de la jornada del partido, con el texto de la observación. Solo lectura, sin más cirugía.
- **Ficheros**: los 2-3 componentes admin que listan candidatos (confirmar con grep cuál renderiza la lista de disponibles).
- **Aceptación**: en dev, una persona con observaciones demo muestra el tooltip en la lista de candidatos del partido de esa jornada; personas sin notas no muestran nada; typecheck en verde.

### T9 — Verificación integral

- **Qué**: fase adversarial separada: `pnpm -F @fbm/web typecheck && pnpm -F @fbm/web lint && pnpm -F @fbm/web test`, smoke manual de los 3 flujos (importar xlsx real → partidos con pista visibles; declarar franjas → aparecen en admin; deadline vencido → bloqueo), revisar orphans (imports muertos de la cuadrícula, `AVAILABILITY_DAYS_ADVANCE`), y repasar edge cases: partido a las 15:30 en punto, jornada con sábado a fin de mes, xlsx con hoja inesperada.
- **Aceptación**: los 3 comandos en verde + checklist de smoke documentada al pie de este fichero al cerrar.

---

## Notas fuera del task breakdown

- **Gap conocido (decisión del usuario, NO abordar aquí)**: toda la app corre sobre mock-data en memoria; no hay Drizzle/Postgres ni autenticación en runtime. Cuando se conecte la BD real, `mockCourts`, los campos nuevos de venues, `mockMatchdayAvailabilities` y la tabla de antelaciones tienen su reflejo preparado en `schema.ts`/tipos y deberán migrar con el resto.
- **Datos personales**: el xlsx real contiene nombres (árbitros, sancionados). No commitearlo al repo ni usarlo como fixture; los tests usan workbooks sintéticos (decisión 11).
- **A confirmar con el comité**: mapeo exacto categoría → días de antelación (defaults propuestos en decisión 10) y si la franja "mañana" termina a las 15:30 exactas también entre semana (asumido: entre semana es solo 17:30–22:00).
- **Mejora anotada, no incluida**: el importador CSV hace fallback silencioso a `venue-001` cuando no encuentra pabellón; tras T4 (pabellones reales) convendría alinearlo con el comportamiento del XLSX (crear o rechazar).

---

## Estado de ejecución (cerrado 2026-07-10 · ejecutor Mixto)

Plan completo T1-T9 ejecutado y committeado. 9 commits (`01b3757`..`23eeda3`).

| Tarea                                                     | Ejecutor                  | Commit    | Estado |
| --------------------------------------------------------- | ------------------------- | --------- | ------ |
| T1 modelo pistas + venue                                  | sonnet                    | `01b3757` | ✅     |
| T5 antelación por categoría (feb 12/nac 10/auto 8/prov 7) | sonnet                    | `5a8b065` | ✅     |
| T2 parser XLSX multi-hoja (17 tests)                      | Fable                     | `78a56eb` | ✅     |
| T3 ruta + diálogo import XLSX                             | sonnet                    | `78cae7e` | ✅     |
| T4 seed 108 pabellones reales (CAMPOS)                    | haiku                     | `4c30d3c` | ✅     |
| T6 disponibilidad por franjas + materialización           | sonnet                    | `1074a6b` | ✅     |
| T7 formulario portal (sustituye cuadrícula)               | sonnet                    | `5e8fcd0` | ✅     |
| T8 observaciones jornada en admin                         | sonnet                    | `7fa7aba` | ✅     |
| T9 verificación + review adversarial + fixes              | Fable review / sonnet fix | `23eeda3` | ✅     |

### Gate automatizado (verde)

`pnpm -F @fbm/web typecheck` ✓ · `lint` ✓ · `test` → **41 tests** ✓. Integridad: 108 venues, 0 referencias colgadas venue/municipio, `venue-001..020` intactos. Huérfanos: `AVAILABILITY_DAYS_ADVANCE` retirado (solo queda en comentario), `availability-grid` borrado sin referencias, `WeekSelector` conservado (lo usa el diálogo de alertas admin).

### Review adversarial (Fase 4) — 5 defectos corregidos en `23eeda3`

1. **Re-materialización cross-jornada**: el borrado por `weekStart` entero eliminaba la disponibilidad L-J de la jornada N al guardar la N+1 (comparten semana ISO). Fix: borrar por huella exacta `(weekStart, dayOfWeek)` (`getMatchdaySlotFootprint`).
2. **Lookup de jornada L-J**: el indicador admin usaba el sábado de la misma semana; L-J pertenecen al sábado anterior. Fix: `getJornadaSaturdayForDate` (inverso de la ventana).
3. `resetMockData()` no restauraba `mockVenues` (creados por el import XLSX). Fix: snapshot `INITIAL_VENUES`.
4. POST matchday: guarda `Array.isArray(weekdayDays)` → 400.
5. demo-generate no vaciaba `mockMatchdayAvailabilities` (orphans). Fix aplicado.

### Pendiente / cabos sueltos

- **Smoke: parte sin navegador VERDE (2026-07-18), falta la visual.** Verificado sin navegador: server :3000 + páginas (partidos/disponibilidad/asignacion) 200 + import del xlsx real (707 partidos, 71 venues, 77 pistas), log limpio. La **pista ya se renderiza** en detalle admin y portal (commit `1f64fe0`). PENDIENTE solo la validación visual (deadline vencido deshabilita toggles; franjas declaradas aparecen en `/asignacion`): requiere conectar la extensión de Chrome (no viable en remoto). La lógica está cubierta por unit tests.
- **M2 (por diseño)**: reimportar el mismo xlsx duplica partidos con nuevo nº de jornada (aceptado en el plan, como el CSV). Sin dedupe por decisión explícita.
- **Nota seed (M3)**: los `mockMatchdayAvailabilities` sembrados no están materializados en `mockAvailabilities` (franjas de 1h del seed antiguo), así que en la demo un registro puede mostrar "Alta" mientras el picker discrepa hasta re-guardar. No se re-arquitecturó el seed (fuera de alcance); se corrige solo al declarar de nuevo.
- **.gitignore**: incorpora `*.eml`/`*.xlsx` (PII) como cambio preexistente en el árbol; sin commitear aún (protege ya el árbol de trabajo).
- **`/simplify` no ejecutado** en esta sesión (conversación larga); recomendable como pasada posterior sobre el diff.
