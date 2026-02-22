/**
 * seed-demo-data.ts
 *
 * Creates a full set of demo data for development and QA:
 *   - 1 active season (2024-25)
 *   - 6 competitions (Preferente M/F, 1a División M/F, Junior M/F)
 *   - 8 venues distributed across Madrid municipalities
 *   - 15 persons: 10 referees (mixed categories) + 5 scorers
 *   - 20 matches in March 2025 (matchdays 1 and 2)
 *
 * Safe to run multiple times — idempotent by checking existence before
 * inserting each top-level entity, and using unique constraints on email.
 *
 * Run from repo root:
 *   pnpm db:seed
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '../apps/web/src/lib/db'
import {
  competitions,
  matches,
  municipalities,
  persons,
  seasons,
  venues,
} from '../apps/web/src/lib/db/schema'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Pick a random element from an array (never undefined for non-empty arrays). */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Pad a number to 2 digits. */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MunicipalityRow = { id: string; name: string }

// ── Municipality lookup helpers ───────────────────────────────────────────────

async function getMunicipalitiesByName(names: string[]): Promise<Map<string, string>> {
  const all = await db
    .select({ id: municipalities.id, name: municipalities.name })
    .from(municipalities)
    .where(
      sql`${municipalities.name} = ANY(${sql.raw(
        `ARRAY[${names.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ')}]`,
      )})`,
    )

  const map = new Map<string, string>()
  for (const row of all) {
    map.set(row.name, row.id)
  }
  return map
}

async function getAllMunicipalities(): Promise<MunicipalityRow[]> {
  return db.select({ id: municipalities.id, name: municipalities.name }).from(municipalities)
}

// ── 1. Season ─────────────────────────────────────────────────────────────────

async function seedSeason(): Promise<string> {
  console.log('\n[1/5] Season...')

  const existing = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.name, '2024-25'))
    .limit(1)

  if (existing.length > 0) {
    console.log('  Season "2024-25" already exists, skipping.')
    return existing[0].id
  }

  const [row] = await db
    .insert(seasons)
    .values({
      name: '2024-25',
      startDate: '2024-09-01',
      endDate: '2025-06-30',
      active: true,
    })
    .returning({ id: seasons.id })

  console.log(`  Created season "2024-25" (id: ${row.id})`)
  return row.id
}

// ── 2. Competitions ───────────────────────────────────────────────────────────

type CompetitionSeed = {
  name: string
  category: string
  gender: 'male' | 'female' | 'mixed'
  refereesNeeded: number
  scorersNeeded: number
  minRefCategory: 'provincial' | 'autonomico' | 'nacional' | 'feb' | null
}

const COMPETITION_SEEDS: CompetitionSeed[] = [
  {
    name: 'Liga Preferente Masculina',
    category: 'preferente',
    gender: 'male',
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'autonomico',
  },
  {
    name: 'Liga Preferente Femenina',
    category: 'preferente',
    gender: 'female',
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'autonomico',
  },
  {
    name: '1a División Masculina',
    category: 'primera',
    gender: 'male',
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial',
  },
  {
    name: '1a División Femenina',
    category: 'primera',
    gender: 'female',
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial',
  },
  {
    name: 'Junior Masculino',
    category: 'junior',
    gender: 'male',
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial',
  },
  {
    name: 'Junior Femenino',
    category: 'junior',
    gender: 'female',
    refereesNeeded: 2,
    scorersNeeded: 1,
    minRefCategory: 'provincial',
  },
]

async function seedCompetitions(seasonId: string): Promise<string[]> {
  console.log('\n[2/5] Competitions...')
  const ids: string[] = []

  for (const seed of COMPETITION_SEEDS) {
    const existing = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(sql`${competitions.name} = ${seed.name} AND ${competitions.seasonId} = ${seasonId}`)
      .limit(1)

    if (existing.length > 0) {
      console.log(`  Competition "${seed.name}" already exists, skipping.`)
      ids.push(existing[0].id)
      continue
    }

    const [row] = await db
      .insert(competitions)
      .values({
        name: seed.name,
        category: seed.category,
        gender: seed.gender,
        refereesNeeded: seed.refereesNeeded,
        scorersNeeded: seed.scorersNeeded,
        minRefCategory: seed.minRefCategory,
        seasonId,
      })
      .returning({ id: competitions.id })

    console.log(`  Created competition "${seed.name}" (id: ${row.id})`)
    ids.push(row.id)
  }

  return ids
}

// ── 3. Venues ─────────────────────────────────────────────────────────────────

type VenueSeed = {
  name: string
  municipalityName: string
  address: string
  postalCode: string
}

const VENUE_SEEDS: VenueSeed[] = [
  {
    name: 'Polideportivo Municipal de Alcobendas',
    municipalityName: 'Alcobendas',
    address: 'Av. de la Constitución, 3',
    postalCode: '28100',
  },
  {
    name: 'Polideportivo Municipal de Alcorcón',
    municipalityName: 'Alcorcón',
    address: 'Calle Leganés, 15',
    postalCode: '28922',
  },
  {
    name: 'Pabellón Municipal de Getafe',
    municipalityName: 'Getafe',
    address: 'Calle Juan de la Cierva, 2',
    postalCode: '28901',
  },
  {
    name: 'Polideportivo Río Henares (Alcalá de Henares)',
    municipalityName: 'Alcalá de Henares',
    address: 'Calle Río Henares, 20',
    postalCode: '28801',
  },
  {
    name: 'Pabellón Municipal de Torrejón de Ardoz',
    municipalityName: 'Torrejón de Ardoz',
    address: 'Av. de la Constitución, 54',
    postalCode: '28850',
  },
  {
    name: 'Polideportivo Municipal de Leganés',
    municipalityName: 'Leganés',
    address: 'Calle Emilio Muñoz, 10',
    postalCode: '28911',
  },
  {
    name: 'Pabellón Las Rozas',
    municipalityName: 'Rozas de Madrid (Las)',
    address: 'Av. Lazarejo, 8',
    postalCode: '28230',
  },
  {
    name: 'Polideportivo Municipal de Móstoles',
    municipalityName: 'Móstoles',
    address: 'Calle Puerto de Navacerrada, 5',
    postalCode: '28931',
  },
]

async function seedVenues(municipalityMap: Map<string, string>): Promise<string[]> {
  console.log('\n[3/5] Venues...')
  const ids: string[] = []

  for (const seed of VENUE_SEEDS) {
    const municipalityId = municipalityMap.get(seed.municipalityName)

    if (!municipalityId) {
      console.warn(
        `  WARNING: Municipality "${seed.municipalityName}" not found. Skipping venue "${seed.name}".`,
      )
      continue
    }

    const existing = await db
      .select({ id: venues.id })
      .from(venues)
      .where(eq(venues.name, seed.name))
      .limit(1)

    if (existing.length > 0) {
      console.log(`  Venue "${seed.name}" already exists, skipping.`)
      ids.push(existing[0].id)
      continue
    }

    const [row] = await db
      .insert(venues)
      .values({
        name: seed.name,
        address: seed.address,
        municipalityId,
        postalCode: seed.postalCode,
      })
      .returning({ id: venues.id })

    console.log(`  Created venue "${seed.name}" (id: ${row.id})`)
    ids.push(row.id)
  }

  return ids
}

// ── 4. Persons ────────────────────────────────────────────────────────────────

type PersonSeed = {
  name: string
  email: string
  phone: string
  role: 'arbitro' | 'anotador'
  category: 'provincial' | 'autonomico' | 'nacional' | 'feb' | null
  municipalityName: string
  postalCode: string
}

const PERSON_SEEDS: PersonSeed[] = [
  // Referees (10)
  {
    name: 'Carlos Rodríguez Martín',
    email: 'carlos.rodriguez@fbm-demo.es',
    phone: '600111001',
    role: 'arbitro',
    category: 'nacional',
    municipalityName: 'Madrid',
    postalCode: '28001',
  },
  {
    name: 'Ana García López',
    email: 'ana.garcia@fbm-demo.es',
    phone: '600111002',
    role: 'arbitro',
    category: 'nacional',
    municipalityName: 'Alcobendas',
    postalCode: '28100',
  },
  {
    name: 'David Sánchez Pérez',
    email: 'david.sanchez@fbm-demo.es',
    phone: '600111003',
    role: 'arbitro',
    category: 'autonomico',
    municipalityName: 'Getafe',
    postalCode: '28901',
  },
  {
    name: 'María Fernández Torres',
    email: 'maria.fernandez@fbm-demo.es',
    phone: '600111004',
    role: 'arbitro',
    category: 'autonomico',
    municipalityName: 'Leganés',
    postalCode: '28911',
  },
  {
    name: 'Javier Moreno Ruiz',
    email: 'javier.moreno@fbm-demo.es',
    phone: '600111005',
    role: 'arbitro',
    category: 'autonomico',
    municipalityName: 'Alcorcón',
    postalCode: '28922',
  },
  {
    name: 'Laura Jiménez Castro',
    email: 'laura.jimenez@fbm-demo.es',
    phone: '600111006',
    role: 'arbitro',
    category: 'provincial',
    municipalityName: 'Alcalá de Henares',
    postalCode: '28801',
  },
  {
    name: 'Pedro González Alonso',
    email: 'pedro.gonzalez@fbm-demo.es',
    phone: '600111007',
    role: 'arbitro',
    category: 'provincial',
    municipalityName: 'Torrejón de Ardoz',
    postalCode: '28850',
  },
  {
    name: 'Sofía Díaz Hernández',
    email: 'sofia.diaz@fbm-demo.es',
    phone: '600111008',
    role: 'arbitro',
    category: 'provincial',
    municipalityName: 'Móstoles',
    postalCode: '28931',
  },
  {
    name: 'Alejandro Muñoz Vega',
    email: 'alejandro.munoz@fbm-demo.es',
    phone: '600111009',
    role: 'arbitro',
    category: 'provincial',
    municipalityName: 'Parla',
    postalCode: '28980',
  },
  {
    name: 'Elena Romero Ortega',
    email: 'elena.romero@fbm-demo.es',
    phone: '600111010',
    role: 'arbitro',
    category: 'provincial',
    municipalityName: 'Coslada',
    postalCode: '28820',
  },
  // Scorers / anotadores (5)
  {
    name: 'Miguel Ángel Blanco Serrano',
    email: 'miguel.blanco@fbm-demo.es',
    phone: '600222001',
    role: 'anotador',
    category: null,
    municipalityName: 'Madrid',
    postalCode: '28020',
  },
  {
    name: 'Isabel Vázquez Molina',
    email: 'isabel.vazquez@fbm-demo.es',
    phone: '600222002',
    role: 'anotador',
    category: null,
    municipalityName: 'Alcobendas',
    postalCode: '28100',
  },
  {
    name: 'Francisco Navarro Gil',
    email: 'francisco.navarro@fbm-demo.es',
    phone: '600222003',
    role: 'anotador',
    category: null,
    municipalityName: 'Getafe',
    postalCode: '28901',
  },
  {
    name: 'Cristina Ramos Fuentes',
    email: 'cristina.ramos@fbm-demo.es',
    phone: '600222004',
    role: 'anotador',
    category: null,
    municipalityName: 'Leganés',
    postalCode: '28911',
  },
  {
    name: 'Roberto Medina Prieto',
    email: 'roberto.medina@fbm-demo.es',
    phone: '600222005',
    role: 'anotador',
    category: null,
    municipalityName: 'Fuenlabrada',
    postalCode: '28943',
  },
]

async function seedPersons(municipalityMap: Map<string, string>): Promise<string[]> {
  console.log('\n[4/5] Persons...')
  const ids: string[] = []

  for (const seed of PERSON_SEEDS) {
    const municipalityId = municipalityMap.get(seed.municipalityName)

    if (!municipalityId) {
      console.warn(
        `  WARNING: Municipality "${seed.municipalityName}" not found. Skipping person "${seed.name}".`,
      )
      continue
    }

    // Check by unique email to stay idempotent
    const existing = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.email, seed.email))
      .limit(1)

    if (existing.length > 0) {
      console.log(`  Person "${seed.name}" already exists, skipping.`)
      ids.push(existing[0].id)
      continue
    }

    const [row] = await db
      .insert(persons)
      .values({
        name: seed.name,
        email: seed.email,
        phone: seed.phone,
        role: seed.role,
        category: seed.category,
        municipalityId,
        postalCode: seed.postalCode,
        active: true,
      })
      .returning({ id: persons.id })

    const roleLabel = seed.role === 'arbitro' ? 'referee' : 'scorer'
    console.log(`  Created ${roleLabel} "${seed.name}" (id: ${row.id})`)
    ids.push(row.id)
  }

  return ids
}

// ── 5. Matches ────────────────────────────────────────────────────────────────

type MatchTemplate = {
  homeTeam: string
  awayTeam: string
  competitionIndex: number // index into competitionIds array
  venueIndex: number // index into venueIds array
  dayOfMonth: number // March 2025
  hour: number
  minute: number
  matchday: number
}

const MATCH_TEMPLATES: MatchTemplate[] = [
  // Matchday 1 — first Saturday (01 Mar 2025)
  {
    homeTeam: 'CB Alcobendas',
    awayTeam: 'CB Alcorcón',
    competitionIndex: 0,
    venueIndex: 0,
    dayOfMonth: 1,
    hour: 10,
    minute: 0,
    matchday: 1,
  },
  {
    homeTeam: 'CB Getafe Azul',
    awayTeam: 'CB Leganés Norte',
    competitionIndex: 0,
    venueIndex: 2,
    dayOfMonth: 1,
    hour: 12,
    minute: 0,
    matchday: 1,
  },
  {
    homeTeam: 'CB Alcalá',
    awayTeam: 'CB Torrejón Baloncesto',
    competitionIndex: 1,
    venueIndex: 3,
    dayOfMonth: 1,
    hour: 10,
    minute: 30,
    matchday: 1,
  },
  {
    homeTeam: 'CB Móstoles',
    awayTeam: 'CB Las Rozas',
    competitionIndex: 1,
    venueIndex: 7,
    dayOfMonth: 1,
    hour: 12,
    minute: 30,
    matchday: 1,
  },
  {
    homeTeam: 'CB Centro Madrid',
    awayTeam: 'CB Pinto',
    competitionIndex: 2,
    venueIndex: 0,
    dayOfMonth: 1,
    hour: 17,
    minute: 0,
    matchday: 1,
  },
  {
    homeTeam: 'CB Majadahonda',
    awayTeam: 'CB San Fernando',
    competitionIndex: 2,
    venueIndex: 6,
    dayOfMonth: 1,
    hour: 19,
    minute: 0,
    matchday: 1,
  },

  // Matchday 1 — first Sunday (02 Mar 2025)
  {
    homeTeam: 'CB Leganés Sur',
    awayTeam: 'CB Vallecas',
    competitionIndex: 3,
    venueIndex: 5,
    dayOfMonth: 2,
    hour: 10,
    minute: 0,
    matchday: 1,
  },
  {
    homeTeam: 'CB Fuenlabrada B',
    awayTeam: 'CB Parla A',
    competitionIndex: 3,
    venueIndex: 1,
    dayOfMonth: 2,
    hour: 12,
    minute: 0,
    matchday: 1,
  },
  {
    homeTeam: 'Junior Alcobendas A',
    awayTeam: 'Junior Torrejón A',
    competitionIndex: 4,
    venueIndex: 0,
    dayOfMonth: 2,
    hour: 11,
    minute: 0,
    matchday: 1,
  },
  {
    homeTeam: 'Junior Getafe A',
    awayTeam: 'Junior Alcalá A',
    competitionIndex: 4,
    venueIndex: 2,
    dayOfMonth: 2,
    hour: 13,
    minute: 0,
    matchday: 1,
  },

  // Matchday 2 — second Saturday (08 Mar 2025)
  {
    homeTeam: 'CB Alcorcón',
    awayTeam: 'CB Getafe Azul',
    competitionIndex: 0,
    venueIndex: 1,
    dayOfMonth: 8,
    hour: 10,
    minute: 0,
    matchday: 2,
  },
  {
    homeTeam: 'CB Leganés Norte',
    awayTeam: 'CB Alcobendas',
    competitionIndex: 0,
    venueIndex: 5,
    dayOfMonth: 8,
    hour: 12,
    minute: 0,
    matchday: 2,
  },
  {
    homeTeam: 'CB Torrejón Baloncesto',
    awayTeam: 'CB Móstoles',
    competitionIndex: 1,
    venueIndex: 4,
    dayOfMonth: 8,
    hour: 10,
    minute: 30,
    matchday: 2,
  },
  {
    homeTeam: 'CB Las Rozas',
    awayTeam: 'CB Alcalá',
    competitionIndex: 1,
    venueIndex: 6,
    dayOfMonth: 8,
    hour: 12,
    minute: 30,
    matchday: 2,
  },
  {
    homeTeam: 'CB Pinto',
    awayTeam: 'CB Majadahonda',
    competitionIndex: 2,
    venueIndex: 1,
    dayOfMonth: 8,
    hour: 17,
    minute: 0,
    matchday: 2,
  },
  {
    homeTeam: 'CB San Fernando',
    awayTeam: 'CB Centro Madrid',
    competitionIndex: 2,
    venueIndex: 3,
    dayOfMonth: 8,
    hour: 19,
    minute: 0,
    matchday: 2,
  },

  // Matchday 2 — second Sunday (09 Mar 2025)
  {
    homeTeam: 'CB Vallecas',
    awayTeam: 'CB Leganés Sur',
    competitionIndex: 3,
    venueIndex: 0,
    dayOfMonth: 9,
    hour: 10,
    minute: 0,
    matchday: 2,
  },
  {
    homeTeam: 'CB Parla A',
    awayTeam: 'CB Fuenlabrada B',
    competitionIndex: 3,
    venueIndex: 7,
    dayOfMonth: 9,
    hour: 12,
    minute: 0,
    matchday: 2,
  },
  {
    homeTeam: 'Junior Torrejón A',
    awayTeam: 'Junior Getafe A',
    competitionIndex: 4,
    venueIndex: 4,
    dayOfMonth: 9,
    hour: 11,
    minute: 0,
    matchday: 2,
  },
  {
    homeTeam: 'Junior Alcalá A',
    awayTeam: 'Junior Alcobendas A',
    competitionIndex: 4,
    venueIndex: 3,
    dayOfMonth: 9,
    hour: 13,
    minute: 0,
    matchday: 2,
  },
]

async function seedMatches(
  seasonId: string,
  competitionIds: string[],
  venueIds: string[],
): Promise<void> {
  console.log('\n[5/5] Matches...')

  // Guard: if we have fewer venues than expected (some were skipped), cap the index
  const safeVenueIds = venueIds.filter(Boolean)
  const safeCompetitionIds = competitionIds.filter(Boolean)

  for (const template of MATCH_TEMPLATES) {
    const venueId = safeVenueIds[template.venueIndex % safeVenueIds.length]
    const competitionId = safeCompetitionIds[template.competitionIndex % safeCompetitionIds.length]

    if (!venueId || !competitionId) {
      console.warn(
        `  WARNING: Missing venueId or competitionId for match "${template.homeTeam} vs ${template.awayTeam}". Skipping.`,
      )
      continue
    }

    const dateStr = `2025-03-${pad(template.dayOfMonth)}`
    const timeStr = `${pad(template.hour)}:${pad(template.minute)}:00`

    // Idempotency: check by home/away team + date
    const existing = await db
      .select({ id: matches.id })
      .from(matches)
      .where(
        sql`
          ${matches.homeTeam} = ${template.homeTeam}
          AND ${matches.awayTeam} = ${template.awayTeam}
          AND ${matches.date} = ${dateStr}
        `,
      )
      .limit(1)

    if (existing.length > 0) {
      console.log(
        `  Match "${template.homeTeam} vs ${template.awayTeam}" (${dateStr}) already exists, skipping.`,
      )
      continue
    }

    const [row] = await db
      .insert(matches)
      .values({
        date: dateStr,
        time: timeStr,
        venueId,
        competitionId,
        homeTeam: template.homeTeam,
        awayTeam: template.awayTeam,
        refereesNeeded: 2,
        scorersNeeded: 1,
        status: 'scheduled',
        seasonId,
        matchday: template.matchday,
      })
      .returning({ id: matches.id })

    console.log(
      `  Created match "${template.homeTeam} vs ${template.awayTeam}" on ${dateStr} at ${timeStr} (id: ${row.id})`,
    )
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== FBM Demo Data Seed ===')

  // Ensure municipalities are present
  const allMunicipalities = await getAllMunicipalities()
  if (allMunicipalities.length === 0) {
    console.error('No municipalities found. Run "pnpm db:seed:municipalities" first.')
    process.exit(1)
  }
  console.log(`\nFound ${allMunicipalities.length} municipalities in DB.`)

  // Build lookup map by name
  const municipalityMap = new Map<string, string>(allMunicipalities.map((m) => [m.name, m.id]))

  // Seed in dependency order
  const seasonId = await seedSeason()
  const competitionIds = await seedCompetitions(seasonId)
  const venueIds = await seedVenues(municipalityMap)
  await seedPersons(municipalityMap)
  await seedMatches(seasonId, competitionIds, venueIds)

  console.log('\n=== Demo data seed complete ===')
  console.log(`  Season:       2024-25`)
  console.log(`  Competitions: ${competitionIds.length}`)
  console.log(`  Venues:       ${venueIds.length}`)
  console.log(`  Persons:      up to ${PERSON_SEEDS.length}`)
  console.log(`  Matches:      up to ${MATCH_TEMPLATES.length}`)
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Error seeding demo data:', err)
    process.exit(1)
  })
