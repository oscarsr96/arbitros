import { describe, it, expect } from 'vitest'
import { resolveFineCategory } from '../competition-fine-category'
import { mockCompetitions } from '../mock-data'

// Decisión D1 (tasks/todo-solver-7niveles.md, sección 2.5): fina esperada por
// id de competición, para las 10 demo (mock-data.ts `demoCompetitions`) y las
// 2 importadas del seed FBM (`fbm-calendar/fbm-seed.json`).
const EXPECTED_FINE_CATEGORY: Record<string, string> = {
  'comp-001': 'nacional', // Liga VIPS Masculina
  'comp-002': 'nacional', // Liga VIPS Femenina
  'comp-003': 'sub22_oro', // Sub-22 Masculina
  'comp-004': 'junior_especial_oro', // Junior Masculino ORO
  'comp-005': 'junior_especial_oro', // Junior Femenino ORO
  'comp-006': 'cadete_pref', // Cadete Masculino ORO
  'comp-007': 'cadete_pref', // Cadete Femenino ORO
  'comp-008': 'infantil_pref', // Infantil Masculino
  'comp-009': 'infantil_pref', // Infantil Femenino
  'comp-010': 'junior_pref', // Preferente Masculina (= Junior Preferente Masc, corrección D1)
  'fbm-comp-1-DIVISION-NACIONAL-MASCULINA': 'nacional', // 1ª División Nacional Masculina (import)
  'fbm-comp-JUNIOR-MASCULINO-ORO': 'junior_especial_oro', // Junior Masculino ORO (import)
}

describe('resolveFineCategory', () => {
  it('resuelve la fina esperada (D1) para cada competición demo + las 2 del seed FBM', () => {
    for (const comp of mockCompetitions) {
      const want = EXPECTED_FINE_CATEGORY[comp.id]
      expect(want, `competición sin caso esperado en el test: ${comp.id}`).toBeDefined()
      expect(resolveFineCategory(comp)).toBe(want)
    }
  })

  it('cubre el catálogo completo de mockCompetitions (sin casos huérfanos)', () => {
    expect(mockCompetitions.map((c) => c.id).sort()).toEqual(
      Object.keys(EXPECTED_FINE_CATEGORY).sort(),
    )
  })

  it('nombre desconocido devuelve null (sin tag → fallback legacy, D2)', () => {
    expect(resolveFineCategory({ name: 'Senior Masculina', category: 'senior' })).toBeNull()
  })

  it('familia CSV futura aún sin competición demo/import resuelve por su propio nombre canónico', () => {
    expect(
      resolveFineCategory({
        name: '2ª División Autonómica Masculina BRONCE',
        category: '2a-div-aut-masc-bronce',
      }),
    ).toBe('segunda_aut_bronce')
    expect(
      resolveFineCategory({
        name: '2ª División Autonómica Femenina PLATA',
        category: '2a-div-aut-fem-plata',
      }),
    ).toBe('segunda_aut_plata')
  })

  // Fix M1 (review modelo 7 niveles): las 3 familias de CATEGORY_FAMILIES
  // (`fbm-calendar/category-mapping.ts`) que aún no tenían clave fina.
  it('familias CSV M1: 1ª Nacional Femenina, Sub-22 Plata y Cadete Preferente', () => {
    expect(
      resolveFineCategory({
        name: '1ª División Nacional Femenina',
        category: '1a-div-nacional-fem',
      }),
    ).toBe('nacional')
    expect(
      resolveFineCategory({ name: 'Sub-22 Masculina PLATA', category: 'sub22-masc-plata' }),
    ).toBe('sub22_plata')
    expect(
      resolveFineCategory({
        name: 'Cadete Masculino Preferente',
        category: 'cadete-masc-pref',
      }),
    ).toBe('cadete_pref')
  })
})
