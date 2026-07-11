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
