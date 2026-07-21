import { describe, it, expect } from 'vitest'
import fbmSeed from '../fbm-seed.json'

// Invariante que de verdad importa proteger: un pabellón con `municipalityId`
// vacío dispara dos bugs sobre el coste de desplazamiento que minimiza el
// solver — `getMockDistance('', destId)` cae al fallback fijo de 35 km (coste
// fantasma), y DOS pabellones distintos con `municipalityId: ''` colisionan
// como si estuvieran en el MISMO municipio (anula el coste de desplazamiento
// entre ellos). A diferencia de resolve-municipality-csv-coverage.test.ts
// (que lee el CSV de origen, no trackeado, y se salta si no está en el
// checkout), este test corre SIEMPRE contra `fbm-seed.json`, que sí está
// commiteado: es el que debe fallar de verdad si algo se rompe.
describe('fbm-seed.json — ningún pabellón sin municipio resuelto', () => {
  it('sanity: el seed tiene pabellones (si esto falla, el fixture está roto/vacío)', () => {
    expect(fbmSeed.venues.length).toBeGreaterThan(0)
  })

  it('todos los pabellones tienen municipalityId no vacío', () => {
    const sinResolver = fbmSeed.venues.filter((v) => !v.municipalityId)
    expect(
      sinResolver,
      `pabellones sin municipio resuelto: ${sinResolver.map((v) => v.name).join(', ')}`,
    ).toEqual([])
  })
})
