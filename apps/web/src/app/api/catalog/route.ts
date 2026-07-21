import { NextResponse } from 'next/server'
import { mockMunicipalities, mockDistances } from '@/lib/mock-data'

// Catálogos pequeños que la UI necesita pero que viven en `mock-data` (que
// importa el seed de partidos, ~10 MB, y por tanto no puede entrar en un bundle
// de cliente). Municipios + matriz de distancias son ~500 entradas fijas: se
// sirven por fetch en vez de por import.
export async function GET() {
  return NextResponse.json({ municipalities: mockMunicipalities, distances: mockDistances })
}
