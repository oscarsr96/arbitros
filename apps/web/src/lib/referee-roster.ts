// ── Generador determinista del roster de árbitros (datos mock) ──────────────
//
// Genera los 770 árbitros de la petición del usuario con la distribución de
// `REFEREE_LEVEL_DISTRIBUTION`. Cada árbitro lleva un NICK ("nombre de guerra")
// ÚNICO, el nivel fino `refereeLevel` y la `category` legacy mapeada (para que
// el solver y la UI actuales no cambien).
//
// Nicks: cada uno es único por sí mismo, SIN sufijos numéricos ni romanos
// (nada de "ALTOS II"). Se construye un pool grande y determinista mezclando
// motes de una palabra (barrios/pueblos/parajes de Madrid + apodos) y, para
// tener holgura de sobra, compuestos naturales "APODO DE LUGAR" (p. ej. "EL
// FLACO DE VALLECAS"). Se baraja con el PRNG y se asignan los primeros 770.
//
// DETERMINISTA a propósito: usa un PRNG con semilla fija (mulberry32), sin
// `Math.random()` ni `Date.now()`. Así el server y el cliente producen el mismo
// roster (mock-data se importa desde componentes cliente) y no hay mismatch de
// hidratación en Next.

import {
  REFEREE_LEVELS,
  REFEREE_LEVEL_DISTRIBUTION,
  LEGACY_CATEGORY_BY_LEVEL,
  type RefereeLevel,
} from './referee-eligibility'

export type MockPerson = {
  id: string
  name: string
  email: string
  phone: string
  role: 'arbitro' | 'anotador'
  // Árbitros: provincial|autonomico|nacional|feb. Anotadores: escuela|autonomico|nacional.
  category: 'provincial' | 'autonomico' | 'nacional' | 'feb' | 'escuela'
  address: string
  postalCode: string
  municipalityId: string
  bankIban: string
  active: boolean
  hasCar: boolean
  authUserId: string | null
  createdAt: Date
  nick?: string
  refereeLevel?: RefereeLevel
}

// PRNG determinista (mulberry32).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

const NOMBRES = [
  'Alejandro',
  'Javier',
  'Daniel',
  'Carlos',
  'David',
  'Adrián',
  'Pablo',
  'Sergio',
  'Marcos',
  'Rubén',
  'Álvaro',
  'Iván',
  'Diego',
  'Jorge',
  'Raúl',
  'Miguel',
  'Ángel',
  'Fernando',
  'Óscar',
  'Guillermo',
  'Hugo',
  'Mario',
  'Víctor',
  'Antonio',
  'Andrés',
  'Laura',
  'Marta',
  'Sara',
  'Ana',
  'Cristina',
  'Lucía',
  'Paula',
  'Elena',
  'Nerea',
  'Beatriz',
  'Patricia',
  'Alba',
  'Carmen',
  'Irene',
  'Natalia',
  'Sofía',
  'Claudia',
  'Rocío',
  'Silvia',
  'Andrea',
  'Noelia',
  'Julia',
  'Marina',
  'Lorena',
  'Verónica',
]

const APELLIDOS = [
  'García',
  'Martínez',
  'López',
  'Sánchez',
  'González',
  'Rodríguez',
  'Fernández',
  'Pérez',
  'Gómez',
  'Ruiz',
  'Díaz',
  'Moreno',
  'Muñoz',
  'Álvarez',
  'Romero',
  'Alonso',
  'Gutiérrez',
  'Navarro',
  'Torres',
  'Domínguez',
  'Vázquez',
  'Ramos',
  'Gil',
  'Serrano',
  'Blanco',
  'Molina',
  'Morales',
  'Suárez',
  'Ortega',
  'Delgado',
  'Castro',
  'Ortiz',
  'Rubio',
  'Marín',
  'Sanz',
  'Núñez',
  'Iglesias',
  'Medina',
  'Garrido',
  'Cortés',
  'Castillo',
  'Santos',
  'Lozano',
  'Guerrero',
  'Cano',
  'Prieto',
  'Méndez',
  'Cruz',
  'Herrera',
  'Peña',
  'Flores',
  'Cabrera',
  'Campos',
  'Vega',
  'Fuentes',
  'Carmona',
]

const CALLES = [
  'Calle Mayor',
  'Calle de Alcalá',
  'Gran Vía',
  'Paseo de la Castellana',
  'Calle Bravo Murillo',
  'Calle de Atocha',
  'Calle de Toledo',
  'Avenida de América',
  'Calle de Fuencarral',
  'Calle de Serrano',
  'Paseo del Prado',
  'Calle de Goya',
  'Avenida de la Albufera',
  'Calle del Doctor Esquerdo',
  'Calle de Arturo Soria',
  'Avenida de los Poblados',
  'Calle de Embajadores',
  'Calle de Preciados',
  'Ronda de Valencia',
  'Calle de Segovia',
]

// Motes de una palabra (barrios, pueblos y parajes de Madrid). El usuario:
// "ALTOS" (por su calle Altos de Cabrejas) y "CABREJAS". Sin partícula "de"
// interna para que compongan bien con los apodos.
const LUGARES = [
  'ALTOS',
  'CABREJAS',
  'MALASAÑA',
  'VALLECAS',
  'CARABANCHEL',
  'LAVAPIÉS',
  'CHUECA',
  'LATINA',
  'USERA',
  'MORATALAZ',
  'CANILLEJAS',
  'HORTALEZA',
  'BARAJAS',
  'CHAMBERÍ',
  'RETIRO',
  'SALAMANCA',
  'ARGANZUELA',
  'TETUÁN',
  'ALUCHE',
  'VICÁLVARO',
  'VILLAVERDE',
  'PACÍFICO',
  'DELICIAS',
  'EMBAJADORES',
  'ATOCHA',
  'GOYA',
  'SOL',
  'CIBELES',
  'COLÓN',
  'BERNABÉU',
  'CALDERÓN',
  'MAGARIÑOS',
  'GETAFE',
  'ALCORCÓN',
  'MÓSTOLES',
  'LEGANÉS',
  'FUENLABRADA',
  'PARLA',
  'PINTO',
  'VALDEMORO',
  'ARANJUEZ',
  'COSLADA',
  'TORREJÓN',
  'RIVAS',
  'ARGANDA',
  'POZUELO',
  'MAJADAHONDA',
  'BOADILLA',
  'ALCOBENDAS',
  'GALAPAGAR',
  'TORRELODONES',
  'VILLALBA',
  'GUADARRAMA',
  'CERCEDILLA',
  'NAVACERRADA',
  'MANZANARES',
  'CHINCHÓN',
  'PATONES',
  'RASCAFRÍA',
  'ROBLEDO',
  'BUITRAGO',
  'TORRELAGUNA',
  'COLMENAR',
  'NAVALCARNERO',
  'HUMANES',
  'CIEMPOZUELOS',
  'ALGETE',
  'DAGANZO',
  'PARACUELLOS',
  'MECO',
  'LOECHES',
  'MORATA',
  'PERALES',
  'ESTREMERA',
  'VILLAREJO',
  'BELMONTE',
  'TIELMES',
  'CARABAÑA',
  'ORUSCO',
  'AMBITE',
  'PEZUELA',
  'SANTORCAZ',
  'ANCHUELO',
  'CORPA',
  'PIOZ',
  'PEDREZUELA',
  'GUADALIX',
  'MIRAFLORES',
  'BUSTARVIEJO',
  'VALDEMANCO',
  'GARGANTA',
  'CANENCIA',
  'LOZOYA',
  'PINILLA',
  'GASCONES',
  'BRAOJOS',
  'HORCAJO',
  'MADARCOS',
  'PRÁDENA',
  'ROBREGORDO',
  'SOMOSIERRA',
  'MONTEJO',
  'BERZOSA',
  'CERVERA',
  'REDUEÑA',
  'VENTURADA',
  'CABANILLAS',
  'TALAMANCA',
  'VALDEPIÉLAGOS',
  'RIBATEJADA',
  'FRESNO',
  'SERRANILLOS',
  'BATRES',
  'CUBAS',
  'CASARRUBUELOS',
  'MORALEJA',
  'ARROYOMOLINOS',
  'GRIÑÓN',
  'PARDO',
  'PEÑALARA',
  'JARAMA',
  'MADROÑO',
  'ALAMEDA',
  'ENCINA',
  'PRADERA',
  'BERRUECO',
  'MOLAR',
  'TALAMANCÓN',
  'VELILLA',
  'MEJORADA',
]

// Apodos de una palabra (o con artículo). Componen con los lugares: "EL FLACO
// DE VALLECAS", "TARZÁN DE GETAFE"...
const APODOS = [
  'EL FLACO',
  'EL RUBIO',
  'EL LARGO',
  'EL CHATO',
  'EL ZURDO',
  'EL GRECO',
  'EL CID',
  'TARZÁN',
  'MAGIC',
  'PISTOLERO',
  'FRANCOTIRADOR',
  'CANASTERO',
  'REBOTE',
  'TAPÓN',
  'SILBATO',
  'BOCINA',
  'RELÁMPAGO',
  'TRUENO',
  'HURACÁN',
  'CICLÓN',
  'RAYO',
  'CÓNDOR',
  'HALCÓN',
  'ÁGUILA',
  'LINCE',
  'PUMA',
  'LOBO',
  'ZORRO',
  'TORO',
  'BISONTE',
  'PANTERA',
  'GACELA',
  'GUEPARDO',
  'MAMBA',
  'COBRA',
  'TIGRE',
  'CANELA',
  'PIMIENTA',
  'AZAFRÁN',
  'PEREJIL',
  'LAUREL',
  'TOMILLO',
  'ORÉGANO',
  'HINOJO',
  'CASTIZO',
  'CHULAPO',
  'GATO',
  'OSO',
  'ROSCÓN',
  'CHOTIS',
  'VERBENA',
  'FAROLA',
  'ISIDRO',
  'PALOMA',
  'MELÓN',
  'GARBANZO',
  'ANÍS',
  'ROMERO',
  'CHAPU',
  'MOTA',
  'DÍMAS',
  'MOSQUITO',
  'CHICHARRO',
  'PROFE',
  'SHERIFF',
  'MÍSTER',
  'GENERAL',
  'CAPITÁN',
  'MAESTRO',
  'DOCTOR',
]

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '')
}

// Pool de nicks únicos, barajado de forma determinista. Primero los motes de
// una palabra, luego los compuestos "APODO DE LUGAR" (holgura de miles).
function buildNickPool(rand: () => number): string[] {
  const singles = shuffle([...LUGARES, ...APODOS], rand)
  const compounds: string[] = []
  for (const apodo of APODOS) {
    for (const lugar of LUGARES) compounds.push(`${apodo} DE ${lugar}`)
  }
  const ordered = [...singles, ...shuffle(compounds, rand)]
  const seen = new Set<string>()
  const pool: string[] = []
  for (const nick of ordered) {
    if (!seen.has(nick)) {
      seen.add(nick)
      pool.push(nick)
    }
  }
  return pool
}

/**
 * Genera el roster de 770 árbitros. `municipalities` debe traer id y nombre
 * (se pasa por parámetro para evitar un ciclo de imports con mock-data).
 */
export function generateReferees(municipalities: { id: string; name: string }[]): MockPerson[] {
  const rand = mulberry32(0x5eed_a17b) // semilla fija → roster reproducible
  const madrid = municipalities.find((m) => m.name === 'Madrid') ?? municipalities[0]
  const others = municipalities.filter((m) => m.id !== madrid.id)
  const nickPool = buildNickPool(rand)

  const people: MockPerson[] = []
  let n = 0

  for (const level of REFEREE_LEVELS) {
    const count = REFEREE_LEVEL_DISTRIBUTION[level]
    for (let i = 0; i < count; i++) {
      const seq = String(n + 1).padStart(4, '0')
      const nombre = NOMBRES[Math.floor(rand() * NOMBRES.length)]
      const ap1 = APELLIDOS[Math.floor(rand() * APELLIDOS.length)]
      const ap2 = APELLIDOS[Math.floor(rand() * APELLIDOS.length)]
      const name = `${nombre} ${ap1} ${ap2}`

      // Sesgo a Madrid capital (~45%); resto reparte por los demás municipios.
      const muni = rand() < 0.45 ? madrid : others[Math.floor(rand() * others.length)]

      const calle = CALLES[Math.floor(rand() * CALLES.length)]
      const num = 1 + Math.floor(rand() * 120)
      const cp = `28${String(1 + Math.floor(rand() * 999)).padStart(3, '0')}`
      const phone = `6${String(10_000_000 + Math.floor(rand() * 89_999_999))}`
      const ibanBody = Array.from({ length: 22 }, () => Math.floor(rand() * 10)).join('')

      people.push({
        id: `person-a${seq}`,
        name,
        email: `${slug(nombre)}.${slug(ap1)}${seq}@fbm-arbitros.example`,
        phone,
        role: 'arbitro',
        category: LEGACY_CATEGORY_BY_LEVEL[level],
        address: `${calle} ${num}, ${cp} ${muni.name}`,
        postalCode: cp,
        municipalityId: muni.id,
        bankIban: `ES${ibanBody}`,
        active: true,
        hasCar: rand() < 0.85, // la mayoría con coche (regla del solver)
        authUserId: null,
        createdAt: new Date('2025-09-01'),
        nick: nickPool[n],
        refereeLevel: level,
      })
      n++
    }
  }

  return people
}

// ── Roster de anotadores (oficiales de mesa) ────────────────────────────────
//
// Los anotadores tienen su propia escala de categorías: escuela < autonómica <
// nacional (independiente de la de árbitros). Distribución piramidal (500, ≥ el
// mínimo pedido por el usuario). Los nicks salen del MISMO pool que los árbitros
// pero desplazados por REFEREE_TOTAL, así ningún anotador comparte nick con un
// árbitro y todo el roster queda con nick único.

type ScorerCategory = 'escuela' | 'autonomico' | 'nacional'

const SCORER_CATEGORY_DISTRIBUTION: { category: ScorerCategory; count: number }[] = [
  { category: 'nacional', count: 90 },
  { category: 'autonomico', count: 160 },
  { category: 'escuela', count: 250 },
] // total = 500

const REFEREE_TOTAL = Object.values(REFEREE_LEVEL_DISTRIBUTION).reduce((a, b) => a + b, 0)

/**
 * Genera el roster de anotadores. Mismo estilo determinista que
 * `generateReferees`; nicks únicos respecto a los árbitros (offset del pool).
 */
export function generateScorers(municipalities: { id: string; name: string }[]): MockPerson[] {
  // Pool con la MISMA semilla que los árbitros → idéntico orden; el offset
  // REFEREE_TOTAL garantiza que ningún anotador comparte nick con un árbitro.
  const nickPool = buildNickPool(mulberry32(0x5eed_a17b))
  const rand = mulberry32(0x5c04_e5b1) // semilla propia → atributos variados

  const madrid = municipalities.find((m) => m.name === 'Madrid') ?? municipalities[0]
  const others = municipalities.filter((m) => m.id !== madrid.id)

  const people: MockPerson[] = []
  let n = 0

  for (const { category, count } of SCORER_CATEGORY_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      const seq = String(n + 1).padStart(4, '0')
      const nombre = NOMBRES[Math.floor(rand() * NOMBRES.length)]
      const ap1 = APELLIDOS[Math.floor(rand() * APELLIDOS.length)]
      const ap2 = APELLIDOS[Math.floor(rand() * APELLIDOS.length)]
      const name = `${nombre} ${ap1} ${ap2}`

      const muni = rand() < 0.45 ? madrid : others[Math.floor(rand() * others.length)]
      const calle = CALLES[Math.floor(rand() * CALLES.length)]
      const num = 1 + Math.floor(rand() * 120)
      const cp = `28${String(1 + Math.floor(rand() * 999)).padStart(3, '0')}`
      const phone = `6${String(10_000_000 + Math.floor(rand() * 89_999_999))}`
      const ibanBody = Array.from({ length: 22 }, () => Math.floor(rand() * 10)).join('')

      people.push({
        id: `person-s${seq}`,
        name,
        email: `${slug(nombre)}.${slug(ap1)}${seq}@fbm-anotadores.example`,
        phone,
        role: 'anotador',
        category,
        address: `${calle} ${num}, ${cp} ${muni.name}`,
        postalCode: cp,
        municipalityId: muni.id,
        bankIban: `ES${ibanBody}`,
        active: true,
        hasCar: rand() < 0.85,
        authUserId: null,
        createdAt: new Date('2025-09-01'),
        nick: nickPool[REFEREE_TOTAL + n],
      })
      n++
    }
  }

  return people
}
