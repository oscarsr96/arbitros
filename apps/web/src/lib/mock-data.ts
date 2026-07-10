// Datos mock para desarrollo sin Supabase/PostgreSQL
// Mismo formato que las tablas del schema Drizzle

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

export const mockCompetitions = [
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

export const mockVenues: MockVenue[] = [
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

// ── Pistas ──────────────────────────────────────────────────────────────────

export interface MockCourt {
  id: string
  venueId: string
  name: string
}

export const mockCourts: MockCourt[] = [
  { id: 'court-001', venueId: 'venue-001', name: 'Pista 1' },
  { id: 'court-002', venueId: 'venue-001', name: 'Pista 2' },
  { id: 'court-003', venueId: 'venue-007', name: 'Pista Central' },
]

// ── Personas ────────────────────────────────────────────────────────────────

export const mockPersons = [
  {
    id: 'person-001',
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
    name: 'David Fernández Moreno',
    email: 'david.fernandez@email.com',
    phone: '656789012',
    role: 'anotador' as const,
    category: 'provincial' as const,
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

// ── Incompatibilidades ──────────────────────────────────────────────────────

export const mockIncompatibilities = [
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
]

// ── Helpers de fecha (local timezone, sin UTC shift) ────────────────────────

function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Partidos ────────────────────────────────────────────────────────────────

const nextSaturday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return formatLocalDate(d)
})()

const nextSunday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay() + 7) % 7 || 7))
  return formatLocalDate(d)
})()

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
}

export const mockMatches: MockMatch[] = [
  {
    id: 'match-001',
    date: nextSaturday,
    time: '10:00',
    venueId: 'venue-001',
    competitionId: 'comp-001',
    homeTeam: 'CB Vallecas',
    awayTeam: 'Baloncesto Alcorcón',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-002',
    date: nextSaturday,
    time: '12:00',
    venueId: 'venue-002',
    competitionId: 'comp-001',
    homeTeam: 'AD Alcorcón Basket',
    awayTeam: 'CB Getafe',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-003',
    date: nextSaturday,
    time: '16:00',
    venueId: 'venue-003',
    competitionId: 'comp-002',
    homeTeam: 'CB Getafe Femenino',
    awayTeam: 'Baloncesto Leganés Fem.',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-004',
    date: nextSunday,
    time: '10:00',
    venueId: 'venue-004',
    competitionId: 'comp-003',
    homeTeam: 'CB Leganés Junior',
    awayTeam: 'CB Fuenlabrada Junior',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-005',
    date: nextSunday,
    time: '12:00',
    venueId: 'venue-005',
    competitionId: 'comp-001',
    homeTeam: 'CB Móstoles',
    awayTeam: 'CB Madrid Centro',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-006',
    date: nextSaturday,
    time: '18:00',
    venueId: 'venue-001',
    competitionId: 'comp-002',
    homeTeam: 'Vallekas Basket Fem.',
    awayTeam: 'CB Alcorcón Femenino',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-007',
    date: nextSunday,
    time: '16:00',
    venueId: 'venue-003',
    competitionId: 'comp-003',
    homeTeam: 'Getafe Junior',
    awayTeam: 'CB Vallecas Junior',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-008',
    date: nextSaturday,
    time: '20:00',
    venueId: 'venue-005',
    competitionId: 'comp-001',
    homeTeam: 'Móstoles Basket',
    awayTeam: 'AD Fuenlabrada',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'designated' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-009',
    date: nextSunday,
    time: '18:00',
    venueId: 'venue-002',
    competitionId: 'comp-002',
    homeTeam: 'Alcorcón Femenino B',
    awayTeam: 'CB Madrid Fem.',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
  {
    id: 'match-010',
    date: nextSunday,
    time: '20:00',
    venueId: 'venue-004',
    competitionId: 'comp-001',
    homeTeam: 'CB Leganés',
    awayTeam: 'Baloncesto Torrejón',
    refereesNeeded: 2,
    scorersNeeded: 1,
    status: 'scheduled' as const,
    seasonId: 'season-001',
    matchday: 15,
    courtId: null,
  },
]

// ── Designaciones ───────────────────────────────────────────────────────────

type DesignationStatus = 'pending' | 'notified' | 'completed'

interface MockDesignation {
  id: string
  matchId: string
  personId: string
  role: 'arbitro' | 'anotador'
  travelCost: string
  distanceKm: string
  status: DesignationStatus
  notifiedAt: Date | null
  createdAt: Date
}

export const mockDesignations: MockDesignation[] = [
  // match-001: 2 arbitros + 1 anotador (full)
  {
    id: 'desig-001',
    matchId: 'match-001',
    personId: 'person-002', // Laura (nacional) - Madrid
    role: 'arbitro' as const,
    travelCost: '3.00',
    distanceKm: '0.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-002',
    matchId: 'match-001',
    personId: 'person-006', // Raul (autonomico) - Mostoles
    role: 'arbitro' as const,
    travelCost: '2.50',
    distanceKm: '25.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  {
    id: 'desig-003',
    matchId: 'match-001',
    personId: 'person-004', // Ana Belen (anotador) - Getafe
    role: 'anotador' as const,
    travelCost: '1.50',
    distanceKm: '15.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  // match-002: 1 arbitro only (partial)
  {
    id: 'desig-004',
    matchId: 'match-002',
    personId: 'person-001', // Carlos (autonomico) - Madrid
    role: 'arbitro' as const,
    travelCost: '1.30',
    distanceKm: '13.0',
    status: 'pending' as const,
    notifiedAt: null,
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  // match-003: 1 arbitro (partial)
  {
    id: 'desig-005',
    matchId: 'match-003',
    personId: 'person-007', // Patricia (nacional) - Fuenlabrada
    role: 'arbitro' as const,
    travelCost: '1.00',
    distanceKm: '10.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-06T08:00:00'),
    createdAt: new Date('2025-03-06T07:00:00'),
  },
  // match-006: 1 arbitro (partial)
  {
    id: 'desig-006',
    matchId: 'match-006',
    personId: 'person-001', // Carlos (autonomico) - Madrid
    role: 'arbitro' as const,
    travelCost: '3.00',
    distanceKm: '0.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-05T10:00:00'),
    createdAt: new Date('2025-03-05T09:00:00'),
  },
  // match-008: 1 anotador (partial)
  {
    id: 'desig-007',
    matchId: 'match-008',
    personId: 'person-005', // David (anotador) - Leganes
    role: 'anotador' as const,
    travelCost: '1.40',
    distanceKm: '14.0',
    status: 'notified' as const,
    notifiedAt: new Date('2025-03-06T10:00:00'),
    createdAt: new Date('2025-03-06T09:00:00'),
  },
]

// ── Disponibilidades de ejemplo ─────────────────────────────────────────────

function getCurrentWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return formatLocalDate(d)
}

function getNextWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 7
  d.setDate(diff)
  return formatLocalDate(d)
}

const weekStart = getCurrentWeekStart()
const nextWeek = getNextWeekStart()

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

export const mockAvailabilities = generateAvailabilities()

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getMockVenue(venueId: string) {
  return mockVenues.find((v) => v.id === venueId)
}

export function getMockCourt(courtId: string | null | undefined) {
  if (!courtId) return undefined
  return mockCourts.find((c) => c.id === courtId)
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

export function getMockDesignationsForMatch(matchId: string) {
  return mockDesignations
    .filter((d) => d.matchId === matchId)
    .map((d) => {
      const person = getMockPerson(d.personId)
      const municipality = person ? getMockMunicipality(person.municipalityId) : undefined
      const personWithAddress = person
        ? {
            id: person.id,
            name: person.name,
            role: person.role,
            category: person.category,
            municipalityId: person.municipalityId,
            hasCar: person.hasCar,
            address: person.address,
          }
        : undefined
      return { ...d, person: personWithAddress, municipality }
    })
}

export function getMockAvailabilitiesForPerson(personId: string, weekStart: string) {
  return mockAvailabilities.filter((a) => a.personId === personId && a.weekStart === weekStart)
}

export function getMockDistance(originId: string, destId: string): number {
  if (originId === destId) return 0
  const d = mockDistances.find(
    (d) =>
      (d.originId === originId && d.destId === destId) ||
      (d.originId === destId && d.destId === originId),
  )
  return d?.distanceKm ?? 35 // fallback for unknown pairs
}

export function calculateMockTravelCost(
  personMuniId: string,
  venueMuniId: string,
): { cost: number; km: number } {
  if (personMuniId === venueMuniId) {
    return { cost: 3.0, km: 0 }
  }
  const km = getMockDistance(personMuniId, venueMuniId)
  return { cost: Number((km * 0.1).toFixed(2)), km }
}

export function isPersonAvailable(personId: string, date: string, time: string): boolean {
  // Determine day of week from date (0=sunday, 1=monday... we need 5=saturday, 6=sunday)
  const d = new Date(date + 'T00:00:00')
  const jsDay = d.getDay() // 0=sun, 6=sat
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1 // convert to 0=mon, 5=sat, 6=sun

  // Get week start for the date (using local time, not UTC)
  const dateObj = new Date(date + 'T00:00:00')
  const dateDayOfWeek = dateObj.getDay()
  const diff = dateObj.getDate() - dateDayOfWeek + (dateDayOfWeek === 0 ? -6 : 1)
  dateObj.setDate(diff)
  const weekStartStr = formatLocalDate(dateObj)

  const avails = mockAvailabilities.filter(
    (a) => a.personId === personId && a.weekStart === weekStartStr && a.dayOfWeek === dayOfWeek,
  )

  // Check if the person has availability that covers the match time
  const matchHour = parseInt(time.split(':')[0])
  return avails.some((a) => {
    const availStart = parseInt(a.startTime.split(':')[0])
    const availEnd = parseInt(a.endTime.split(':')[0])
    return matchHour >= availStart && matchHour < availEnd
  })
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

// Jerarquia de categorias para validacion
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

export const mockAlertLog: MockAlert[] = []

// ── Snapshots iniciales para reset ────────────────────────────────────────

const INITIAL_MATCHES = [...mockMatches]
const INITIAL_PERSONS = [...mockPersons]
const INITIAL_DESIGNATIONS: MockDesignation[] = [...mockDesignations]
const INITIAL_AVAILABILITIES = [...mockAvailabilities]
const INITIAL_INCOMPATIBILITIES = [...mockIncompatibilities]
const INITIAL_COURTS = [...mockCourts]

export function resetMockData() {
  mockMatches.length = 0
  mockMatches.push(...INITIAL_MATCHES)
  mockPersons.length = 0
  mockPersons.push(...INITIAL_PERSONS)
  mockDesignations.length = 0
  mockDesignations.push(...INITIAL_DESIGNATIONS)
  mockAvailabilities.length = 0
  mockAvailabilities.push(...INITIAL_AVAILABILITIES)
  mockIncompatibilities.length = 0
  mockIncompatibilities.push(...INITIAL_INCOMPATIBILITIES)
  mockCourts.length = 0
  mockCourts.push(...INITIAL_COURTS)
  mockAlertLog.length = 0
}

// ── Exports para generación demo ──────────────────────────────────────────

export { nextSaturday, nextSunday, weekStart, nextWeek, formatLocalDate }

// Usuario demo por defecto (Carlos Martínez)
export const DEMO_PERSON_ID = 'person-001'
