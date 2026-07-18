// Jerarquía legacy de categoría de árbitro (provincial < autonomico < nacional
// < feb) usada como FALLBACK (D2/D4, tasks/todo-solver-7niveles.md) cuando un
// partido o una persona no llevan datos finos de la matriz de 7 niveles
// (`referee-eligibility.ts`).
//
// Módulo HOJA extraído de `mock-data.ts` (`solver.ts` tiene su propia copia
// privada). La extracción evita un ciclo de imports: `mock-data.ts` →
// `referee-roster.ts` → `referee-eligibility.ts`, así que si
// `referee-eligibility.ts` importara `meetsMinCategory` directamente de
// `mock-data.ts` el ciclo se cerraría. Este módulo no importa nada de ninguno
// de los dos, así que ambos pueden importarlo sin problema. `asignacion-view.tsx`
// y `substitution-panel.tsx` ya no lo consumen directo: validan elegibilidad
// vía `checkSlotEligibility` (`referee-eligibility.ts`), que hace el fallback
// internamente.

const CATEGORY_RANK: Record<string, number> = {
  provincial: 1,
  autonomico: 2,
  nacional: 3,
  feb: 4,
}

export function meetsMinCategory(personCategory: string | null, requiredCategory: string): boolean {
  if (!personCategory) return false
  return (CATEGORY_RANK[personCategory] ?? 0) >= (CATEGORY_RANK[requiredCategory] ?? 0)
}
