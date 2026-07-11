# Plan: Añadir personal arbitral (770 árbitros) + tabla de elegibilidad (2026-07-11)

Estado: **EJECUTADO Y VERIFICADO**
Planner: project-claude | Modelo: fable 5 (petición del usuario) | Alcance elegido: **"Personal + tabla de reglas"** (sin tocar solver/validaciones)

## Resultado

- `referee-eligibility.ts` (matriz + labels + helpers), `referee-roster.ts` (generador determinista), integrado en `mock-data.ts` (779 personas = 9 seed + 770). Tipos `EnrichedPerson` + propagación en API de personas. UI: categoría fina + nick en `person-card` y `person-detail-sheet` (D3b = "mostrar categoría fina", confirmado).
- Nicks: **únicos, sin sufijos numéricos ni romanos** (corrección del usuario). Pool determinista = motes de una palabra (barrios/pueblos/parajes de Madrid) + compuestos "APODO DE LUGAR".
- Gate: **typecheck 0 · 109 tests** (10 ficheros; +14 de roster/elegibilidad). Solver 6/6 intacto con 779 personas. Muestra: 770 nicks únicos, 0 con romanos/dígitos.
- Determinismo verificado (semilla fija, sin Math.random/Date.now → sin mismatch SSR). `resetMockData` conserva los 779 (INITIAL_PERSONS se captura tras el spread).
- **Cabo (notificado, no tocado):** `/api/admin/demo` acción `generate` vacía `mockPersons` y crea su propio escenario demo → tras "Generar datos demo" NO están los 770 (vuelven al recargar / `reset`). Fuera de alcance.
- **Matriz = BORRADOR:** 4 ambigüedades marcadas [AMBIGUO-1..4] en `referee-eligibility.ts` pendientes de validar. La matriz NO la consume el solver todavía (fase B).

## Decisiones ya confirmadas por el usuario

- D0 Alcance: generar el personal + codificar las reglas como matriz de datos, **SIN** modificar el motor de asignación (`meetsMinCategory`), validaciones ni UI de asignación.
- D1 Javier (ALTOS) y su hermano (CABREJAS): **NO** se incluyen.
- D2 Total: **770 árbitros**, todos `role: 'arbitro'`. Distribución exacta abajo.

## Distribución (770)

| Nivel fino (`refereeLevel`)   |  Nº | `category` legacy (mapeo) |
| ----------------------------- | --: | ------------------------- |
| `nacional`                    |  60 | nacional                  |
| `feb`                         |  40 | feb                       |
| `primera_aut` (1ª autonómica) |  70 | autonomico                |
| `autonomico_oro` (2ª aut oro) |  50 | autonomico                |
| `autonomico_plata`            | 100 | autonomico                |
| `autonomico_bronce`           | 150 | autonomico                |
| `escuela`                     | 300 | provincial                |

## Decisión de modelado (clave) — D3, a validar

El campo actual `category` alimenta la UI (`categoryLabels[...]`) y el solver (`CATEGORY_RANK`/`meetsMinCategory`, que solo entiende provincial/autonomico/nacional/feb).

- **Propuesta (M2, surgical):** cada persona nueva lleva **dos campos**:
  - `category` = valor **legacy** mapeado (tabla arriba) → la UI y el solver siguen funcionando sin cambios.
  - `refereeLevel` = valor **fino** nuevo → alimenta la matriz de elegibilidad.
  - `nick` = nombre de guerra (campo nuevo).
- **Consecuencia:** en la pantalla de Personal el árbitro se verá con su categoría legacy (Nacional / FEB / Autonómico / Provincial), **no** el nivel fino oro/plata/bronce, hasta una fase B.
- **Extra opcional de bajo riesgo (D3b):** añadir labels finos y mostrar `refereeLevel` en `person-card` / `person-detail-sheet` (no toca solver). Incluir solo si el usuario lo pide.

## Modelo de datos (cambios de tipo)

- `mock-data.ts`: objetos de persona con `nick: string` y `refereeLevel: RefereeLevel`.
- `types.ts` `EnrichedPerson`: añadir `nick?: string` y `refereeLevel?: string | null` (opcionales → no rompe consumidores).
- Nuevos módulos:
  - `lib/referee-eligibility.ts`: tipos `RefereeLevel`, `CompetitionCategory`, `EligibleRole`, constante `ELIGIBILITY` + helper `canOfficiate()`. **Datos, sin uso en runtime del solver.**
  - `lib/referee-roster.ts`: `generateReferees(municipalityIds): Person[]` — generación **determinista** (PRNG con seed fijo; nada de `Math.random()`/`Date.now()` → evita mismatch de hidratación SSR y mantiene estabilidad).

## Integración en mock-data.ts (sin romper)

- Renombrar el literal actual `export const mockPersons = [...]` (9 personas) → `const seedPersons = [...]`.
- `export const mockPersons = [...seedPersons, ...generateReferees(mockMunicipalities.map(m => m.id))]`.
- `generateReferees` NO importa `mock-data` (recibe los ids por parámetro) → sin ciclo de imports.
- IDs nuevos: `person-a0001`..`person-a0770` (no colisionan con `person-001..009`).

## Matriz de elegibilidad (borrador — se entrega para que el usuario la afine)

Roles: **P** = principal, **A** = auxiliar/vinculado, **—** = no pita. `excl` = categoría reservada a ese nivel.
Categorías de competición canónicas: `nacional`, `primera_aut`, `segunda_aut_oro/plata/bronce`, `junior_pref`, `junior_especial_oro/plata/bronce`, `sub22_plata/bronce`, `cadete_pref`, `infantil_pref`, `minibasket`.

- **nacional (60):** P en `nacional` (pareja 2×nacional o nacional + primera_aut vinculado) y en todo lo demás **salvo** `primera_aut` (—). Foco: junior_especial_oro, junior_pref, cadete_pref, infantil_pref. Siempre principal.
- **feb (40):** P en todo **menos** `nacional` (—), `primera_aut` (—) y la escuela `cadete_pref`/`infantil_pref`/`minibasket` (—, "no pita solos"). Sí P en `junior_pref` (a doble). Foco ORO.
- **primera_aut (70):** P **excl** en `primera_aut`. A en `nacional` y como auxiliar de feb (junior*especial_oro). P (foco) en `segunda_aut*\*`, `junior_pref`, `sub22_plata/bronce`, `junior_especial_plata/bronce`, y escuela.
- **autonomico_oro (50):** P **excl** en `segunda_aut_oro`. P en `segunda_aut_plata/bronce` y escuela. A (vinculado/auxiliar) en `primera_aut`, `nacional`, junior_especial (de feb/nacional).
- **autonomico_plata (100):** P en `segunda_aut_plata` (excl o con nacional/primera_aut) y `segunda_aut_bronce` y escuela. A en `segunda_aut_oro`, `nacional`, `primera_aut`, y auxiliar de feb.
- **autonomico_bronce (150):** P/A en `segunda_aut_bronce` (tope máximo; con feb/nacional/primera_aut/2a oro/2a plata de principal). P en escuela. Nada por encima de 2ª bronce.
- **escuela (300):** P **solo** en `minibasket`, `infantil_pref`, `cadete_pref`. A en `junior_pref` (a doble, en especial junto a primera_aut). Pitan más solos que a dobles.

**Ambigüedades marcadas para validar contigo (se dejan comentadas en el módulo):**

1. ¿`feb` puede entrar en `segunda_aut_oro` (choca con la exclusiva de autonómico_oro) o queda fuera?
2. 1ª autonómica: ¿distinguimos oro/plata/femenino como competiciones separadas, o basta un único bloque `primera_aut`?
3. "Van de principales de escuela" (primera_aut / autonómicos): en escuela (partido de 1 árbitro) ¿van solos o a doble con un escuela de auxiliar?
4. Género (masc/fem) de las competiciones: ¿lo modelamos en la matriz o lo ignoramos por ahora?

## Tareas (ejecutor / effort)

1. **T1 — Módulo elegibilidad** `lib/referee-eligibility.ts`: tipos + `ELIGIBILITY` + `canOfficiate` + comentarios citando cada regla y las 4 ambigüedades. _(ejecutor: yo/fable · effort: xhigh — es el núcleo de dominio)_
2. **T2 — Generador** `lib/referee-roster.ts`: PRNG seed fijo; nombres realistas ES; **nicks únicos**; municipios con sesgo a Madrid capital; `hasCar` mayoritario; IBAN/email/teléfono ficticios; `category` legacy + `refereeLevel` + `nick`. _(ejecutor: yo/sonnet · effort: high)_
3. **T3 — Integración** `mock-data.ts` (seedPersons + spread) y `types.ts` (`nick`, `refereeLevel`). _(ejecutor: yo/sonnet · effort: low)_
4. **T4 — (opcional D3b)** labels finos + display de `refereeLevel` en person-card/detail. _(solo si el usuario lo pide)_

## Criterios de aceptación

- `mockPersons.length === 9 + 770 === 779`; conteo por `refereeLevel` == distribución exacta (60/40/70/50/100/150/300).
- Todos los `nick` únicos; todos los IDs únicos; `role === 'arbitro'`.
- `category` de cada uno ∈ {nacional, feb, autonomico, provincial} (solver/UI intactos).
- Generación **determinista**: dos ejecuciones dan el mismo resultado (mismos nicks/municipios) → sin mismatch SSR.
- `ELIGIBILITY` cubre los 7 niveles; `canOfficiate` responde coherente con el borrador.

## Gate de verificación (Fase 4)

1. `npm run typecheck` = 0 y `npm run test` verde (los tests existentes no deben romperse por +770 personas).
2. Smoke runtime: la pantalla de Personal lista 779 y no explota; dashboard cuenta bien.
3. Review adversarial del diff (subagente, effort alto): determinismo, unicidad, no-ciclos, no romper consumidores de `mockPersons`.
4. `verification-before-completion` + `simplify` si el diff lo amerita.

## Notas / lessons aplicadas

- No tocar `calendario_piloto_fbm*.csv` (entregable del usuario).
- No over-engineer: datos deterministas simples, sin infra nueva de runtime.

## Pendiente próxima sesión (2026-07-12) — "lo hacemos mañana"

1. **Validar las 4 ambigüedades** `[AMBIGUO-1..4]` de `referee-eligibility.ts` con el usuario:
   (1) ¿feb entra en `segunda_aut_oro` o queda fuera por la exclusiva de autonómico_oro?
   (2) ¿desglosar `primera_aut` en oro/plata/femenino?
   (3) principales de escuela: ¿van solos o a doble con un escuela de auxiliar?
   (4) ¿modelar género (masc/fem) de las competiciones?
2. **Fase B (opcional):** integrar la matriz `ELIGIBILITY` en el solver/validaciones (hoy el solver sigue con `meetsMinCategory` lineal).
3. **Smoke visual** de la pantalla Personal (levantar la app, ver categoría fina + nick en 779 personas).
4. **Decisión demo:** ¿`/api/admin/demo` (generate) debe incluir los 770, o se deja reemplazando por su escenario?
5. **Horas del piloto:** el usuario tenía `calendario_piloto_fbm_horas.csv` (horas inventadas para los 155 partidos a 00:00). Confirmar que se importó; regenerar si la FBM confirma horas reales.
