// Datos mock para desarrollo sin Supabase/PostgreSQL
// Mismo formato que las tablas del schema Drizzle

// Este módulo importa `fbm-calendar/fbm-seed.json`, que con el calendario real de
// temporada pesa ~10 MB. `server-only` convierte en ERROR DE COMPILACIÓN que un
// componente cliente lo importe (antes se colaba en silencio y acababa en un chunk
// compartido de 9,65 MB que cargaban 5 rutas). Lo que necesite el cliente vive en
// `mock-data-client.ts` (helpers puros y catálogos pequeños) o llega por fetch.
//
// Nota: el paquete resuelve a un módulo que lanza excepción salvo bajo la condición
// `react-server`, así que vitest lo aliasa a su `empty.js` (ver vitest.config.ts).
import 'server-only'

import { generateReferees, generateScorers, type MockPerson } from './referee-roster'
// Seed de partidos derivado del CSV oficial de calendario FBM (solo Liga VIPS
// Masculina + Junior Masculino ORO). Regenerar con scripts/generate-fbm-seed.ts.
import fbmSeed from './fbm-calendar/fbm-seed.json'
// Generador determinista de disponibilidad de temporada para las 1279 personas
// (ver mini-spec Parte 1, tasks/todo.md). Módulo hoja: sin ciclo con mock-data.
import { generateSeasonAvailability, type GeneratedAvailabilitySlot } from './availability-roster'
// Posiciones nombradas de designación (Principal/Auxiliar, Anotador/Crono/24").
// Módulo hoja: sin ciclo con mock-data.
import type { DesignationPosition } from './designation-positions'
import type { MockCourt, DesignationStatus, MatchdayAvailability } from './mock-data-client'
// Capa client-safe (helpers de fecha, pistas, DEMO_PERSON_ID): vive aparte para
// que los componentes cliente puedan consumirla sin arrastrar el seed. Este
// módulo la reexporta entera, así que los consumidores de servidor siguen
// importando todo desde '@/lib/mock-data'.
import {
  formatLocalDate,
  nextSaturday,
  nextSunday,
  weekStart,
  nextWeek,
  mockCourts,
  DEMO_PERSON_ID,
} from './mock-data-client'

// ── Store compartido en globalThis (fix HMR / rutas frías, ver CLAUDE.md) ───
//
// En `next dev`, cada HMR o compilación de una ruta "fría" reevalúa este
// módulo desde cero, lo que crearía una copia aislada de cada array mutable
// (`export const mockDesignations = []` volvería a ser `[]`). Todas las
// evaluaciones del módulo comparten `globalThis`, así que respaldamos cada
// array mutable (y su snapshot `INITIAL_*`) ahí con `??=`: la primera
// evaluación crea el valor a partir de su inicializador real, las siguientes
// reutilizan la MISMA instancia. Este archivo se importa desde componentes
// cliente: prohibido importar `fs`/`path`/APIs de Node aquí (ver
// designation-persistence.ts para el I/O de disco).
interface FbmMockStore {
  persons?: MockPerson[]
  matches?: MockMatch[]
  designations?: MockDesignation[]
  availabilities?: GeneratedAvailabilitySlot[]
  matchdayAvailabilities?: MatchdayAvailability[]
  incompatibilities?: MockIncompatibility[]
  // `courts` lo respalda mock-data-client.ts (misma instancia de store).
  venues?: MockVenue[]
  competitions?: Array<(typeof demoCompetitions)[number]>
  alertLog?: MockAlert[]
  initialPersons?: MockPerson[]
  initialMatches?: MockMatch[]
  initialDesignations?: MockDesignation[]
  initialAvailabilities?: GeneratedAvailabilitySlot[]
  initialMatchdayAvailabilities?: MatchdayAvailability[]
  initialIncompatibilities?: MockIncompatibility[]
  initialCourts?: MockCourt[]
  initialVenues?: MockVenue[]
  designationsHydrated?: boolean
}

const __fbmGlobal = globalThis as unknown as { __fbmMockStore?: FbmMockStore }
const __fbmStore: FbmMockStore = (__fbmGlobal.__fbmMockStore ??= {})

// Flag de hidratación de designaciones desde disco: vive en el store de
// globalThis para sobrevivir a HMR y no releer el fichero en cada request.
// Lo usa exclusivamente designation-persistence.ts (server-only).
export function isDesignationsHydrated(): boolean {
  return !!__fbmStore.designationsHydrated
}

export function markDesignationsHydrated(): void {
  __fbmStore.designationsHydrated = true
}

// ── Municipios ──────────────────────────────────────────────────────────────

export const mockMunicipalities = [
  { id: 'muni-001', name: 'Madrid', province: 'Madrid' },
  { id: 'muni-002', name: 'Alcorcón', province: 'Madrid' },
  { id: 'muni-003', name: 'Getafe', province: 'Madrid' },
  { id: 'muni-004', name: 'Leganés', province: 'Madrid' },
  { id: 'muni-005', name: 'Móstoles', province: 'Madrid' },
  { id: 'muni-006', name: 'Fuenlabrada', province: 'Madrid' },
  { id: 'muni-007', name: 'Alcalá de Henares', province: 'Madrid' },
  { id: 'muni-008', name: 'Torrejón de Ardoz', province: 'Madrid' },
  { id: 'muni-009', name: 'Pozuelo de Alarcón', province: 'Madrid' },
  { id: 'muni-010', name: 'Rivas-Vaciamadrid', province: 'Madrid' },
  { id: 'muni-011', name: 'Las Rozas', province: 'Madrid' },
  { id: 'muni-012', name: 'Majadahonda', province: 'Madrid' },
  { id: 'muni-013', name: 'Boadilla del Monte', province: 'Madrid' },
  { id: 'muni-014', name: 'Tres Cantos', province: 'Madrid' },
  { id: 'muni-015', name: 'San Sebastián de los Reyes', province: 'Madrid' },
  { id: 'muni-016', name: 'Colmenar Viejo', province: 'Madrid' },
  { id: 'muni-017', name: 'Alcobendas', province: 'Madrid' },
  { id: 'muni-018', name: 'Coslada', province: 'Madrid' },
  { id: 'muni-019', name: 'Arganda del Rey', province: 'Madrid' },
  { id: 'muni-020', name: 'Parla', province: 'Madrid' },
  { id: 'muni-021', name: 'Pinto', province: 'Madrid' },
  { id: 'muni-022', name: 'Valdemoro', province: 'Madrid' },
  { id: 'muni-023', name: 'Aranjuez', province: 'Madrid' },
  { id: 'muni-024', name: 'Collado Villalba', province: 'Madrid' },
  { id: 'muni-025', name: 'San Fernando de Henares', province: 'Madrid' },
  { id: 'muni-026', name: 'Torrelodones', province: 'Madrid' },
  { id: 'muni-027', name: 'Villanueva de la Cañada', province: 'Madrid' },
  { id: 'muni-028', name: 'Navalcarnero', province: 'Madrid' },
  { id: 'muni-029', name: 'Humanes de Madrid', province: 'Madrid' },
  { id: 'muni-030', name: 'Ciempozuelos', province: 'Madrid' },
  { id: 'muni-031', name: 'Villaviciosa de Odón', province: 'Madrid' },
  // ── Ampliación (calendario real de temporada, ~24.500 partidos, 62 valores
  // de POBLACIÓN distintos frente a los 31 municipios originales) ──────────
  { id: 'muni-032', name: 'Algete', province: 'Madrid' },
  { id: 'muni-033', name: 'Arroyomolinos', province: 'Madrid' },
  { id: 'muni-034', name: 'Becerril de la Sierra', province: 'Madrid' },
  { id: 'muni-035', name: 'Camarma de Esteruelas', province: 'Madrid' },
  { id: 'muni-036', name: 'Collado Mediano', province: 'Madrid' },
  { id: 'muni-037', name: 'Daganzo de Arriba', province: 'Madrid' },
  { id: 'muni-038', name: 'El Escorial', province: 'Madrid' },
  { id: 'muni-039', name: 'Fresno de Torote', province: 'Madrid' },
  { id: 'muni-040', name: 'Fuente el Saz de Jarama', province: 'Madrid' },
  { id: 'muni-041', name: 'Griñón', province: 'Madrid' },
  { id: 'muni-042', name: 'Guadarrama', province: 'Madrid' },
  { id: 'muni-043', name: 'Hoyo de Manzanares', province: 'Madrid' },
  { id: 'muni-044', name: 'Manzanares el Real', province: 'Madrid' },
  { id: 'muni-045', name: 'Mejorada del Campo', province: 'Madrid' },
  { id: 'muni-046', name: 'Moralzarzal', province: 'Madrid' },
  { id: 'muni-047', name: 'Paracuellos de Jarama', province: 'Madrid' },
  { id: 'muni-048', name: 'San Agustín de Guadalix', province: 'Madrid' },
  { id: 'muni-049', name: 'San Lorenzo de El Escorial', province: 'Madrid' },
  { id: 'muni-050', name: 'San Martín de la Vega', province: 'Madrid' },
  { id: 'muni-051', name: 'San Martín de Valdeiglesias', province: 'Madrid' },
  { id: 'muni-052', name: 'Soto del Real', province: 'Madrid' },
  { id: 'muni-053', name: 'Torrejón de la Calzada', province: 'Madrid' },
  { id: 'muni-054', name: 'Torres de la Alameda', province: 'Madrid' },
  { id: 'muni-055', name: 'Valdeolmos-Alalpardo', province: 'Madrid' },
  { id: 'muni-056', name: 'Villalbilla', province: 'Madrid' },
  { id: 'muni-057', name: 'Villanueva del Pardillo', province: 'Madrid' },
  { id: 'muni-058', name: 'Villarejo de Salvanés', province: 'Madrid' },
]

// ── Distancias entre municipios ─────────────────────────────────────────────

// Coordenadas aproximadas (km desde centro de Madrid) para calcular distancias realistas
const MUNI_COORDS: Record<string, { x: number; y: number }> = {
  'muni-001': { x: 0, y: 0 }, // Madrid (centro)
  'muni-002': { x: -10, y: -5 }, // Alcorcón (suroeste)
  'muni-003': { x: -3, y: -13 }, // Getafe (sur)
  'muni-004': { x: -6, y: -10 }, // Leganés (sur)
  'muni-005': { x: -18, y: -8 }, // Móstoles (suroeste)
  'muni-006': { x: -10, y: -15 }, // Fuenlabrada (sur)
  'muni-007': { x: 25, y: 5 }, // Alcalá de Henares (este)
  'muni-008': { x: 20, y: 5 }, // Torrejón de Ardoz (este)
  'muni-009': { x: -10, y: 2 }, // Pozuelo de Alarcón (oeste)
  'muni-010': { x: 10, y: -12 }, // Rivas-Vaciamadrid (sureste)
  'muni-011': { x: -15, y: 5 }, // Las Rozas (noroeste)
  'muni-012': { x: -14, y: 3 }, // Majadahonda (noroeste)
  'muni-013': { x: -16, y: 0 }, // Boadilla del Monte (oeste)
  'muni-014': { x: -3, y: 18 }, // Tres Cantos (norte)
  'muni-015': { x: 2, y: 16 }, // San Sebastián de los Reyes (norte)
  'muni-016': { x: -2, y: 22 }, // Colmenar Viejo (norte)
  'muni-017': { x: 0, y: 14 }, // Alcobendas (norte)
  'muni-018': { x: 12, y: 0 }, // Coslada (este)
  'muni-019': { x: 20, y: -12 }, // Arganda del Rey (sureste)
  'muni-020': { x: -5, y: -20 }, // Parla (sur)
  'muni-021': { x: -2, y: -22 }, // Pinto (sur)
  'muni-022': { x: 0, y: -27 }, // Valdemoro (sur)
  'muni-023': { x: 5, y: -42 }, // Aranjuez (sur lejano)
  'muni-024': { x: -25, y: 15 }, // Collado Villalba (noroeste lejano)
  'muni-025': { x: 15, y: 2 }, // San Fernando de Henares (este)
  'muni-026': { x: -18, y: 10 }, // Torrelodones (noroeste)
  'muni-027': { x: -22, y: 3 }, // Villanueva de la Cañada (oeste)
  'muni-028': { x: -25, y: -8 }, // Navalcarnero (suroeste lejano)
  'muni-029': { x: -12, y: -18 }, // Humanes de Madrid (sur)
  'muni-030': { x: 2, y: -32 }, // Ciempozuelos (sur lejano)
  'muni-031': { x: -20, y: -5 }, // Villaviciosa de Odón (suroeste)
  // ── Ampliación: mismo sistema x/y (km desde Madrid), calculado por
  // regresión lineal x=f(lon), y=f(lat) sobre las 31 coordenadas de arriba
  // (lat/lon reales conocidas) frente a su x/y hardcodeado, R²=0,98/0,97.
  // La misma transformación se aplica a la lat/lon real de cada municipio
  // nuevo. Ver informe de la tarea para el detalle de la regresión.
  'muni-032': { x: 15, y: 17 }, // Algete (norte)
  'muni-033': { x: -19, y: -16 }, // Arroyomolinos (suroeste)
  'muni-034': { x: -25, y: 28 }, // Becerril de la Sierra (norte lejano, sierra)
  'muni-035': { x: 24, y: 12 }, // Camarma de Esteruelas (este)
  'muni-036': { x: -27, y: 27 }, // Collado Mediano (noroeste lejano, sierra)
  'muni-037': { x: 18, y: 12 }, // Daganzo de Arriba (este)
  'muni-038': { x: -35, y: 16 }, // El Escorial (noroeste lejano, sierra)
  'muni-039': { x: 22, y: 17 }, // Fresno de Torote (norte, pedanía Serracines)
  'muni-040': { x: 14, y: 21 }, // Fuente el Saz de Jarama (norte)
  'muni-041': { x: -14, y: -22 }, // Griñón (sur)
  'muni-042': { x: -32, y: 25 }, // Guadarrama (noroeste lejano, sierra)
  'muni-043': { x: -18, y: 20 }, // Hoyo de Manzanares (norte)
  'muni-044': { x: -14, y: 30 }, // Manzanares el Real (norte lejano, sierra)
  'muni-045': { x: 16, y: -3 }, // Mejorada del Campo (este)
  'muni-046': { x: -23, y: 25 }, // Moralzarzal (noroeste lejano, sierra)
  'muni-047': { x: 12, y: 8 }, // Paracuellos de Jarama (norte)
  'muni-048': { x: 5, y: 25 }, // San Agustín de Guadalix (norte)
  'muni-049': { x: -36, y: 17 }, // San Lorenzo de El Escorial (noroeste lejano, sierra)
  'muni-050': { x: 9, y: -22 }, // San Martín de la Vega (sur)
  'muni-051': { x: -58, y: -7 }, // San Martín de Valdeiglesias (oeste lejano)
  'muni-052': { x: -8, y: 33 }, // Soto del Real (norte lejano, sierra)
  'muni-053': { x: -9, y: -23 }, // Torrejón de la Calzada (sur)
  'muni-054': { x: 26, y: -2 }, // Torres de la Alameda (este)
  'muni-055': { x: 18, y: 21 }, // Valdeolmos-Alalpardo (norte, localidad Alalpardo)
  'muni-056': { x: 30, y: 0 }, // Villalbilla (este)
  'muni-057': { x: -22, y: 6 }, // Villanueva del Pardillo (oeste)
  'muni-058': { x: 32, y: -26 }, // Villarejo de Salvanés (sureste lejano)
}

function generateDistances(): { originId: string; destId: string; distanceKm: number }[] {
  const distances: { originId: string; destId: string; distanceKm: number }[] = []
  const ids = mockMunicipalities.map((m) => m.id)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = MUNI_COORDS[ids[i]]
      const b = MUNI_COORDS[ids[j]]
      if (!a || !b) continue
      // Distancia euclidiana × 1.3 (factor carretera) redondeada a entero
      const straight = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
      const road = Math.round(straight * 1.3)
      distances.push({ originId: ids[i], destId: ids[j], distanceKm: road || 1 })
    }
  }
  return distances
}

export const mockDistances = generateDistances()

// ── Temporada ───────────────────────────────────────────────────────────────

export const mockSeason = {
  id: 'season-001',
  name: '2024-25',
  startDate: '2024-09-01',
  endDate: '2025-06-30',
  active: true,
  createdAt: new Date('2024-08-01'),
}

// ── Competiciones ───────────────────────────────────────────────────────────

const demoCompetitions = [
  {
    id: 'comp-001',
    name: 'Liga VIPS Masculina',
    category: 'preferente',
    gender: 'male' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'autonomico' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-002',
    name: 'Liga VIPS Femenina',
    category: 'preferente',
    gender: 'female' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'autonomico' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-003',
    name: 'Sub-22 Masculina',
    category: 'sub22',
    gender: 'male' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-004',
    name: 'Junior Masculino ORO',
    category: 'junior',
    gender: 'male' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-005',
    name: 'Junior Femenino ORO',
    category: 'junior',
    gender: 'female' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-006',
    name: 'Cadete Masculino ORO',
    category: 'cadete',
    gender: 'male' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-007',
    name: 'Cadete Femenino ORO',
    category: 'cadete',
    gender: 'female' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-008',
    name: 'Infantil Masculino',
    category: 'infantil',
    gender: 'male' as const,
    refereesNeeded: 1,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-009',
    name: 'Infantil Femenino',
    category: 'infantil',
    gender: 'female' as const,
    refereesNeeded: 1,
    scorersNeeded: 1,
    minRefCategory: 'provincial' as const,
    seasonId: 'season-001',
  },
  {
    id: 'comp-010',
    name: 'Preferente Masculina',
    category: '1a_division',
    gender: 'male' as const,
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'autonomico' as const,
    seasonId: 'season-001',
  },
]

// Catálogo demo + competiciones reales importadas del calendario FBM.
// Respaldado en el store de globalThis: import-csv-fbm añade competiciones
// nuevas en runtime; sin esto, tras un HMR los partidos importados
// sobrevivirían (store) pero sus competiciones se perderían (re-seed).
export const mockCompetitions: Array<(typeof demoCompetitions)[number]> =
  (__fbmStore.competitions ??= [
    ...demoCompetitions,
    ...(fbmSeed.competitions as Array<(typeof demoCompetitions)[number]>),
  ])

// ── Pabellones ──────────────────────────────────────────────────────────────

export interface MockVenue {
  id: string
  name: string
  address: string
  municipalityId: string
  postalCode: string
  district?: string
  metro?: string
  bus?: string
  observations?: string
}

const demoVenues: MockVenue[] = [
  {
    id: 'venue-001',
    name: 'BARAJAS, PDVO.',
    address: 'AVDA. LOGROÑO, 70',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'BARAJAS',
    metro: 'ALAMEDA DE OSUNA',
    bus: '105,112,115,151',
  },
  {
    id: 'venue-002',
    name: 'CDM VILLA DE MADRID',
    address: 'C/ BREZOS, 4',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'BARAJAS',
    metro: 'ALAMEDA DE OSUNA',
    bus: '105,112,115,151',
  },
  {
    id: 'venue-003',
    name: 'CIUDAD DE ZARAGOZA, COL.',
    address: 'MANUEL AGUILAR MUÑOZ, 1',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'BARAJAS',
    metro: 'ALAMEDA DE OSUNA',
    bus: '105,112,115,151',
  },
  {
    id: 'venue-004',
    name: 'FCO. FERNÁNDEZ OCHOA, PDVO.',
    address: 'CATORCE OLIVAS S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CARABANCHEL',
    metro: 'LA PESETA',
    bus: '35,108,118, 155',
  },
  {
    id: 'venue-005',
    name: 'CDM BARCELÓ',
    address: 'C/ BARCELÓ 6',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CENTRO',
    metro: 'TRIBUNAL',
    bus: '3,21,37, 40',
  },
  {
    id: 'venue-006',
    name: 'CENTRO INTEGRADO ARGANZUELA',
    address: 'CANARIAS, 17',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CENTRO',
    metro: 'PALOS DE LA FRONTERA',
    bus: '6,19,45,47,55,59,85,86',
  },
  {
    id: 'venue-007',
    name: 'MARQUES DE SAMARANCH, PDVO.',
    address: 'PASEO IMPERIAL, 18',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CENTRO',
    metro: 'PTA TOLEDO,PIRÁMIDES // (PIRÁMIDES)',
    bus: '17,36,41,C',
  },
  {
    id: 'venue-008',
    name: 'BRISTOL, COLEGIO',
    address: 'C/ ENRIQUE PRADA, 9',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMARTIN',
    metro: 'CANILLEJAS',
    bus: '153, 165',
  },
  {
    id: 'venue-009',
    name: 'CHAMARTIN, PDVO.',
    address: 'PLAZA DEL PERÚ S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMARTIN',
    metro: 'PIO XII',
    bus: '16,29,51,150',
  },
  {
    id: 'venue-010',
    name: 'NTRA, SRA. SANTA MARÍA, COLEGIO',
    address: 'AVDA. DE LOS MADROÑOS,',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMARTIN',
    metro: 'ARTURO SORIA',
    bus: '11,70,114',
  },
  {
    id: 'venue-011',
    name: 'PARAISO SSCC, COL.',
    address: 'PADRE DAMIÁN, 34',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMARTIN',
    metro: 'SANTIAGO BERNABEU',
    bus: '150',
  },
  {
    id: 'venue-012',
    name: 'PINTOR ROSALES, COL.',
    address: 'PRINCIPE DE VERGARA 141',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMARTIN',
    metro: 'CRUZ DEL RAYO, PROSPERIDAD',
    bus: '1,9,29,52,73',
  },
  {
    id: 'venue-013',
    name: 'PRADILLO, PDVO.',
    address: 'PRADILLO, 33',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMARTIN',
    metro: 'ALFONSO XIII',
    bus: '9,40,43,72,73',
  },
  {
    id: 'venue-014',
    name: 'C. CULTURAL GALILEO (HASTA 21 H)',
    address: 'C/ FERNANDO EL CATOLICO, 35',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMBERI',
    metro: 'QUEVEDO, ARGÜELLES',
    bus: '16, 61, 2',
    observations:
      'ABIERTO HASTA LAS 21 H. DEJAR ACTAS EN EL BUZON DE DEPORTES QUE HAY EN EL INTERIOR',
  },
  {
    id: 'venue-015',
    name: 'VALLEHERMOSO,PDVO',
    address: 'AVDA FILIPINAS, 7',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CHAMBERI',
    metro: 'ISLAS FILIPINAS, CANAL',
    bus: '2.12',
  },
  {
    id: 'venue-016',
    name: 'ARTURO SORIA, COL.',
    address: 'MANUEL MARÍA IGLESIAS, S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'ARTURO SORIA',
    bus: '11,70,122,201',
  },
  {
    id: 'venue-017',
    name: 'CASA DE LA VIRGEN, COL.',
    address: 'VIRGEN DEL VAL, 1',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'Bº CONCEPCIÓN',
    bus: '21,48,53,146',
  },
  {
    id: 'venue-018',
    name: 'CONCEPCIÓN, PDVO.',
    address: 'JOSE DEL HIERRO, S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'CONCEPCIÓN, QUINTANA, PUEBLO NUEVO',
    bus: '21,48,146',
  },
  {
    id: 'venue-019',
    name: 'GUSTAVO ADOLFO BECQUER',
    address: 'SANTA GENOVEVA, 32',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'ELIPA',
    bus: '110, 113, 210',
  },
  {
    id: 'venue-020',
    name: 'JOYFE, COL.',
    address: 'VITAL AZA, 65',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'ASCAO, PUEBLO NUEVO',
    bus: '4,38,48,70,105,109',
  },
  {
    id: 'venue-021',
    name: 'MONTPELLIER',
    address: 'VIRGEN DEL VAL, 7',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'Bº CONCEPCIÓN',
    bus: '21,48,53,146',
  },
  {
    id: 'venue-022',
    name: 'NTRA SRA DE LAS VICTORIAS',
    address: 'APOSTOL SANTIAGO, 72',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'EL CARMEN, LA ELIPA',
    bus: '106',
  },
  {
    id: 'venue-023',
    name: 'SAN BLAS, PDVO.',
    address: 'AVDA. HELLÍN, 79',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'SAN BLAS',
    bus: '38,48,153',
  },
  {
    id: 'venue-024',
    name: 'SAN JOSE, COL.',
    address: 'EMILIO FERRARI, 87',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'ASCAO',
    bus: '15,28,106,109',
  },
  {
    id: 'venue-025',
    name: 'SAN JUAN BOSCO, COL.',
    address: 'SANTA IRENE, 2',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'ELIPA',
    bus: '15, 28,71, 106, 110,113, 210',
  },
  {
    id: 'venue-026',
    name: 'SANTA MARIA DEL CARMEN, COLEGIO',
    address: 'MISTERIOS, 38',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'CIUDAD LINEAL',
    bus: '146, 70, 48',
  },
  {
    id: 'venue-027',
    name: 'SANTO DOMINGO SAVIO, COL. (DOSA)',
    address: 'SANTO DOMINGO SAVIO, 2',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'CIUDAD LINEAL',
    metro: 'GARCIA NOBLEJAS, ASCAO',
    bus: '4,38,48,70,105',
  },
  {
    id: 'venue-028',
    name: 'EL VALLE LAS TABLAS, COL.',
    address: 'CEBREIRO, 2',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'FUENCARRAL',
    metro: 'LAS TABLAS',
    bus: '176',
  },
  {
    id: 'venue-029',
    name: 'ESTUDIANTES LAS TABLAS, COL.',
    address: 'CALLE FROMISTA, 1',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'FUENCARRAL',
    metro: 'LAS TABLAS',
    bus: '176',
  },
  {
    id: 'venue-030',
    name: 'LA MASÓ, PDVO.',
    address: 'LA MASÓ ESQ. VENTISQUERO DE LA CONDESA',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'FUENCARRAL',
    metro: 'HERRERA ORIA, LA COMA',
    bus: '49,64,83,124,134',
  },
  {
    id: 'venue-031',
    name: 'SANTA MARIA LA BLANCA',
    address: 'MONASTERIO DE OSEIRA, 17',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'FUENCARRAL',
    metro: 'MONTECARMELO',
    bus: '134, 178',
  },
  {
    id: 'venue-032',
    name: 'VICENTE DEL BOSQUE, PDVO.',
    address: 'AVDA. MONFORTE DE LEMOS, 13-15',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'FUENCARRAL',
    metro: 'BEGOÑA, Bº DEL PILAR',
    bus: '49,67,83,124,133,134',
  },
  {
    id: 'venue-033',
    name: 'ARQUITECTO GAUDÍ, COL.',
    address: 'ROSA JARDÓN, 10',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'PIO XII',
    bus: '106',
  },
  {
    id: 'venue-034',
    name: 'ASUNCION CUESTA BLANCA, COLEGIO',
    address: 'ASUNCION CUESTA BLANCA, 11',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'LAS TABLAS, MARIA TUDOR (ML)',
    bus: '172, 173',
  },
  {
    id: 'venue-035',
    name: 'CARDENAL MARCELO SPINOLA, COLEGIO',
    address: 'CARDENAL MARCELO SPINOLA, 34',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'PIO XII, DUQUE DE PASTRANA',
    bus: '16,29,70,107,150',
  },
  {
    id: 'venue-036',
    name: 'CEIP PINAR DEL REY',
    address: 'AV. DE SAN LUIS 23',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'HORTALEZA, PINAR DEL REY',
    bus: '107, 125, 172',
  },
  {
    id: 'venue-037',
    name: 'CEU SANCHINARRO, COL.',
    address: 'NICETO ALCALA ZAMORA, 43',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'BLASCO IBAÑEZ (ML1)',
    bus: '172, 173',
  },
  {
    id: 'venue-038',
    name: 'COLEGIO MADRID',
    address: 'C/ MESENA 101',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'MANOTERAS',
    bus: '7, 29, 107, 125',
  },
  {
    id: 'venue-039',
    name: 'CORAZON INMACULADO (COIN), COLEGIO',
    address: 'LOPEZ DE HOYOS, 59',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'CRUZ DEL RAYO, PROSPERIDAD',
    bus: '1,9,29,52,73',
  },
  {
    id: 'venue-040',
    name: 'EL VALLE SANCHINARRO, COL.',
    address: 'ANA DE AUSTRIA, 60',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'BLASCO IBAÑEZ (ML1)',
    bus: '172, 173',
  },
  {
    id: 'venue-041',
    name: 'GAUDEM, COLEGIO',
    address: 'PLAYA DE BARLOVENTO, 14',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'BARAJAS',
    bus: '105, 115',
  },
  {
    id: 'venue-042',
    name: 'HIGHLANDS',
    address: 'C/ SAN ENRIQUE DE OSSO, 46',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
  },
  {
    id: 'venue-043',
    name: 'HORTALEZA, PDVO. (Antes del dom. 18h)',
    address: 'CTRA. ESTACION DE HORTALEZA,11',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'PARQUE SANTA.Mª, HORTALEZA',
    bus: '9,107,172',
    observations: 'DEJAR LAS ACTAS ANTES DE LAS 18H DEL DOMINGO',
  },
  {
    id: 'venue-044',
    name: 'ICS (International College Spain)',
    address: 'C/ VEREDA NORTE, 3 (LA MORALEJA)',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
  },
  {
    id: 'venue-045',
    name: 'INSTALACION BASICA VILLA DE PONS',
    address: 'AV. DE SAN LUIS 25 D',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'HORTALEZA, PINAR DEL REY',
    bus: '107, 125, 172',
  },
  {
    id: 'venue-046',
    name: 'IRLANDESAS, COLEGIO',
    address: 'C/ BEGONIA 275 (LA MORALEJA)',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
  },
  {
    id: 'venue-047',
    name: 'LA INMACULADA, COL.',
    address: 'AVDA VIRGEN DEL CARMEN, 13',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'HORTALEZA (salida C/Capitan Cortes)',
    bus: '9,107,125,172',
  },
  {
    id: 'venue-048',
    name: 'LUIS ARAGONÉS, PDVO',
    address: 'EL PROVENCIO, 20',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'CANILLAS',
    bus: '73, 120',
  },
  {
    id: 'venue-049',
    name: 'MARIA VIRGEN, COLEGIO',
    address: 'C/ PADRE DAMIAN 20',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'CUZCO, SANTIAGO BERNABEU',
    bus: '27,40,127,147,150',
  },
  {
    id: 'venue-050',
    name: 'PABLO PICASSO',
    address: 'C/ANGEL LUIS DE LA HERRAN S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'PINAR DEL REY',
    bus: '9,72,73',
  },
  {
    id: 'venue-051',
    name: 'PADRE MANYANET, COLEGIO',
    address: 'CARRETERA EL GOLOSO KM. 3,780',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: '// UNIVERSIDAD P. COMILLAS',
    bus: '827, 827A, 828',
  },
  {
    id: 'venue-052',
    name: 'PADRE POVEDA',
    address: 'AVENIDA ALFONSO XIII, 23',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'ALFONSO XIII',
    bus: '9,40,43,72,73',
  },
  {
    id: 'venue-053',
    name: 'RAMÓN Y CAJAL, COL.',
    address: 'ARTURO SORIA, 206',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'ARTURO SORIA',
    bus: '9,70,72,73,201',
  },
  {
    id: 'venue-054',
    name: 'SAN PEDRO APOSTOL, COLEGIO',
    address: 'BABILONIA, 19',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'BARAJAS, ALAMEDA DE OSUNA',
    bus: '105,112,115,151',
  },
  {
    id: 'venue-055',
    name: 'SANTA CATALINA DE SENA',
    address: 'ALFONSO XIII, 160',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'HORTALEZA',
    metro: 'COLOMBIA, PIO XII',
    bus: '16,29,150',
  },
  {
    id: 'venue-056',
    name: 'ABACO, COL.',
    address: 'AVDA DE LA PESETA, 8',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'LA PESETA',
    bus: '35, 155',
  },
  {
    id: 'venue-057',
    name: 'ALUCHE, PDVO.',
    address: 'AVDA. GRAL. FANJUL, 14',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'ALUCHE // (FANJUL)',
    bus: '17,34,117,139',
  },
  {
    id: 'venue-058',
    name: 'AMOROS, COLEGIO',
    address: 'JOAQUIN TURINA, 37',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'CARABANCHEL ALTO',
    bus: '34, 35, 47, 139',
  },
  {
    id: 'venue-059',
    name: 'ARTICA, COL.',
    address: 'C/ DE LOS MORALES, 25',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'LA PESETA',
    bus: '35, 155',
  },
  {
    id: 'venue-060',
    name: 'COLEGIO ESCOLAPIAS',
    address: 'EUGENIA DE MONTIJO, 83',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'CARABANCHEL ALTO',
    bus: '35, 47, 121, 131, 139',
  },
  {
    id: 'venue-061',
    name: 'COLEGIO SANTA GEMA',
    address: 'ESCALONA, 59',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'EMPALME, CASA DE CAMPO // ALUCHE',
    bus: '25, 121',
  },
  {
    id: 'venue-062',
    name: 'GALLUR, PDVO.',
    address: 'GALLUR, 2',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'CARPETANA, LAGUNA',
    bus: '17.25',
  },
  {
    id: 'venue-063',
    name: 'LA DEHESA, CDM',
    address: 'AVDA ARQUEROS S/N(CUATRO VIENTOS)',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'CUATRO VIENTOS',
    bus: '139',
  },
  {
    id: 'venue-064',
    name: 'LA MINA, PDVO.',
    address: 'MONSEÑOR OSCAR ROMERO, 41',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'EUGENIA DE MONTIJIO,CARABANCHEL',
    bus: '17,34,35,113,481,484',
  },
  {
    id: 'venue-065',
    name: 'LA SALLE CARABANCHEL, INSTITUCION',
    address: 'GENERAL ROMERO BASART, 50',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'ALUCHE // (FANJUL)',
    bus: '17, 34, 39, 117, 139',
  },
  {
    id: 'venue-066',
    name: 'LAS CRUCES, PDVO.',
    address: 'AVDA. DE LOS POBLADOS (en frente C/Erica)',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'LATINA',
    metro: 'CARABANCHEL ALTO // FANJUL',
    bus: '121, 131, 139',
  },
  {
    id: 'venue-067',
    name: 'CIUDAD DE LOS POETAS, PDVO.',
    address: 'ANTONIO MACHADO, 2',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MONCLOA',
    metro: 'ANT. MACHADO, VALDEZARZA',
    bus: '126, 127, 132',
  },
  {
    id: 'venue-068',
    name: 'FERNANDO MARTÍN, PDVO.',
    address: 'SANTO ANGEL DE LA GUARDA, 6',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MONCLOA',
    metro: 'FRANCOS RODRIGUEZ',
    bus: '44,64,126,127,132',
  },
  {
    id: 'venue-069',
    name: 'JOSE MARÍA CAGIGAL, PDVO.',
    address: 'SANTA POLA, S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MONCLOA',
    metro: 'PRINCIPE PIO',
    bus: '41,46,75',
  },
  {
    id: 'venue-070',
    name: 'CEIP MARTINEZ MONTAÑES',
    address: 'C/ HACIENDA DE PAVONES 223',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'PAVONES',
    bus: '71, 100, 140',
  },
  {
    id: 'venue-071',
    name: 'ESCUELAS AGUIRRE',
    address: 'C/ PIO BAROJA, 4',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'SAINZ DE BARANDA',
    bus: '2,15,26,30,56,63,143,152',
  },
  {
    id: 'venue-072',
    name: 'GREDOS S.D. MORATALAZ',
    address: 'LUIS DE HOYOS SAINZ, 170',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'PAVONES',
    bus: '30,32,100,140',
  },
  {
    id: 'venue-073',
    name: 'LA MERCED, COL.',
    address: 'JOSE LUIS DE ARRESE, 5',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'ELIPA',
    bus: '71,110,113',
  },
  {
    id: 'venue-074',
    name: 'MONSERRAT, COL.',
    address: 'JUAN ESPLANDIU, 2',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'SAINZ DE BARANDA',
    bus: '15,30,56,143,156,215',
  },
  {
    id: 'venue-075',
    name: 'MORATALAZ, PDVO.',
    address: 'VALDEBERNARDO, S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'PAVONES',
    bus: '8,32,71,142,144',
  },
  {
    id: 'venue-076',
    name: 'PARQUE ADELFAS',
    address: 'C/ MARTINEZ CORROCHANO, 26',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'CONDE DE CASAL',
    bus: '8, 24, 56, 57, 141 156',
  },
  {
    id: 'venue-077',
    name: 'PEPU HERNANDEZ, PAB.',
    address: 'AVDA NIZA ESQUINA C/MANCHESTER',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'LAS MUSAS',
    bus: '38,140,153',
  },
  {
    id: 'venue-078',
    name: 'POLIDEPORTIVO LA ELIPA',
    address: 'C/ ALCALDE GARRIDO JUARISTI 17',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'ESTRELLA',
    bus: '71, 113',
  },
  {
    id: 'venue-079',
    name: 'SAINZ DE VICUÑA, COL.',
    address: 'CAMINO DE VINATEROS, 104',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'MORATALAZ',
    metro: 'VINATEROS',
    bus: '20,30,32,71,113',
  },
  {
    id: 'venue-080',
    name: 'POLIDEPORTIVO LOS ROSALES',
    address: 'C/ LAS LILAS S/N',
    municipalityId: 'muni-005',
    postalCode: '',
    district: 'MOSTOLES',
    metro: 'UNIV. REY JUAN CARLOS // MOSTOLES',
  },
  {
    id: 'venue-081',
    name: 'POLIDEPORTIVO PAU 4',
    address: 'C/ PERSEO 95',
    municipalityId: 'muni-005',
    postalCode: '',
    district: 'MOSTOLES',
    metro: 'MANUELA MALASAÑA',
  },
  {
    id: 'venue-082',
    name: 'DAOIZ Y VELARDE, PDVO.',
    address: 'AVDA.CIUDAD DE BARCELONA, 162',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'RETIRO',
    metro: 'PACÍFICO //(MÉNDEZ ALVARO,ATOCHA)',
    bus: '10,37,57',
  },
  {
    id: 'venue-083',
    name: 'SANTA MARIA DEL PILAR, COLEGIO',
    address: 'C/ DE LOS REYES MAGOS, 3',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'RETIRO',
    metro: 'SAINZ DE BARANDA',
    bus: '30,56,143,156',
  },
  {
    id: 'venue-084',
    name: 'BOSTON, PDVO.',
    address: 'PLAZA BOSTON, S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SALAMANCA',
    metro: 'PARQUE DE LAS AVENIDAS',
    bus: '43,53,74',
  },
  {
    id: 'venue-085',
    name: 'ENTREVIAS, PDVO',
    address: 'RONDA DEL SUR, 4',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SALAMANCA',
    metro: '// (EL POZO)',
    bus: '24,102,103,111',
  },
  {
    id: 'venue-086',
    name: 'INSTALACION BASICA TORRESPAÑA',
    address: 'C/NUDO M-30 C/V A. SAINZ DE BARANDA, 94',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SALAMANCA',
    metro: "O'DONELL",
    bus: '15, 28, 71, 110, 210',
  },
  {
    id: 'venue-087',
    name: 'MOSCARDÓ, PDVO.',
    address: 'PILAR DE ZARAGOZA, 93',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SALAMANCA',
    metro: 'AVDA. DE AMÉRICA,CARTAGENA',
    bus: '1,115,C',
  },
  {
    id: 'venue-088',
    name: 'NUESTRA SEÑORA DE LORETO, COLEGIO',
    address: 'PRINCIPE DE VERGARA, 42',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SALAMANCA',
    metro: 'LISTA, PRINCIPE DE VERGARA',
    bus: '1, 29, 52, 74',
  },
  {
    id: 'venue-089',
    name: 'J.H. NEWMAN, COLEGIO',
    address: 'AVDA. GUADALAJARA, 28-32',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SAN BLAS',
    metro: 'AVDA. DE GUADALAJARA',
    bus: '4, 106, 140, E2',
  },
  {
    id: 'venue-090',
    name: 'LAS ROSAS, COLEGIO',
    address: 'C/ DE CALABRIA, 1',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SAN BLAS',
    metro: 'LAS MUSAS',
    bus: '48, 38, 140',
  },
  {
    id: 'venue-091',
    name: 'SAN BLAS-ANTONIO MATA, PAB.',
    address: 'AVDA. HELLÍN, 79',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'SAN BLAS',
    metro: 'SAN BLAS',
    bus: '38,48,153',
    observations: 'DEJAR LAS ACTAS EN EL BUZON QUE HAY EN EL DESPACHO DEL PROMOTOR',
  },
  {
    id: 'venue-092',
    name: 'ANTONIO DÍAZ MIGUEL, PDVO.',
    address: 'PADRE RUBIO, 65',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'TETUÁN',
    metro: 'VENTILLA',
    bus: '42.147',
    observations:
      'SE DEJAN EN EL MOSTRADOR DE LA ENTRADA HASTA QUE TERMINEN LAS OBRAS EN TRIANGULO DE ORO',
  },
  {
    id: 'venue-093',
    name: 'TRIANGULO DE ORO, PDVO.',
    address: 'BRAVO MURILLO, 374',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'TETUÁN',
    metro: 'PLAZA DE CASTILLA,VALDEACEDERAS',
    bus: '6,27,42,49,66,124,147',
  },
  {
    id: 'venue-094',
    name: 'M4',
    address: 'C/ LA PLATA S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'TORREJON',
    metro: '// SOTO DEL HENARES',
  },
  {
    id: 'venue-095',
    name: 'PABELLON JAVIER LIMONES',
    address: 'C/ JOAQUIN BLUME S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'TORREJON',
  },
  {
    id: 'venue-096',
    name: 'JESÚS ROLLÁN',
    address: 'AVENA S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'USERA',
    metro: 'PLAZA ELIPTICA // 12 OCTUBRE, ORCASITAS',
    bus: '6, 60, 78, 81, 116, 121, 131',
  },
  {
    id: 'venue-097',
    name: 'CEIP SANTO DOMINGO',
    address: 'SAN FELIU DE GUIXOLS, 7',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VALLECAS',
    metro: 'ALTO DEL ARENAL',
    bus: '57, 58, 103, 142, 143',
  },
  {
    id: 'venue-098',
    name: 'GREDOS S.D. MORATALAZ',
    address: 'LUIS DE HOYOS SAINZ, 170',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VALLECAS',
    metro: 'PAVONES',
    bus: '30,32,100,140',
  },
  {
    id: 'venue-099',
    name: 'MIGUEL GUILLEM PRIM',
    address: 'C/ FUENTIDUEÑA, 6',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VALLECAS',
    metro: 'CONGOSTO',
    bus: '103, 142',
  },
  {
    id: 'venue-100',
    name: 'NUEVA CASTILLA, COLEGIO',
    address: 'C/ MONTES DE BARBANZA, 19',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VALLECAS',
    metro: 'VILLA DE VALLECAS',
    bus: '54, 103, 142',
  },
  {
    id: 'venue-101',
    name: 'PALOMERAS VALLECAS, PDVO.',
    address: 'AVDA. ALBUFERA, S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VALLECAS',
    metro: 'MIGUEL HERNÁNDEZ',
    bus: '10,54,103,142,143,154',
  },
  {
    id: 'venue-102',
    name: 'WILFRED AGBONAVARE (ANT. ALBERTO GARCIA)',
    address: 'REGUERA DE TOMATEROS, 39 B',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VALLECAS',
    metro: '// (EL POZO)',
    bus: '24,102,107,310',
    observations: 'ANTIGUO ALBERTO GARCIA',
  },
  {
    id: 'venue-103',
    name: 'ANGEL NIETO, PDVO.',
    address: 'PAYASO FOFÓ, 7',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VALLECAS',
    metro: 'PORTAZGO',
    bus: '10,54,57,58,103',
  },
  {
    id: 'venue-104',
    name: 'EL VALLE VALDEBERNARDO',
    address: 'C/ DE LOS FAISANES S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VICÁLVARO',
    metro: 'VALDEBERNARDO(salida c/La raya)',
    bus: '8,71,130',
  },
  {
    id: 'venue-105',
    name: 'VALDEBERNARDO (FAUSTINA VALLADOLID)',
    address: 'LADERA DE LOS ALMENDROS, 2',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VICÁLVARO',
    metro: 'VALDEBERNARDO(salida c/La raya)',
    bus: '8,71,130',
  },
  {
    id: 'venue-106',
    name: 'CEIP JUAN DE LA CIERVA',
    address: 'VILLARROSA, 7',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VILLAVERDE',
    metro: 'CRUCE VILLAVERDE // VILLAVERDE BAJO',
    bus: '10',
  },
  {
    id: 'venue-107',
    name: 'PLATA Y CASTAÑAR',
    address: 'PASEO PLATA Y CASTAÑAR, 7',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VILLAVERDE',
    metro: '// PUENTE ALCOCER',
    bus: '76',
  },
  {
    id: 'venue-108',
    name: 'RAÚL GONZALEZ, PDVO',
    address: 'BENIMAMET, S/N',
    municipalityId: 'muni-001',
    postalCode: '',
    district: 'VILLAVERDE',
    metro: '// (SAN CRISTOBAL)',
    bus: '59.79',
  },
]

// Catálogo demo + pabellones reales importados del calendario FBM.
export const mockVenues: MockVenue[] = (__fbmStore.venues ??= [
  ...demoVenues,
  ...(fbmSeed.venues as MockVenue[]),
])

// ── Pistas ──────────────────────────────────────────────────────────────────
// `mockCourts`/`getMockCourt`/`MockCourt` viven en mock-data-client.ts (los
// consumen componentes cliente) y se reexportan al final de este módulo.

// ── Personas ────────────────────────────────────────────────────────────────

const seedPersons: MockPerson[] = [
  {
    id: 'person-001',
    nick: 'DECANO',
    name: 'Carlos Martínez López',
    email: 'carlos.martinez@email.com',
    phone: '612345678',
    role: 'arbitro' as const,
    category: 'autonomico' as const,
    address: 'C/ Gran Vía 15, 28013 Madrid',
    postalCode: '28013',
    municipalityId: 'muni-001',
    bankIban: 'ES1234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-08-15'),
  },
  {
    id: 'person-002',
    nick: 'JEFA',
    name: 'Laura García Fernández',
    email: 'laura.garcia@email.com',
    phone: '623456789',
    role: 'arbitro' as const,
    category: 'nacional' as const,
    address: 'C/ Alcalá 45, 28014 Madrid',
    postalCode: '28014',
    municipalityId: 'muni-001',
    bankIban: 'ES2234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-08-15'),
  },
  {
    id: 'person-003',
    nick: 'CATEDRÁTICO',
    name: 'Miguel Ángel Ruiz Torres',
    email: 'miguel.ruiz@email.com',
    phone: '634567890',
    role: 'arbitro' as const,
    category: 'provincial' as const,
    address: 'Av. de la Libertad 8, 28922 Alcorcón',
    postalCode: '28922',
    municipalityId: 'muni-002',
    bankIban: 'ES3234567890123456789012',
    active: true,
    hasCar: false,
    authUserId: null,
    createdAt: new Date('2024-09-01'),
  },
  {
    id: 'person-004',
    nick: 'CONDESA',
    name: 'Ana Belén Sánchez Díaz',
    email: 'anabelen.sanchez@email.com',
    phone: '645678901',
    role: 'anotador' as const,
    category: 'autonomico' as const,
    address: 'C/ Mayor 22, 28901 Getafe',
    postalCode: '28901',
    municipalityId: 'muni-003',
    bankIban: 'ES4234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-08-20'),
  },
  {
    id: 'person-005',
    nick: 'CRONISTA',
    name: 'David Fernández Moreno',
    email: 'david.fernandez@email.com',
    phone: '656789012',
    role: 'anotador' as const,
    category: 'escuela' as const,
    address: 'C/ Real 10, 28917 Leganés',
    postalCode: '28917',
    municipalityId: 'muni-004',
    bankIban: 'ES5234567890123456789012',
    active: true,
    hasCar: false,
    authUserId: null,
    createdAt: new Date('2024-09-10'),
  },
  {
    id: 'person-006',
    nick: 'COMENDADOR',
    name: 'Raúl Jiménez Navarro',
    email: 'raul.jimenez@email.com',
    phone: '667890123',
    role: 'arbitro' as const,
    category: 'autonomico' as const,
    address: 'C/ Constitución 3, 28936 Móstoles',
    postalCode: '28936',
    municipalityId: 'muni-005',
    bankIban: 'ES6234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-09-05'),
  },
  {
    id: 'person-007',
    nick: 'VIRTUOSA',
    name: 'Patricia López Martín',
    email: 'patricia.lopez@email.com',
    phone: '678901234',
    role: 'arbitro' as const,
    category: 'nacional' as const,
    address: 'C/ Severo Ochoa 12, 28945 Fuenlabrada',
    postalCode: '28945',
    municipalityId: 'muni-006',
    bankIban: 'ES7234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-08-25'),
  },
  {
    id: 'person-008',
    nick: 'SIBILA',
    name: 'Sofía Morales Vega',
    email: 'sofia.morales@email.com',
    phone: '689012345',
    role: 'anotador' as const,
    category: 'nacional' as const,
    address: 'C/ Toledo 40, 28922 Alcorcón',
    postalCode: '28922',
    municipalityId: 'muni-002',
    bankIban: 'ES8234567890123456789012',
    active: true,
    hasCar: false,
    authUserId: null,
    createdAt: new Date('2024-09-15'),
  },
  {
    id: 'person-009',
    nick: 'ESCRIBANO',
    name: 'Javier Romero Díaz',
    email: 'javier.romero@email.com',
    phone: '690123456',
    role: 'anotador' as const,
    category: 'autonomico' as const,
    address: 'Av. de Madrid 5, 28936 Móstoles',
    postalCode: '28936',
    municipalityId: 'muni-005',
    bankIban: 'ES9234567890123456789012',
    active: true,
    hasCar: true,
    authUserId: null,
    createdAt: new Date('2024-10-01'),
  },
]

// 9 personas seed (demo, con designaciones/incompatibilidades) + 770 árbitros +
// 500 anotadores generados de forma determinista (roster FBM; ver referee-roster).
export const mockPersons: MockPerson[] = (__fbmStore.persons ??= [
  ...seedPersons,
  ...generateReferees(mockMunicipalities.map((m) => ({ id: m.id, name: m.name }))),
  ...generateScorers(mockMunicipalities.map((m) => ({ id: m.id, name: m.name }))),
])

// ── Incompatibilidades ──────────────────────────────────────────────────────

export interface MockIncompatibility {
  id: string
  personId: string
  teamName: string
  reason: string
}

export const mockIncompatibilities: MockIncompatibility[] = (__fbmStore.incompatibilities ??= [
  {
    id: 'incompat-001',
    personId: 'person-001',
    teamName: 'CB Vallecas',
    reason: 'Jugador del club',
  },
  {
    id: 'incompat-002',
    personId: 'person-003',
    teamName: 'AD Alcorcón Basket',
    reason: 'Entrenador de cantera',
  },
  {
    id: 'incompat-003',
    personId: 'person-006',
    teamName: 'CB Móstoles',
    reason: 'Familiar en directiva',
  },
])

// ── Helpers de fecha (local timezone, sin UTC shift) ────────────────────────

// ── Partidos ────────────────────────────────────────────────────────────────

export interface MockMatch {
  id: string
  date: string
  time: string
  venueId: string
  competitionId: string
  homeTeam: string
  awayTeam: string
  refereesNeeded: number
  scorersNeeded: number
  status: 'scheduled' | 'designated' | 'played' | 'suspended'
  seasonId: string
  matchday: number
  courtId?: string | null
  // true = `time` es una estimación sintetizada por el importador porque el
  // calendario oficial FBM emitió el partido con HORA=00:00 (ver
  // fbm-calendar/synthesize-schedule.ts). Ausente o false = hora real del
  // calendario. Opcional para no obligar a los partidos legacy (seed y ruta
  // XLSX) a declararla: ninguno de ellos tiene horas sintetizadas.
  timeIsEstimated?: boolean
}

// Partidos por defecto = calendario FBM real (Liga VIPS Masculina + Junior
// Masculino ORO), generado desde el CSV oficial (ver fbmSeed y
// scripts/generate-fbm-seed.ts). Reemplaza a los antiguos partidos demo.
export const mockMatches: MockMatch[] = (__fbmStore.matches ??= [
  ...(fbmSeed.matches as MockMatch[]),
])

// ── Designaciones ───────────────────────────────────────────────────────────

export interface MockDesignation {
  id: string
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  // Posición nombrada dentro del rol. OPCIONAL: las designaciones legacy del
  // piloto (designations.json) no la llevan y nunca se les inventa una.
  position?: DesignationPosition
  travelCost: string
  distanceKm: string
  status: DesignationStatus
  notifiedAt: Date | null
  createdAt: Date
}

// Sin designaciones demo: los partidos por defecto son el calendario FBM real
// recién importado (sin asignar). Las designaciones se crean al designar.
// Persistidas a disco (designation-persistence.ts) e hidratadas al arranque
// del server (instrumentation.ts) para sobrevivir a reinicios.
export const mockDesignations: MockDesignation[] = (__fbmStore.designations ??= [])

// ── Disponibilidades de ejemplo ─────────────────────────────────────────────

// Generar disponibilidades para todas las personas en sabado/domingo
function generateAvailabilities() {
  const avails: {
    id: string
    personId: string
    weekStart: string
    dayOfWeek: number
    startTime: string
    endTime: string
  }[] = []
  let counter = 1

  const schedules: Record<string, { day: number; start: string; end: string }[]> = {
    'person-001': [
      // Carlos: sabado 09-13, 15-19; domingo 09-13
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '15:00', end: '16:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
    ],
    'person-002': [
      // Laura: sabado 10-14, 16-20; domingo 10-14
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-003': [
      // Miguel: sabado 09-13; domingo 09-13, 15-19
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '15:00', end: '16:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
    ],
    'person-004': [
      // Ana Belen: sabado 09-14; domingo 10-14
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-005': [
      // David: sabado 15-21; domingo 15-21
      { day: 5, start: '15:00', end: '16:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 5, start: '20:00', end: '21:00' },
      { day: 6, start: '15:00', end: '16:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
      { day: 6, start: '19:00', end: '20:00' },
      { day: 6, start: '20:00', end: '21:00' },
    ],
    'person-006': [
      // Raul: sabado 09-14, 16-21; domingo 10-14
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 5, start: '20:00', end: '21:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-007': [
      // Patricia: sabado 10-14, 16-20; domingo 09-14, 16-20
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
      { day: 6, start: '19:00', end: '20:00' },
    ],
    'person-008': [
      // Sofia: sabado 09-14; domingo 09-14
      { day: 5, start: '09:00', end: '10:00' },
      { day: 5, start: '10:00', end: '11:00' },
      { day: 5, start: '11:00', end: '12:00' },
      { day: 5, start: '12:00', end: '13:00' },
      { day: 5, start: '13:00', end: '14:00' },
      { day: 6, start: '09:00', end: '10:00' },
      { day: 6, start: '10:00', end: '11:00' },
      { day: 6, start: '11:00', end: '12:00' },
      { day: 6, start: '12:00', end: '13:00' },
      { day: 6, start: '13:00', end: '14:00' },
    ],
    'person-009': [
      // Javier: sabado 16-21; domingo 16-21
      { day: 5, start: '16:00', end: '17:00' },
      { day: 5, start: '17:00', end: '18:00' },
      { day: 5, start: '18:00', end: '19:00' },
      { day: 5, start: '19:00', end: '20:00' },
      { day: 5, start: '20:00', end: '21:00' },
      { day: 6, start: '16:00', end: '17:00' },
      { day: 6, start: '17:00', end: '18:00' },
      { day: 6, start: '18:00', end: '19:00' },
      { day: 6, start: '19:00', end: '20:00' },
      { day: 6, start: '20:00', end: '21:00' },
    ],
  }

  for (const [personId, slots] of Object.entries(schedules)) {
    for (const ws of [weekStart, nextWeek]) {
      for (const slot of slots) {
        avails.push({
          id: `avail-${String(counter++).padStart(3, '0')}`,
          personId,
          weekStart: ws,
          dayOfWeek: slot.day,
          startTime: slot.start,
          endTime: slot.end,
        })
      }
    }
  }

  return avails
}

// Disponibilidad de temporada 2025-26 para las 1279 personas (9 demo + 770
// árbitros + 500 anotadores), generada por arquetipo determinista (ver
// availability-roster.ts). Los 9 demo conservan ADEMÁS sus slots de semana
// actual/siguiente de generateAvailabilities() (el portal /disponibilidad
// sigue funcionando con esos datos hand-written).
const seasonAvailability = generateSeasonAvailability(
  mockPersons,
  mockMatches.map((m) => m.date),
)

export const mockAvailabilities: GeneratedAvailabilitySlot[] = (__fbmStore.availabilities ??= [
  ...generateAvailabilities(),
  ...seasonAvailability.slots,
])

// ── Disponibilidad de jornada (formulario simplificado sabado/domingo/entre semana) ──

export const mockMatchdayAvailabilities: MatchdayAvailability[] =
  (__fbmStore.matchdayAvailabilities ??= [
    {
      id: 'matchday-avail-001',
      personId: 'person-001',
      saturdayDate: nextSaturday,
      saturdayMorning: true,
      saturdayAfternoon: true,
      sundayMorning: true,
      sundayAfternoon: false,
      weekdayDays: [1, 3],
      notes: null,
      updatedAt: '2025-01-15T09:30:00.000Z',
    },
    {
      id: 'matchday-avail-002',
      personId: 'person-002',
      saturdayDate: nextSaturday,
      saturdayMorning: false,
      saturdayAfternoon: true,
      sundayMorning: true,
      sundayAfternoon: true,
      weekdayDays: [],
      notes: 'Solo tarde el sabado',
      updatedAt: '2025-01-16T18:00:00.000Z',
    },
    {
      id: 'matchday-avail-003',
      personId: 'person-006',
      saturdayDate: nextSaturday,
      saturdayMorning: true,
      saturdayAfternoon: false,
      sundayMorning: false,
      sundayAfternoon: false,
      weekdayDays: [4],
      notes: null,
      updatedAt: '2025-01-17T12:00:00.000Z',
    },
    // Muestra determinista (~40 registros) de disponibilidad de jornada de
    // temporada, coherente con los slots generados por arquetipo (badge de
    // notas del picker). Ver availability-roster.ts.
    ...seasonAvailability.matchdayRecords,
  ])

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getMockVenue(venueId: string) {
  return mockVenues.find((v) => v.id === venueId)
}

export function getMockMatch(matchId: string) {
  return mockMatches.find((m) => m.id === matchId)
}

export function getMockPerson(personId: string) {
  return mockPersons.find((p) => p.id === personId)
}

export function getMockCompetition(competitionId: string) {
  return mockCompetitions.find((c) => c.id === competitionId)
}

export function getMockMunicipality(municipalityId: string) {
  return mockMunicipalities.find((m) => m.id === municipalityId)
}

export function getMockDesignationsForPerson(personId: string) {
  return mockDesignations
    .filter((d) => d.personId === personId)
    .map((d) => {
      const match = getMockMatch(d.matchId)
      const venue = match ? getMockVenue(match.venueId) : undefined
      const competition = match ? getMockCompetition(match.competitionId) : undefined
      return { ...d, match, venue, competition }
    })
}

/**
 * Enriquecimiento de las designaciones de UN partido, con el partido y las
 * designaciones ya resueltos por el llamador.
 *
 * Existe aparte de `getMockDesignationsForMatch` para que quien tenga que
 * enriquecer MUCHOS partidos en una sola pasada (la ruta de `/api/admin/matches`
 * con una jornada de ~1.300 partidos) pueda indexar `mockDesignations` una vez
 * y evitar el `filter` por partido, que es O(partidos × designaciones). La forma
 * del dato de salida es exactamente la misma en ambos caminos.
 */
export function enrichMatchDesignations(
  match: MockMatch | undefined,
  designations: MockDesignation[],
) {
  return designations.map((d) => {
    const person = getMockPerson(d.personId)
    const municipality = person ? getMockMunicipality(person.municipalityId) : undefined
    const personWithAddress = person
      ? {
          id: person.id,
          name: person.name,
          role: person.role,
          category: person.category,
          nick: person.nick ?? null,
          refereeLevel: person.refereeLevel ?? null,
          municipalityId: person.municipalityId,
          hasCar: person.hasCar,
          address: person.address,
        }
      : undefined
    // Disponibilidad resuelta en SERVIDOR: `isPersonAvailable` depende de
    // `mockAvailabilities`, que se genera a partir de las fechas de todos los
    // partidos. El badge de assignment-slot la consumía importando el helper
    // en cliente, lo que arrastraba el seed al bundle.
    const isAvailable = match ? isPersonAvailable(d.personId, match.date, match.time) : undefined
    return { ...d, person: personWithAddress, municipality, isAvailable }
  })
}

export function getMockDesignationsForMatch(matchId: string) {
  return enrichMatchDesignations(
    getMockMatch(matchId),
    mockDesignations.filter((d) => d.matchId === matchId),
  )
}

export function getMockAvailabilitiesForPerson(personId: string, weekStart: string) {
  return mockAvailabilities.filter((a) => a.personId === personId && a.weekStart === weekStart)
}

// mockDistances nunca se muta en runtime (matriz precalculada de municipios):
// indexar una vez a la carga del módulo evita el escaneo lineal de ~465 pares
// en cada llamada (getMockDistance es un hot path del solver — se llama por
// cada candidato evaluado con coste de desplazamiento).
const distanceIndex = new Map<string, number>()
for (const d of mockDistances) {
  distanceIndex.set(`${d.originId}|${d.destId}`, d.distanceKm)
  distanceIndex.set(`${d.destId}|${d.originId}`, d.distanceKm)
}

export function getMockDistance(originId: string, destId: string): number {
  if (originId === destId) return 0
  return distanceIndex.get(`${originId}|${destId}`) ?? 35 // fallback for unknown pairs
}

// Tarifas de desplazamiento (regla FBM 2026-07-11): 0,26 €/km fuera del
// municipio propio; día 100% en el municipio propio → fijo por día (Madrid 3€,
// resto 2€).
export const TRAVEL_RATE_PER_KM = 0.26
export const TRAVEL_FLAT_MADRID = 3
export const TRAVEL_FLAT_OTHER = 2

function isMadridMunicipality(municipalityId: string): boolean {
  return getMockMunicipality(municipalityId)?.name?.toLowerCase() === 'madrid'
}

// Estimación POR PARTIDO: para el solver y los badges de asignación (coste
// marginal orientativo). NO es la liquidación real, que es por día: la fija
// calculateDailyTravelCost. Mismo municipio → fijo del municipio; si no → km
// × tarifa.
export function calculateMockTravelCost(
  personMuniId: string,
  venueMuniId: string,
): { cost: number; km: number } {
  if (personMuniId === venueMuniId) {
    return {
      cost: isMadridMunicipality(personMuniId) ? TRAVEL_FLAT_MADRID : TRAVEL_FLAT_OTHER,
      km: 0,
    }
  }
  const km = getMockDistance(personMuniId, venueMuniId)
  return { cost: Number((km * TRAVEL_RATE_PER_KM).toFixed(2)), km }
}

// Liquidación REAL por persona y día (fuente de la verdad para reportes/pagos).
// venueMunicipalityIds = municipios de TODOS los partidos de la persona ese día.
// - Si hay salida a otro municipio → SOLO kilometraje: un trayecto por
//   municipio de destino distinto × tarifa/km (sin fijo).
// - Si todos los partidos son en su municipio → fijo por día (Madrid 3, resto 2).
export function calculateDailyTravelCost(
  personMuniId: string,
  venueMunicipalityIds: string[],
): { cost: number; km: number } {
  if (venueMunicipalityIds.length === 0) return { cost: 0, km: 0 }
  const awayMunis = [...new Set(venueMunicipalityIds)].filter((id) => id !== personMuniId)
  if (awayMunis.length > 0) {
    const km = awayMunis.reduce((sum, destId) => sum + getMockDistance(personMuniId, destId), 0)
    return { cost: Number((km * TRAVEL_RATE_PER_KM).toFixed(2)), km: Number(km.toFixed(1)) }
  }
  return {
    cost: isMadridMunicipality(personMuniId) ? TRAVEL_FLAT_MADRID : TRAVEL_FLAT_OTHER,
    km: 0,
  }
}

// Agrupa las designaciones de una persona por día y suma el coste real diario.
// designations = [{ date, venueMunicipalityId }] de esa persona. Devuelve el
// total y el desglose por día (para liquidaciones).
export function calculatePersonTravelCost(
  personMuniId: string,
  designations: { date: string; venueMunicipalityId: string }[],
): { totalCost: number; totalKm: number; byDay: { date: string; cost: number; km: number }[] } {
  const byDate = new Map<string, string[]>()
  for (const d of designations) {
    if (!d.date) continue
    const list = byDate.get(d.date) ?? []
    list.push(d.venueMunicipalityId)
    byDate.set(d.date, list)
  }
  const byDay = [...byDate.entries()]
    .map(([date, munis]) => {
      const { cost, km } = calculateDailyTravelCost(personMuniId, munis)
      return { date, cost, km }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    totalCost: Number(byDay.reduce((s, d) => s + d.cost, 0).toFixed(2)),
    totalKm: Number(byDay.reduce((s, d) => s + d.km, 0).toFixed(1)),
    byDay,
  }
}

// Conveniencia: coste real por día de una persona a partir de sus designaciones
// (resuelve fecha del partido y municipio del pabellón). Fuente de la verdad
// para dashboard, portal y reportes.
export function getPersonTravelCost(
  personId: string,
  designations: { matchId: string }[],
): { totalCost: number; totalKm: number; byDay: { date: string; cost: number; km: number }[] } {
  const person = getMockPerson(personId)
  const items = designations.map((d) => {
    const match = getMockMatch(d.matchId)
    const venue = match ? getMockVenue(match.venueId) : undefined
    return { date: match?.date ?? '', venueMunicipalityId: venue?.municipalityId ?? '' }
  })
  return calculatePersonTravelCost(person?.municipalityId ?? '', items)
}

// ── Índice O(1) de disponibilidad ────────────────────────────────────────────
// mockAvailabilities puede llegar a ~40-50k registros (roster completo de
// temporada); filtrar el array entero en cada llamada de isPersonAvailable
// (picker con 1279 personas por render) sería jank severo. Se indexa de forma
// lazy por clave `${personId}|${weekStart}|${dayOfWeek}` y se invalida en los
// puntos que mutan mockAvailabilities.
type AvailabilityIndexEntry = {
  personId: string
  weekStart: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

let availabilityIndex: Map<string, AvailabilityIndexEntry[]> | null = null
let availabilityIndexLength = -1

function buildAvailabilityIndex(): Map<string, AvailabilityIndexEntry[]> {
  const index = new Map<string, AvailabilityIndexEntry[]>()
  for (const a of mockAvailabilities) {
    const key = `${a.personId}|${a.weekStart}|${a.dayOfWeek}`
    const list = index.get(key)
    if (list) list.push(a)
    else index.set(key, [a])
  }
  return index
}

// Export: llamar tras cualquier mutación de mockAvailabilities (push/length=0/
// resetMockData). Belt-and-braces: aunque no se llame, una longitud distinta a
// la indexada dispara la reconstrucción en la siguiente lectura.
export function invalidateAvailabilityIndex(): void {
  availabilityIndex = null
}

function getAvailabilityIndex(): Map<string, AvailabilityIndexEntry[]> {
  if (availabilityIndex === null || availabilityIndexLength !== mockAvailabilities.length) {
    availabilityIndex = buildAvailabilityIndex()
    availabilityIndexLength = mockAvailabilities.length
  }
  return availabilityIndex
}

// Cache de (dayOfWeek, weekStart) por fecha: `date` → info. Pura función de la
// fecha (sin estado mutable), así que no necesita invalidación. El solver
// llama isPersonAvailable una vez POR CANDIDATO evaluado (cientos de miles de
// veces con el roster completo) pero solo hay unas pocas decenas de fechas de
// partido distintas — parsear el Date una vez por fecha en lugar de una vez
// por llamada es la diferencia entre <1s y >10s con 1279 personas.
const dateInfoCache = new Map<string, { dayOfWeek: number; weekStart: string }>()

function getDateInfo(date: string): { dayOfWeek: number; weekStart: string } {
  let info = dateInfoCache.get(date)
  if (!info) {
    const d = new Date(date + 'T00:00:00')
    const jsDay = d.getDay() // 0=domingo..6=sabado
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1 // 0=lunes..5=sabado,6=domingo
    const diff = d.getDate() - jsDay + (jsDay === 0 ? -6 : 1)
    d.setDate(diff)
    info = { dayOfWeek, weekStart: formatLocalDate(d) }
    dateInfoCache.set(date, info)
  }
  return info
}

// Sin cierres (closures) ni arrays por llamada: isPersonAvailable se llama
// cientos de miles de veces por resolución del solver con el roster completo
// (1279 personas), y una función/array nuevo en cada invocación genera presión
// de GC medible a ese volumen. toMinutesOfDay es una función de módulo (se
// crea una sola vez) y el recorrido de `avails` usa un for clásico en vez de
// `.some()` con callback.
function toMinutesOfDay(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const NO_AVAILABILITY: AvailabilityIndexEntry[] = []

export function isPersonAvailable(personId: string, date: string, time: string): boolean {
  const { dayOfWeek, weekStart: weekStartStr } = getDateInfo(date)

  const key = `${personId}|${weekStartStr}|${dayOfWeek}`
  const avails = getAvailabilityIndex().get(key) ?? NO_AVAILABILITY

  // Comparacion en minutos (no en horas enteras): una franja 09:00-15:30 debe cubrir
  // un partido a las 15:00 pero no uno a las 15:30 (cae en la franja de tarde).
  const matchMin = toMinutesOfDay(time)
  for (let i = 0; i < avails.length; i++) {
    const a = avails[i]
    if (matchMin >= toMinutesOfDay(a.startTime) && matchMin < toMinutesOfDay(a.endTime)) return true
  }
  return false
}

export function getPersonIncompatibilities(personId: string) {
  return mockIncompatibilities.filter((i) => i.personId === personId)
}

export function hasTimeOverlap(personId: string, matchId: string): boolean {
  const targetMatch = getMockMatch(matchId)
  if (!targetMatch) return false

  const personDesignations = mockDesignations.filter(
    (d) => d.personId === personId && d.matchId !== matchId,
  )

  const targetHour = parseInt(targetMatch.time.split(':')[0])

  for (const desig of personDesignations) {
    const otherMatch = getMockMatch(desig.matchId)
    if (!otherMatch || otherMatch.date !== targetMatch.date) continue
    const otherHour = parseInt(otherMatch.time.split(':')[0])
    // 2h window for each match (game time + travel)
    if (Math.abs(targetHour - otherHour) < 2) return true
  }

  return false
}

// ── Datos historicos de jornadas anteriores ─────────────────────────────

export interface HistoricalMatchday {
  matchday: number
  totalMatches: number
  totalCost: number
  designations: {
    personId: string
    role: 'arbitro' | 'anotador'
    travelCost: number
    distanceKm: number
    venueMunicipalityId: string
  }[]
}

export const mockHistoricalMatchdays: HistoricalMatchday[] = [
  {
    matchday: 13,
    totalMatches: 8,
    totalCost: 18.5,
    designations: [
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 1.3,
        distanceKm: 13,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-003',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 1.2,
        distanceKm: 12,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 1.5,
        distanceKm: 15,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-004',
        role: 'anotador',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 0.6,
        distanceKm: 6,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-008',
        role: 'anotador',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-009',
        role: 'anotador',
        travelCost: 1.8,
        distanceKm: 18,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 2.5,
        distanceKm: 25,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 2.0,
        distanceKm: 20,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 0.9,
        distanceKm: 9,
        venueMunicipalityId: 'muni-006',
      },
    ],
  },
  {
    matchday: 14,
    totalMatches: 9,
    totalCost: 22.3,
    designations: [
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 1.1,
        distanceKm: 11,
        venueMunicipalityId: 'muni-004',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-003',
        role: 'arbitro',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-005',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 2.0,
        distanceKm: 20,
        venueMunicipalityId: 'muni-001',
      },
      {
        personId: 'person-001',
        role: 'arbitro',
        travelCost: 2.5,
        distanceKm: 25,
        venueMunicipalityId: 'muni-005',
      },
      {
        personId: 'person-002',
        role: 'arbitro',
        travelCost: 1.5,
        distanceKm: 15,
        venueMunicipalityId: 'muni-003',
      },
      {
        personId: 'person-003',
        role: 'arbitro',
        travelCost: 0.8,
        distanceKm: 8,
        venueMunicipalityId: 'muni-004',
      },
      {
        personId: 'person-004',
        role: 'anotador',
        travelCost: 1.0,
        distanceKm: 10,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 1.4,
        distanceKm: 14,
        venueMunicipalityId: 'muni-005',
      },
      {
        personId: 'person-008',
        role: 'anotador',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-002',
      },
      {
        personId: 'person-009',
        role: 'anotador',
        travelCost: 0.8,
        distanceKm: 8,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-006',
        role: 'arbitro',
        travelCost: 1.4,
        distanceKm: 14,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-007',
        role: 'arbitro',
        travelCost: 3.0,
        distanceKm: 0,
        venueMunicipalityId: 'muni-006',
      },
      {
        personId: 'person-004',
        role: 'anotador',
        travelCost: 0.6,
        distanceKm: 6,
        venueMunicipalityId: 'muni-004',
      },
      {
        personId: 'person-005',
        role: 'anotador',
        travelCost: 0.9,
        distanceKm: 9,
        venueMunicipalityId: 'muni-006',
      },
    ],
  },
]

// ── Alertas de disponibilidad ────────────────────────────────────────────

export interface MockAlert {
  id: string
  weekStart: string
  roles: string[]
  categories: string[]
  message: string
  recipientCount: number
  sentAt: Date
}

export const mockAlertLog: MockAlert[] = (__fbmStore.alertLog ??= [])

// ── Snapshots iniciales para reset ────────────────────────────────────────

// `??=` captura el SEED en la PRIMERA evaluación del módulo (arrays recién
// creados desde su inicializador real), no un estado mutado de una
// reevaluación posterior por HMR: las siguientes evaluaciones reutilizan el
// snapshot ya guardado en el store de globalThis.
const INITIAL_MATCHES = (__fbmStore.initialMatches ??= [...mockMatches])
const INITIAL_PERSONS = (__fbmStore.initialPersons ??= [...mockPersons])
const INITIAL_DESIGNATIONS: MockDesignation[] = (__fbmStore.initialDesignations ??= [
  ...mockDesignations,
])
const INITIAL_AVAILABILITIES = (__fbmStore.initialAvailabilities ??= [...mockAvailabilities])
const INITIAL_MATCHDAY_AVAILABILITIES = (__fbmStore.initialMatchdayAvailabilities ??= [
  ...mockMatchdayAvailabilities,
])
const INITIAL_INCOMPATIBILITIES = (__fbmStore.initialIncompatibilities ??= [
  ...mockIncompatibilities,
])
const INITIAL_COURTS = (__fbmStore.initialCourts ??= [...mockCourts])
const INITIAL_VENUES = (__fbmStore.initialVenues ??= [...mockVenues])

export function resetMockData() {
  mockMatches.length = 0
  mockMatches.push(...INITIAL_MATCHES)
  mockPersons.length = 0
  mockPersons.push(...INITIAL_PERSONS)
  mockDesignations.length = 0
  mockDesignations.push(...INITIAL_DESIGNATIONS)
  mockAvailabilities.length = 0
  mockAvailabilities.push(...INITIAL_AVAILABILITIES)
  mockMatchdayAvailabilities.length = 0
  mockMatchdayAvailabilities.push(...INITIAL_MATCHDAY_AVAILABILITIES)
  mockIncompatibilities.length = 0
  mockIncompatibilities.push(...INITIAL_INCOMPATIBILITIES)
  mockCourts.length = 0
  mockCourts.push(...INITIAL_COURTS)
  mockVenues.length = 0
  mockVenues.push(...INITIAL_VENUES)
  mockAlertLog.length = 0
  invalidateAvailabilityIndex()
}

// ── Reexport de la capa client-safe ───────────────────────────────────────
//
// Todo lo de mock-data-client.ts se reexporta aquí para que los consumidores de
// servidor sigan importando desde '@/lib/mock-data' sin cambios. Los
// componentes cliente deben importar de '@/lib/mock-data-client' directamente:
// pasar por este módulo les metería el seed de partidos en el bundle.

export {
  nextSaturday,
  nextSunday,
  weekStart,
  nextWeek,
  formatLocalDate,
  mockCourts,
  DEMO_PERSON_ID,
}
export { getMockCourt } from './mock-data-client'
export type {
  MockCourt,
  DesignationStatus,
  AvailabilitySlot,
  MatchdayAvailability,
} from './mock-data-client'
