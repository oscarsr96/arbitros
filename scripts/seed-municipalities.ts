/**
 * seed-municipalities.ts
 *
 * Inserts all municipalities of Comunidad de Madrid (datos INE).
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING via Drizzle's
 * `onConflictDoNothing()`.
 *
 * Run from repo root:
 *   pnpm db:seed:municipalities
 */

import { db } from '../apps/web/src/lib/db'
import { municipalities } from '../apps/web/src/lib/db/schema'

// Complete list of municipalities in Comunidad de Madrid (INE).
// Deduplicated and sorted alphabetically.
const MUNICIPALITIES: string[] = [
  'Ajalvir',
  'Alameda del Valle',
  'El Álamo',
  'Alcalá de Henares',
  'Alcobendas',
  'Alcorcón',
  'Aldea del Fresno',
  'Algete',
  'Alpedrete',
  'Ambite',
  'Anchuelo',
  'Aranjuez',
  'Arganda del Rey',
  'Arroyomolinos',
  'Atazar (El)',
  'Batres',
  'Becerril de la Sierra',
  'Belmonte de Tajo',
  'Berrueco (El)',
  'Berzosa del Lozoya',
  'Boadilla del Monte',
  'Boalo (El)',
  'Braojos',
  'Brea de Tajo',
  'Brunete',
  'Bustarviejo',
  'Cabanillas de la Sierra',
  'Cadalso de los Vidrios',
  'Camarma de Esteruelas',
  'Campo Real',
  'Canencia',
  'Carabaña',
  'Casarrubuelos',
  'Cenicientos',
  'Cercedilla',
  'Chapinería',
  'Chinchón',
  'Ciempozuelos',
  'Cobeña',
  'Collado Mediano',
  'Collado Villalba',
  'Colmenar de Oreja',
  'Colmenar Viejo',
  'Colmenarejo',
  'Corpa',
  'Coslada',
  'Cubas de la Sagra',
  'Daganzo de Arriba',
  'Escorial (El)',
  'Estremera',
  'Fresnedillas de la Oliva',
  'Fresno de Torote',
  'Fuenlabrada',
  'Fuente el Saz de Jarama',
  'Fuentidueña de Tajo',
  'Galapagar',
  'Garganta de los Montes',
  'Gargantilla del Lozoya y Pinilla de Buitrago',
  'Gascones',
  'Getafe',
  'Griñón',
  'Guadalix de la Sierra',
  'Guadarrama',
  'Hiruela (La)',
  'Horcajo de la Sierra-Aoslos',
  'Horcajuelo de la Sierra',
  'Hoyo de Manzanares',
  'Humanes de Madrid',
  'Leganés',
  'Loeches',
  'Lozoya',
  'Lozoyuela-Navas-Sieteiglesias',
  'Madarcos',
  'Madrid',
  'Majadahonda',
  'Manzanares el Real',
  'Meco',
  'Mejorada del Campo',
  'Méntrida',
  'Miraflores de la Sierra',
  'Molar (El)',
  'Molinos (Los)',
  'Montejo de la Sierra',
  'Moraleja de Enmedio',
  'Moralzarzal',
  'Morata de Tajuña',
  'Móstoles',
  'Municipio de Madrid',
  'Navalafuente',
  'Navalagamella',
  'Navalcarnero',
  'Navarredonda y San Mamés',
  'Navas del Rey',
  'Navacerrada',
  'Nuevo Baztán',
  'Olmeda de las Fuentes',
  'Orusco de Tajuña',
  'Paracuellos de Jarama',
  'Parla',
  'Patones',
  'Pedrezuela',
  'Pelayos de la Presa',
  'Perales de Tajuña',
  'Pezuela de las Torres',
  'Pinilla del Valle',
  'Pinto',
  'Piñuécar-Gandullas',
  'Pozuelo de Alarcón',
  'Pozuelo del Rey',
  'Prádena del Rincón',
  'Puebla de la Sierra',
  'Puentes Viejas',
  'Quijorna',
  'Rascafría',
  'Redueña',
  'Ribatejada',
  'Rivas-Vaciamadrid',
  'Robledo de Chavela',
  'Robregordo',
  'Rozas de Madrid (Las)',
  'Rozas de Puerto Real',
  'San Agustín del Guadalix',
  'San Fernando de Henares',
  'San Lorenzo de El Escorial',
  'San Martín de la Vega',
  'San Martín de Valdeiglesias',
  'San Sebastián de los Reyes',
  'Santa María de la Alameda',
  'Santorcaz',
  'Santos de la Humosa (Los)',
  'Serranillos del Valle',
  'Sevilla la Nueva',
  'Somosierra',
  'Soto del Real',
  'Talamanca de Jarama',
  'Tielmes',
  'Titulcia',
  'Torrejón de Ardoz',
  'Torrejón de la Calzada',
  'Torrejón de Velasco',
  'Torrelodones',
  'Torres de la Alameda',
  'Tres Cantos',
  'Valdeavero',
  'Valdelaguna',
  'Valdemanco',
  'Valdemorillo',
  'Valdemoro',
  'Valdetorres de Jarama',
  'Valdilecha',
  'Vallarejo de Salvanés',
  'Velilla de San Antonio',
  'Vellón (El)',
  'Venturada',
  'Villa del Prado',
  'Villaconejos',
  'Villamanrique de Tajo',
  'Villanueva de la Cañada',
  'Villanueva de Perales',
  'Villanueva del Pardillo',
  'Villar del Olmo',
  'Villarejo de Salvanés',
  'Villaviciosa de Odón',
  'Villamanta',
  'Villamantilla',
  'Zarzalejo',
]

// Deduplicate in case any entry was accidentally doubled
function deduplicate(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
}

async function main(): Promise<void> {
  const uniqueNames = deduplicate(MUNICIPALITIES)

  console.log(`Seeding ${uniqueNames.length} municipalities...`)

  const rows = uniqueNames.map((name) => ({
    name,
    province: 'Madrid' as const,
  }))

  // Insert in chunks of 100 to stay within query limits
  const CHUNK_SIZE = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    await db.insert(municipalities).values(chunk).onConflictDoNothing()

    inserted += chunk.length
    console.log(`  Processed ${inserted}/${rows.length} municipalities`)
  }

  console.log('Done seeding municipalities.')
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Error seeding municipalities:', err)
    process.exit(1)
  })
