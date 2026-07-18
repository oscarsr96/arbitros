# Plan: integrar el modelo real de 7 niveles en el solver (elegibilidad fina)

> Plan autosuficiente para una sesión NUEVA sin contexto previo. Proyecto:
> `C:\Users\javie\Desktop\proyectos\FBM\arbitros` (Next.js 14, `apps/web`).
> NO empezar a implementar sin resolver antes las **Decisiones abiertas** con el usuario.

---

## 1. Spec / objetivo y estado actual (mini-spec)

**Objetivo**: que el solver greedy (`apps/web/src/lib/solver.ts`) deje de validar árbitros con el
ranking lineal legacy (`provincial < autonomico < nacional < feb`) y pase a usar la matriz real FBM
de 7 niveles (`apps/web/src/lib/referee-eligibility.ts`: `ELIGIBILITY`, `canOfficiate`,
`eligibleRoles`, tipos `RefereeLevel` y `CompetitionCategory`), incluyendo la dimensión de ROL
(principal / auxiliar) conectada a las posiciones de slot de la Tanda 2
(`designation-positions.ts`: slot 0 de árbitro = `principal`, slot 1 = `auxiliar`).

**Estado actual verificado (2026-07-18)**:

- El solver aplica hoy la categoría en 2 puntos de `solver.ts`:
  - `findBestCandidate` (~L633-636): `if (role === 'arbitro' && match.competition?.minRefCategory) { if (!meetsMinCategory(person.category, ...)) continue }`.
  - `getUnassignedReason` (~L784-791): mismo check para el contador `categoría insuficiente`.
  - Además `CATEGORY_RANK` (~L49-54) ordena partidos por prioridad (`solve` ~L332-340 y
    `shuffleWithinGroups` ~L714-718) usando `minRefCategory`.
- `meetsMinCategory`/`CATEGORY_RANK` están duplicados en `mock-data.ts` (~L2224-2233, exportados)
  y los consumen también los pickers manuales: `asignacion-view.tsx` (~L447-455, `pickerPersons`)
  y `substitution-panel.tsx` (~L80-88).
- Cada árbitro del roster generado (770, `referee-roster.ts`) lleva `refereeLevel` fino Y
  `category` legacy vía `LEGACY_CATEGORY_BY_LEVEL`. **PERO** los 5 árbitros seed demo
  (`person-001/002/003/006/007` en `mock-data.ts` ~L1395-1549) NO tienen `refereeLevel`.
- **GAP CLAVE confirmado**: ni las competiciones ni los partidos llevan `CompetitionCategory`
  fina. Las competiciones (`demoCompetitions` en `mock-data.ts` ~L167-268, y las 2 importadas en
  `fbm-calendar/fbm-seed.json`) solo tienen `category` (slug comercial: `preferente`, `junior`,
  `liga-vips-masculina`, ...) y `minRefCategory` legacy. El importador
  (`fbm-calendar/category-mapping.ts`, `CATEGORY_FAMILIES`) tampoco produce categoría fina.
  Sin ese tag no se puede consultar `ELIGIBILITY`.
- Los dos call-sites de `solve()` enriquecen personas SIN `refereeLevel` (hay que añadirlo):
  `app/api/optimize/route.ts` (~L66-88) y `app/api/admin/demo/route.ts` (~L480-500).
  `EnrichedPerson` (`lib/types.ts` L80-98) ya declara `refereeLevel?: string | null`.
- El solver produce `ProposedAssignment` SIN posición; al aplicar la propuesta,
  `POST /api/admin/designations` (L83) rellena posición con `autoFillPosition` (primera libre).
  El endpoint YA acepta `position` explícita.
- Anotadores: escala propia (`escuela/autonomico/nacional` en el mismo campo `category`), sin
  entrada en `ELIGIBILITY`; el solver NO les aplica ningún check de categoría hoy (el check está
  condicionado a `role === 'arbitro'`).
- Partidos reales importados: 324 en `fbm-seed.json`, SOLO 2 competiciones
  (`1ª División Nacional Masculina` y `Junior Masculino ORO`).
- Tests actuales del solver: `lib/__tests__/solver.test.ts` (mockea `../mock-data`; helpers
  `makeMatch`/`makePerson` con defaults `minRefCategory: 'provincial'`, `category: 'autonomico'`,
  sin `refereeLevel` ni categoría fina). Tests de la matriz: `lib/__tests__/referee-roster.test.ts`.

**Diseño elegido (resumen)**: taguear cada competición con una `fineCategory` (resuelta por nombre
canónico, sin tocar el JSON del seed), propagarla a `EnrichedMatch.competition`, y sustituir el
check del solver por un helper único `checkSlotEligibility(person, competition, slotPosition)` con
**fallback legacy**: si el partido no tiene categoría fina o la persona no tiene `refereeLevel`,
se aplica `meetsMinCategory` como hasta ahora. El solver pasa a saber QUÉ posición está rellenando
(principal o auxiliar) y emite `position` en cada `ProposedAssignment`.

---

## 2. Decisiones abiertas (BLOQUEANTES: resolver con el usuario antes de ejecutar)

Preguntar todas al arranque de la sesión de ejecución. No inventar respuestas.

**D1. Mapeo competición → `CompetitionCategory` fina.** Propuesta de tabla; confirmar cada fila
(las marcadas ¿? son ambiguas de verdad, no hay dato en el repo):

| Competición (id, fuente)                                                        | `category` actual                                | Fina propuesta                 | ¿Ambigua?                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Liga VIPS Masc/Fem (`comp-001/002`, demo)                                       | `preferente`                                     | `nacional`                     | Sí ¿? (VIPS = 1ª Div Nacional según `category-mapping.ts`, pero confirmar que "1ª Div Nacional" ES la categoría `nacional` de la matriz) |
| 1ª División Nacional Masc (`fbm-comp-1-DIVISION-NACIONAL-MASCULINA`, import)    | `liga-vips-masculina`                            | `nacional`                     | Ídem D1a                                                                                                                                 |
| Junior Masculino ORO (`comp-004` demo y `fbm-comp-JUNIOR-MASCULINO-ORO` import) | `junior` / `junior-masculino-liga-ahorramas-oro` | `junior_especial_oro`          | Sí ¿? (¿el "ORO Ahorramas" es `junior_especial_oro` o `junior_pref`?)                                                                    |
| Junior Femenino ORO (`comp-005`, demo)                                          | `junior`                                         | igual que el masculino         | Sí ¿?                                                                                                                                    |
| Sub-22 Masculina (`comp-003`, demo)                                             | `sub22`                                          | `sub22_plata` o `sub22_bronce` | Sí ¿?                                                                                                                                    |
| Cadete Masc/Fem ORO (`comp-006/007`, demo)                                      | `cadete`                                         | `cadete_pref`                  | Sí ¿? (la matriz solo tiene `cadete_pref`; ¿"Cadete ORO" cae ahí?)                                                                       |
| Infantil Masc/Fem (`comp-008/009`, demo)                                        | `infantil`                                       | `infantil_pref`                | No (única opción)                                                                                                                        |
| Preferente Masculina (`comp-010`, demo)                                         | `1a_division`                                    | `primera_aut_oro`/`_plata`?    | Sí ¿? (nombre confuso: ¿es 1ª autonómica? ¿oro o plata?)                                                                                 |
| Familias futuras del CSV (`category-mapping.ts`): 2ª Div Aut Masc BRONCE        |                                                  | `segunda_aut_bronce`           | No                                                                                                                                       |
| 2ª Div Aut Fem PLATA                                                            |                                                  | `segunda_aut_plata`            | Sí ¿? (la matriz no tiene dimensión de género salvo `primera_aut_fem`; ¿la femenina plata usa la misma entrada?)                         |

**D2. Partido sin categoría fina** (competición no mapeada, imports futuros): (a) fallback al
check legacy `meetsMinCategory` [recomendado: degradación suave, no rompe imports], o (b) excluir
el partido de la elegibilidad fina y avisar (slot queda sin candidatos si nadie cumple legacy).

**D3. Semántica del slot auxiliar**: ¿un nivel cuyo rol elegible es solo `['principal']` puede
ocupar el slot Auxiliar? (a) Sí: pareja 2×principal válida (los comentarios de la matriz hablan
de "pareja 2×nacional", apunta a que sí) [recomendado], (b) No: el slot auxiliar exige
literalmente `auxiliar` en `eligibleRoles`. Sub-pregunta opcional: ¿el solver debe PREFERIR
(soft, no hard) auxiliares puros para el slot auxiliar y reservar principales? (por defecto: no,
el score sigue siendo coste+carga).

**D4. Árbitros sin `refereeLevel`** (los 5 seed demo con `category` legacy): (a) fallback legacy
solo para ellos [recomendado, cero riesgo], (b) inferirles un nivel (nacional→`nacional`,
provincial→`escuela`, pero `autonomico`→¿`primera_aut`? ¿`autonomico_plata`? ambiguo), (c)
asignarles `refereeLevel` a mano en el seed.

**D5. Anotadores (mesa)**: confirmar que se quedan COMO HOY (sin restricción de elegibilidad; la
matriz es solo de árbitros). Recomendado: sí, sin cambios funcionales; el solver solo les añade
`position` informativa (anotador/crono/24") en la propuesta.

**D6. Alcance de la coherencia UI**: ¿migran también los pickers manuales
(`asignacion-view.tsx` `pickerPersons`, `substitution-panel.tsx`) al mismo helper de elegibilidad
en esta tanda [recomendado, si no el picker permite lo que el solver prohíbe], o solo el solver y
la UI queda para un follow-up?

---

## 3. Task breakdown (ordenado por dependencia)

Etiquetas: EJECUTOR `sonnet` (implementación estándar) o `PLANNER` (=fable, la dificultad vive en
la ejecución). ESFUERZO `low` / `high` (default) / `xhigh`.

### T1. Módulo de categoría fina por competición

- **EJECUTOR**: sonnet - **ESFUERZO**: high - **Depende de**: D1, D2 resueltas.
- Crear `apps/web/src/lib/competition-fine-category.ts` (módulo hoja, puro, sin imports de
  mock-data): mapa `FINE_CATEGORY_BY_CANONICAL: Record<string, CompetitionCategory>` keyed por
  nombre canónico de competición (según tabla D1 confirmada) + función
  `resolveFineCategory(comp: { name: string; category: string }): CompetitionCategory | null`
  (null = sin tag → fallback legacy). Resolver por nombre normalizado (reutilizar el estilo de
  `normalizeText` de `category-mapping.ts`) para cubrir demo e importadas sin tocar
  `fbm-seed.json` ni el shape del store `globalThis.__fbmMockStore` (¡no romper la hidratación
  JSON de `designation-persistence.ts`!).
- Añadir `fineCategory` opcional a `CategoryMapping`/`CATEGORY_FAMILIES` en
  `fbm-calendar/category-mapping.ts` para que imports futuros salgan tagueados (con
  `resolveFineCategory` como única fuente para no duplicar la tabla).
- **Criterios de aceptación**: test unitario nuevo `competition-fine-category.test.ts`: cada
  competición demo + las 2 del seed FBM resuelven a la fina esperada; nombre desconocido → null;
  `pnpm test` y `pnpm typecheck` verdes.

### T2. Tipos y threading de datos hasta el solver

- **EJECUTOR**: sonnet - **ESFUERZO**: low - **Depende de**: T1.
- `lib/types.ts`: añadir `fineCategory?: CompetitionCategory | null` a
  `EnrichedMatch['competition']` y `position?: DesignationPosition` a `ProposedAssignment`.
- `app/api/optimize/route.ts` (enrich ~L47-63 y ~L66-88): poblar
  `competition.fineCategory = resolveFineCategory(competition)` y
  `refereeLevel: p.refereeLevel ?? null` en las personas.
- `app/api/admin/demo/route.ts` (enrich ~L480-500): mismo threading de `refereeLevel` y
  `fineCategory` (el fallback TS del demo usa `solve`).
- **Criterios**: `pnpm typecheck` verde; un test de la ruta (o assert en test de solver de T7)
  verifica que la persona enriquecida lleva `refereeLevel`.

### T3. Helper único de elegibilidad por slot

- **EJECUTOR**: sonnet - **ESFUERZO**: high - **Depende de**: T2, D2/D3/D4 resueltas.
- En `referee-eligibility.ts` (o módulo hermano), función pura:
  `checkSlotEligibility(person: { role, category, refereeLevel? }, competition: { fineCategory?, minRefCategory } | undefined, slotPosition?: 'principal' | 'auxiliar'): boolean`
  con esta semántica:
  - `role !== 'arbitro'` → true (anotadores fuera del modelo, D5).
  - `fineCategory` presente Y `refereeLevel` presente → modelo fino:
    `roles = eligibleRoles(refereeLevel, fineCategory)`; slot `principal` exige
    `roles.includes('principal')`; slot `auxiliar` según D3 (recomendado: `roles.length > 0`);
    sin `slotPosition` (uso genérico UI): `roles.length > 0`.
  - Si falta `fineCategory` o `refereeLevel` → fallback legacy `meetsMinCategory(category, minRefCategory)`
    (según D2/D4).
- **Criterios**: tests unitarios que cubran: nacional puede principal en `nacional`; feb NO puede
  `segunda_aut_oro` ni `nacional`; escuela auxiliar sí / principal no en `junior_pref`; fallback
  legacy cuando falta nivel o falta fina; anotador siempre true. Verdes con `pnpm test`.

### T4. Integración en el solver (slots con posición)

- **EJECUTOR**: PLANNER (fable) - **ESFUERZO**: xhigh - **Depende de**: T3.
- Cambios en `lib/solver.ts`:
  1. **Posiciones libres por partido**: antes del bucle de slots de árbitro (~L347-416), calcular
     las posiciones NO reclamadas usando las designaciones existentes del partido
     (`existingByMatch`) reutilizando la lógica de `designation-positions.ts`
     (`mapDesignationsToSlots` / estilo `autoFillPosition`). Con `forceExisting=true` las
     existentes ocupan sus posiciones (explícitas primero, legacy rellenan huecos); con
     `forceExisting=false` todas las posiciones (`principal`, `auxiliar`, y para mesa
     `anotador/cronometrador/veinticuatro`) quedan libres en orden. OJO: las designaciones mock
     pueden llevar `position` opcional o no llevarla (legacy del piloto).
  2. **`findBestCandidate`**: nuevo parámetro `slotPosition`; sustituir el bloque
     `meetsMinCategory` (~L633-636) por `checkSlotEligibility(person, match.competition, slotPosition)`.
  3. **`getUnassignedReason`**: recibir la posición del slot diagnosticado y usar el mismo
     helper; renombrar/añadir contador (p. ej. `X nivel no elegible` cuando aplica el modelo
     fino, mantener `categoría insuficiente` para el fallback legacy).
  4. **Orden de prioridad de partidos** (~L332-340 y `shuffleWithinGroups`): con categoría fina,
     ordenar por ESCASEZ (mapa estático `FINE_PRIORITY` por `CompetitionCategory`: `nacional` y
     `primera_aut_*` primero, escuela al final); sin fina, mantener `CATEGORY_RANK` legacy.
     Mantener el shuffle por grupos de igual prioridad.
  5. **Salida**: cada `ProposedAssignment` (árbitros Y anotadores) lleva `position` del slot que
     cubrió. `solvePartial` (~L820): derivar la posición libre del slot re-optimizado con la
     misma lógica de posiciones libres y aplicarla en `findBestCandidate` y en la respuesta.
- **Criterios**: TODOS los tests existentes de `solver.test.ts` siguen verdes SIN tocar sus
  asserts (los defaults de `makeMatch`/`makePerson` no llevan fina/nivel → cae al fallback
  legacy); tests nuevos de T7 verdes; `pnpm typecheck` verde; sin regresión de rendimiento
  apreciable (el check es lookup O(1); el test de performance existente <1000ms sigue verde).

### T5. Aplicar propuesta con posición explícita

- **EJECUTOR**: sonnet - **ESFUERZO**: high - **Depende de**: T4.
- `asignacion-view.tsx` `handleApplyProposal` (~L311-348): incluir `position: a.position` en el
  body del batch a `POST /api/admin/designations` (el endpoint ya valida posición vía
  `checkDesignationConflict`; `autoFillPosition` queda como fallback si la propuesta no trae
  posición). Ídem `handleReoptimizeSlot` (~L350+): pasar la posición devuelta por el partial.
- **Criterios**: aplicar una propuesta crea designaciones cuya `position` coincide con la que
  validó el solver (test del route con `position` en el body, o test manual documentado);
  designaciones legacy sin posición siguen funcionando; tests de
  `api/admin/designations/__tests__/route.test.ts` verdes.

### T6. Coherencia de los pickers manuales (según D6)

- **EJECUTOR**: sonnet - **ESFUERZO**: high - **Depende de**: T3 (puede ir en paralelo con T4/T5).
- `asignacion-view.tsx` `pickerPersons` (~L447-455) y `substitution-panel.tsx` (~L80-88):
  sustituir el check `meetsMinCategory` por `checkSlotEligibility` pasando la posición del slot
  activo si está disponible (el slot del picker conoce su índice; `positionForSlot(role, index)`),
  y sin posición en el panel de sustitución si no se conoce. Mensaje de invalidez diferenciado
  ("Nivel no elegible para esta competición" vs "Categoría insuficiente (mín. X)" en fallback).
- **Criterios**: en un partido tagueado `nacional`, el picker marca inválido a un `feb` y válido
  a un `nacional`; en partidos sin fina se comporta como hoy; `pnpm typecheck` + lint verdes.

### T7. Tests nuevos del solver

- **EJECUTOR**: sonnet - **ESFUERZO**: high - **Depende de**: T4.
- En `solver.test.ts` (extendiendo `makeMatch`/`makePerson` con overrides `fineCategory` /
  `refereeLevel`, sin cambiar defaults):
  - Partido `nacional` (2 árbitros): con roster {nacional, primera_aut, feb}: slot principal lo
    cubre el `nacional`, el `feb` NUNCA aparece, el `primera_aut` solo como auxiliar.
  - Escuela en `junior_pref`: puede auxiliar, no principal (si D3=a, un principal-elegible sí
    puede auxiliar).
  - `segunda_aut_oro`: `feb` excluido, `autonomico_oro` asignado.
  - Fallback legacy: partido sin `fineCategory` → mismo resultado que hoy; persona sin
    `refereeLevel` → check legacy.
  - `position` presente y correcta en `ProposedAssignment` (principal en slot 0, auxiliar en
    slot 1; con `forceExisting` y una existente con `position: 'principal'`, el pick nuevo sale
    `auxiliar`).
  - `unassigned.reason` incluye el nuevo contador cuando nadie es elegible.
- **Criterios**: suite completa verde (`pnpm test`), incluidos los tests previos sin modificar
  sus expectativas.

### T8. Medición de impacto en cobertura (informativa, no bloqueante)

- **EJECUTOR**: sonnet - **ESFUERZO**: low - **Depende de**: T4.
- Script puntual (en `apps/web`, ejecutable con tsx, extensión `.ts`, ver lección de scripts en
  `tasks/lessons.md`; borrar `tsconfig.tsbuildinfo` si se elimina después) que corra `solve`
  sobre los 324 partidos del seed FBM + roster completo con disponibilidad total simulada, con y
  sin modelo fino, e imprima cobertura/`unassigned` por competición. Reportar los números al
  usuario (decisión de negocio si la cobertura cae).
- **Criterios**: números antes/después reportados en el resumen final de la sesión.

### T9. Documentación

- **EJECUTOR**: sonnet - **ESFUERZO**: low - **Depende de**: todo lo anterior.
- Actualizar `CLAUDE.md` (sección del motor: restricción 4 pasa a "elegibilidad por matriz de 7
  niveles con fallback legacy"), el comentario "alcance actual" de `referee-eligibility.ts`
  (L6-9, ya no es solo estructura de datos) y la memoria `referee-categories.md` (el solver ya
  consume la matriz).
- **Criterios**: docs coherentes con el código; sin em dashes nuevos en texto propio.

---

## 4. Riesgos y estrategia de tests

**Riesgos**:

1. **Caída de cobertura** (el mayor): con el modelo fino, el pool de "principal" para los 324
   partidos reales se desploma: 1ª Div Nacional pasa de ~470 elegibles legacy (autonómico+) a 60
   (solo nivel `nacional`); Junior ORO (si es `junior_especial_oro`) pasa de 770 a ~100
   principales (nacional+feb). Es el comportamiento CORRECTO según FBM, pero puede dejar slots
   sin cubrir en la demo. Mitigación: T8 mide y se decide con datos; el fallback legacy (D2)
   acota el impacto a partidos tagueados.
2. **Desalineación solver ↔ pickers manuales** si D6 se pospone (el designador podría asignar a
   mano a alguien que el solver considera no elegible). Mitigación: hacer T6 en la misma tanda.
3. **`forceExisting` + posiciones**: designaciones existentes sin `position` (legacy piloto)
   deben reclamar huecos con la MISMA regla que `mapDesignationsToSlots` o el solver validará la
   posición equivocada. Es la parte delicada de T4 (por eso PLANNER/xhigh).
4. **Solver Python del demo** (`services/optimizer`, vía `app/api/admin/demo/route.ts`): NO
   recibe nivel fino; su payload sigue legacy. Queda como limitación conocida (el fallback TS del
   demo sí usa el modelo fino). No tocar en esta tanda; anotar follow-up.
5. **Store `globalThis` / persistencia JSON**: no añadir a los objetos del store campos no
   serializables; `fineCategory` se resuelve en el enrich, no se muta en `mockCompetitions`
   (diseño T1) precisamente para evitarlo.
6. **Deriva de líneas**: los anclajes L### de este plan son orientativos; localizar por nombre de
   función/símbolo.

**Estrategia de tests**:

- Mantener verde TODO lo existente sin editar asserts: `solver.test.ts` (los defaults caen en
  fallback legacy por diseño), `referee-roster.test.ts`, `designation-positions.test.ts`,
  `route.test.ts` de designations, `category-mapping.test.ts`.
- Nuevos: unitarios de `resolveFineCategory` (T1) y `checkSlotEligibility` (T3); tests de solver
  de T7 (elegibilidad fina, posiciones, fallback, unassigned reason).
- Gate final: `pnpm test` + `pnpm typecheck` + `pnpm lint` (y smoke manual del flujo Asignación:
  optimizar → aplicar propuesta → verificar posiciones en slots).

---

## 5. Rollback / compatibilidad

- **Compatibilidad por diseño (fallback, no flag)**: la elegibilidad fina solo se activa cuando
  partido Y persona llevan datos finos; todo lo demás (partidos sin tag, los 5 seed demo sin
  nivel, anotadores, imports con categorías no mapeadas) sigue con `meetsMinCategory` exacto al
  comportamiento actual. No se elimina ningún símbolo legacy (`CATEGORY_RANK`,
  `meetsMinCategory` siguen existiendo y usándose como fallback).
- **Rollback quirúrgico**: vaciar `FINE_CATEGORY_BY_CANONICAL` (o hacer que `resolveFineCategory`
  devuelva siempre null) desactiva el modelo fino en solver y pickers sin tocar el resto del
  código; los tests legacy siguen verdes.
- **Datos**: no se cambia el shape de `mockDesignations` persistidas (`position` ya era opcional
  desde Tanda 2) ni el de `fbm-seed.json`; nada que migrar ni revertir en disco.
- **Si a mitad de ejecución algo se tuerce** (cobertura inaceptable, D1 sin consenso): parar tras
  T3 (helper + tests, sin consumidores) deja `main` estable; T4-T6 son el punto de no retorno
  funcional y van detrás de la medición T8 si el usuario lo prefiere (T8 puede adelantarse con un
  branch de prueba).
