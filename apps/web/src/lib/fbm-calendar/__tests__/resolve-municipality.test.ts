import { describe, it, expect } from 'vitest'
import { resolveMunicipality } from '../resolve-municipality'

describe('resolveMunicipality', () => {
  it.each([
    ['Madrid', 'muni-001'],
    ['Torrejón de Ardoz', 'muni-008'],
    ['Alcorcón', 'muni-002'],
    ['Getafe', 'muni-003'],
    ['Rivas-Vaciamadrid', 'muni-010'],
  ])('"%s" casa exacto con %s', (poblacion, expectedId) => {
    const result = resolveMunicipality(poblacion)
    expect(result.municipalityId).toBe(expectedId)
    expect(result.matched).toBe(true)
  })

  it('alias invertido "Rozas de Madrid, Las" resuelve a Las Rozas (muni-011)', () => {
    const result = resolveMunicipality('Rozas de Madrid, Las')
    expect(result.municipalityId).toBe('muni-011')
    expect(result.matched).toBe(true)
  })

  it('M1: variante con espacio "Rivas Vaciamadrid" casa por tokens con muni-010', () => {
    const result = resolveMunicipality('Rivas Vaciamadrid')
    expect(result.municipalityId).toBe('muni-010')
    expect(result.matched).toBe(true)
  })

  it('M1: no hay falso positivo por subcadena (VACIAMADRID no resuelve a Madrid)', () => {
    // Antes, la inclusión por subcadena hacía "VACIAMADRID".includes("MADRID")
    // y resolvía silenciosamente a Madrid. Con tokens, "MADRID" no es palabra.
    const result = resolveMunicipality('Vaciamadrid Inventada')
    expect(result.municipalityId).not.toBe('muni-001')
    expect(result.matched).toBe(false)
  })

  it('población sin match conocido devuelve matched:false y conserva el nombre', () => {
    const result = resolveMunicipality('Chinchón')
    expect(result.municipalityId).toBeNull()
    expect(result.matched).toBe(false)
    expect(result.municipalityName.length).toBeGreaterThan(0)
  })
})
