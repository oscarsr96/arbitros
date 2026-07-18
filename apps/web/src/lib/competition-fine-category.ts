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
}

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
