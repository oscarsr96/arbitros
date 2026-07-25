// Mapeo competición → categoría fina de la matriz de elegibilidad (T1, plan
// tasks/todo-solver-7niveles.md). Módulo HOJA y puro: sin imports de
// mock-data.ts ni del store `globalThis.__fbmMockStore`. La `fineCategory` se
// resuelve en el enrich de cada route handler (no se persiste en las
// competiciones mock) para no romper la hidratación JSON de
// `designation-persistence.ts`.
//
// Resuelve por nombre canónico normalizado. Reimplementa `normalizeText` en
// vez de importarla de `fbm-calendar/category-mapping.ts` (mismo estilo) para
// mantener este módulo sin ninguna dependencia cruzada: `category-mapping.ts`
// NO importa `resolveFineCategory` (T1.3, previsto en el plan original, se
// omitió) — el tag fino se resuelve por separado en el enrich de cada route
// handler, por `name` de la competición, como el resto de consumidores.

import type { CompetitionCategory } from './referee-eligibility'

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Decisión D1 (2026-07-18, tasks/todo-solver-7niveles.md sección 2.5) CERRADA
// con el usuario. Keyed por nombre canónico normalizado: cubre a la vez las
// 10 competiciones demo (`mock-data.ts` `demoCompetitions`) y las 2
// importadas del seed FBM (`fbm-calendar/fbm-seed.json`), que reutilizan el
// mismo nombre que su equivalente demo ('Junior Masculino ORO').
export const FINE_CATEGORY_BY_CANONICAL: Record<string, CompetitionCategory> = {
  [normalizeText('Liga VIPS Masculina')]: 'nacional',
  [normalizeText('Liga VIPS Femenina')]: 'nacional',
  [normalizeText('1ª División Nacional Masculina')]: 'nacional',
  [normalizeText('Junior Masculino ORO')]: 'junior_especial_oro',
  [normalizeText('Junior Femenino ORO')]: 'junior_especial_oro',
  [normalizeText('Sub-22 Masculina')]: 'sub22_oro',
  [normalizeText('Cadete Masculino ORO')]: 'cadete_pref',
  [normalizeText('Cadete Femenino ORO')]: 'cadete_pref',
  [normalizeText('Infantil Masculino')]: 'infantil_pref',
  [normalizeText('Infantil Femenino')]: 'infantil_pref',
  // 'Preferente Masculina' (comp-010, mock-data.ts) es en realidad Junior
  // Preferente Masculina (corrección del usuario, D1): misma fina que la
  // familia CSV 'Junior Masculino Preferente' de category-mapping.ts.
  [normalizeText('Preferente Masculina')]: 'junior_pref',
  [normalizeText('Junior Masculino Preferente')]: 'junior_pref',
  // Familias futuras del CSV (`category-mapping.ts` `CATEGORY_FAMILIES`), aún
  // sin competición demo/import equivalente hoy.
  [normalizeText('2ª División Autonómica Masculina BRONCE')]: 'segunda_aut_bronce',
  [normalizeText('2ª División Autonómica Femenina PLATA')]: 'segunda_aut_plata',
  [normalizeText('1ª División Nacional Femenina')]: 'nacional',
  [normalizeText('Sub-22 Masculina PLATA')]: 'sub22_plata',
  // 'cadete_pref' es la única categoría fina de cadete (sin oro/plata en la
  // matriz de elegibilidad): mismo tag que 'Cadete Masculino/Femenino ORO'.
  [normalizeText('Cadete Masculino Preferente')]: 'cadete_pref',

  // ── Ampliación a las 48 categorías reales de los calendarios (T2) ─────────
  // Nombres canónicos producidos por `fbm-calendar/category-mapping.ts`.

  // 1ª Autonómica = Liga Ginos (Bases p. 5, A.5/A.6). Encaje exacto con los
  // tres tags primera_aut_* de la matriz.
  [normalizeText('1ª División Autonómica Masculina ORO')]: 'primera_aut_oro',
  [normalizeText('1ª División Autonómica Masculina PLATA')]: 'primera_aut_plata',
  [normalizeText('1ª División Autonómica Femenina')]: 'primera_aut_fem',

  // 2ª Autonómica: la matriz no distingue género en segunda_aut_*, solo nivel.
  [normalizeText('2ª División Autonómica Masculina ORO')]: 'segunda_aut_oro',
  [normalizeText('2ª División Autonómica Masculina PLATA')]: 'segunda_aut_plata',
  [normalizeText('2ª División Autonómica Femenina ORO')]: 'segunda_aut_oro',
  [normalizeText('2ª División Autonómica Femenina BRONCE')]: 'segunda_aut_bronce',

  // Sub-22. La femenina va a sub22_oro porque las Bases (p. 25) la facturan en
  // la misma fila que la masculina ORO ("Sub-22 Mas. ORO y Sub-22 Fem.") y el
  // campeonato femenino es "Oro 1ª y 2ª División" (Bases p. 5, A.11).
  [normalizeText('Sub-22 Masculina ORO')]: 'sub22_oro',
  [normalizeText('Sub-22 Masculina BRONCE')]: 'sub22_bronce',
  [normalizeText('Sub-22 Femenina')]: 'sub22_oro',

  // Junior especial (Liga Ahorramas). Los calendarios agrupan PLATA y BRONCE en
  // un único literal, así que hay que elegir un tag: se usa
  // junior_especial_plata. Es LOSSLESS hoy: en `ELIGIBILITY`,
  // junior_especial_plata y junior_especial_bronce tienen exactamente los
  // mismos niveles y roles elegibles (nacional/feb/primera_aut, principal).
  // Si alguna vez divergen, hay que separar el literal en dos competiciones.
  [normalizeText('Junior Masculino PLATA/BRONCE')]: 'junior_especial_plata',
  [normalizeText('Junior Femenino PLATA/BRONCE')]: 'junior_especial_plata',
  [normalizeText('Junior Femenino Preferente')]: 'junior_pref',

  // Cadete e Infantil: la matriz solo tiene UN tag por edad (cadete_pref /
  // infantil_pref), sin oro/plata/bronce. Se mantiene la decisión D1 ya
  // existente para 'Cadete Masculino/Femenino ORO' y se extiende al resto de
  // niveles por coherencia. LIMITACIÓN CONOCIDA: cadete_pref e infantil_pref
  // admiten árbitros de nivel 'escuela' como principal, lo que para un Cadete
  // ORO (2 árbitros + 3 mesa, clasificatorio para el Cto. de España) es
  // probablemente demasiado permisivo. Requiere ampliar `CompetitionCategory`
  // con cadete_oro/plata/bronce e infantil_oro/plata/bronce.
  [normalizeText('Cadete Masculino PLATA/BRONCE')]: 'cadete_pref',
  [normalizeText('Cadete Femenino PLATA/BRONCE')]: 'cadete_pref',
  [normalizeText('Cadete Femenino Preferente')]: 'cadete_pref',
  // Cadete de 1er año: fila propia en las Bases (2 árbitros + 1 mesa) y categoría
  // fina propia desde 2026-07-25 (decisión del usuario); ya no cae al fallback.
  [normalizeText('Cadete Masculino 1er año')]: 'cadete_1er_ano',
  [normalizeText('Cadete Femenino 1er año')]: 'cadete_1er_ano',
  // Junior de 1er año se trata como Junior Preferente (decisión del usuario
  // 2026-07-25): mismo número de árbitros y misma elegibilidad.
  [normalizeText('Junior Masculino 1er año')]: 'junior_pref',
  [normalizeText('Junior Femenino 1er año')]: 'junior_pref',
  [normalizeText('Infantil Masculino ORO')]: 'infantil_pref',
  [normalizeText('Infantil Femenino ORO')]: 'infantil_pref',
  [normalizeText('Infantil Masculino PLATA/BRONCE')]: 'infantil_pref',
  [normalizeText('Infantil Femenino PLATA/BRONCE')]: 'infantil_pref',
  [normalizeText('Infantil Masculino Preferente')]: 'infantil_pref',
  [normalizeText('Infantil Femenino Preferente')]: 'infantil_pref',
  // Infantil de 1er año NO es una decisión discutible: las Bases (p. 25) lo
  // ponen en la MISMA fila que Infantil Preferente ("Infantil Preferente e
  // Infantil 1er.año"), es oficialmente la misma categoría de arbitraje.
  [normalizeText('Infantil Masculino 1er año')]: 'infantil_pref',
  [normalizeText('Infantil Femenino 1er año')]: 'infantil_pref',

  // Minibasket (Liga Marco Aldany): Alevín y Benjamín, ambos años y niveles,
  // comparten el único tag 'minibasket'.
  [normalizeText('Alevín Masculino 1er año')]: 'minibasket',
  [normalizeText('Alevín Femenino 1er año')]: 'minibasket',
  [normalizeText('Alevín Masculino 2º año ORO')]: 'minibasket',
  [normalizeText('Alevín Femenino 2º año ORO')]: 'minibasket',
  [normalizeText('Alevín Masculino 2º año PLATA')]: 'minibasket',
  [normalizeText('Alevín Femenino 2º año PLATA')]: 'minibasket',
  [normalizeText('Benjamín Masculino 1er año')]: 'minibasket',
  [normalizeText('Benjamín Femenino 1er año')]: 'minibasket',
  [normalizeText('Benjamín Masculino 2º año')]: 'minibasket',
  [normalizeText('Benjamín Femenino 2º año')]: 'minibasket',
}

/**
 * Canónicas que se dejan SIN tag fino a propósito: no hay ningún
 * `CompetitionCategory` que las represente y forzar el más parecido daría una
 * elegibilidad incorrecta. Caen al fallback lineal (`meetsMinCategory`).
 *
 * VACÍA desde el 2026-07-25: todas las canónicas tienen tag fino.
 *
 * Cadete de 1er año tiene tag propio (`cadete_1er_ano`, 2 árbitros) y Junior de
 * 1er año se mapea a `junior_pref` (mismo nº de árbitros; las Bases los agrupan
 * en la tabla de horarios, p. 55). Ambas decisiones del usuario, 2026-07-25.
 */
export const CANONICALS_WITHOUT_FINE_CATEGORY: string[] = []

/**
 * Resuelve la categoría fina de una competición por nombre canónico
 * normalizado. `category` (slug comercial) se acepta en la firma para
 * desambiguar nombres que en el futuro colisionen entre géneros; ninguna de
 * las competiciones actuales lo necesita (todas incluyen "Masculin_" /
 * "Femenin_" en el nombre) así que hoy no se usa.
 * `null` = sin tag → el solver y los pickers caen al fallback legacy
 * (`meetsMinCategory`, D2).
 */
export function resolveFineCategory(comp: {
  name: string
  category: string
}): CompetitionCategory | null {
  return FINE_CATEGORY_BY_CANONICAL[normalizeText(comp.name)] ?? null
}
