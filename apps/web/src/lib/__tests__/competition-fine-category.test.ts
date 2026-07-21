import { describe, it, expect } from 'vitest'
import { resolveFineCategory, CANONICALS_WITHOUT_FINE_CATEGORY } from '../competition-fine-category'
import type { CompetitionCategory } from '../referee-eligibility'
import { mockCompetitions } from '../mock-data'

// Decisión D1 (tasks/todo-solver-7niveles.md, sección 2.5): fina esperada por
// id de competición, para las 10 demo (mock-data.ts `demoCompetitions`) y las
// 2 importadas del seed FBM (`fbm-calendar/fbm-seed.json`). Spot-checks
// exactos: fijan casos concretos ya validados con el usuario, no se amplían
// al crecer el catálogo (para eso están los tests de invariantes de abajo).
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

// Dominio completo de `CompetitionCategory` (referee-eligibility.ts), repetido
// aquí como objeto exhaustivo: si el union type gana o pierde un miembro sin
// tocar este test, `typecheck` falla (falta/sobra clave), no un `undefined`
// silencioso en runtime.
const KNOWN_FINE_CATEGORIES: Record<CompetitionCategory, true> = {
  nacional: true,
  primera_aut_oro: true,
  primera_aut_plata: true,
  primera_aut_fem: true,
  segunda_aut_oro: true,
  segunda_aut_plata: true,
  segunda_aut_bronce: true,
  junior_pref: true,
  junior_especial_oro: true,
  junior_especial_plata: true,
  junior_especial_bronce: true,
  sub22_oro: true,
  sub22_plata: true,
  sub22_bronce: true,
  cadete_pref: true,
  infantil_pref: true,
  minibasket: true,
}

describe('resolveFineCategory', () => {
  it('resuelve la fina esperada (D1) para los spot-checks conocidos', () => {
    for (const [id, want] of Object.entries(EXPECTED_FINE_CATEGORY)) {
      const comp = mockCompetitions.find((c) => c.id === id)
      expect(comp, `spot-check obsoleto: ${id} ya no existe en mockCompetitions`).toBeDefined()
      expect(resolveFineCategory(comp!)).toBe(want)
    }
  })

  // Invariante de dominio (no heurística de cobertura, no tolerancia): toda
  // competición del catálogo resuelve a una categoría fina VÁLIDA, o cae en
  // una de las excepciones EXPLÍCITAS y justificadas que ya documenta
  // `CANONICALS_WITHOUT_FINE_CATEGORY` (competition-fine-category.ts). Un
  // `null` fuera de esas excepciones, o una categoría fuera del dominio
  // conocido, es un hallazgo real que hay que reportar, no un test que relajar.
  it('toda competición de mockCompetitions resuelve a fina válida o cae en excepción explícita', () => {
    const exceptionNames = new Set(CANONICALS_WITHOUT_FINE_CATEGORY)
    const unexpectedNulls: string[] = []
    const invalidCategories: string[] = []

    for (const comp of mockCompetitions) {
      const result = resolveFineCategory(comp)
      if (result === null) {
        if (!exceptionNames.has(comp.name)) {
          unexpectedNulls.push(`${comp.id} :: ${comp.name}`)
        }
        continue
      }
      if (!(result in KNOWN_FINE_CATEGORIES)) {
        invalidCategories.push(`${comp.id} :: ${comp.name} -> ${result}`)
      }
    }

    expect(unexpectedNulls, 'competiciones sin tag fino y sin excepción justificada').toEqual([])
    expect(
      invalidCategories,
      'competiciones resueltas a una categoría fuera del dominio conocido',
    ).toEqual([])
  })

  // Falla ruidosamente si el catálogo cambia de tamaño (seed nuevo, import
  // nuevo): recuerda revisar la cobertura de invariantes de arriba, no exige
  // reenumerar casos a mano.
  it('el tamaño del catálogo es el esperado', () => {
    expect(mockCompetitions.length).toBe(58)
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
