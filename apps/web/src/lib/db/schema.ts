import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  date,
  time,
  integer,
  numeric,
  pgEnum,
  primaryKey,
  smallint,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Enums ──────────────────────────────────────────────────────────────────

export const personRoleEnum = pgEnum('person_role', ['arbitro', 'anotador'])

export const refereeCategoryEnum = pgEnum('referee_category', [
  'provincial',
  'autonomico',
  'nacional',
  'feb',
])

export const designationStatusEnum = pgEnum('designation_status', [
  'pending',
  'notified',
  'confirmed',
  'rejected',
  'completed',
])

export const matchStatusEnum = pgEnum('match_status', [
  'scheduled',
  'designated',
  'played',
  'suspended',
])

export const genderEnum = pgEnum('gender', ['male', 'female', 'mixed'])

// ── Seasons ────────────────────────────────────────────────────────────────

export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 20 }).notNull(), // "2024-25"
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  active: boolean('active').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const seasonsRelations = relations(seasons, ({ many }) => ({
  competitions: many(competitions),
  matches: many(matches),
}))

// ── Municipalities ─────────────────────────────────────────────────────────

export const municipalities = pgTable('municipalities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  province: varchar('province', { length: 100 }).default('Madrid').notNull(),
})

export const municipalitiesRelations = relations(municipalities, ({ many }) => ({
  persons: many(persons),
  venues: many(venues),
}))

// ── Distances ──────────────────────────────────────────────────────────────

export const distances = pgTable(
  'distances',
  {
    originId: uuid('origin_id')
      .references(() => municipalities.id)
      .notNull(),
    destId: uuid('dest_id')
      .references(() => municipalities.id)
      .notNull(),
    distanceKm: numeric('distance_km', { precision: 6, scale: 1 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.originId, t.destId] }),
  }),
)

export const distancesRelations = relations(distances, ({ one }) => ({
  origin: one(municipalities, {
    fields: [distances.originId],
    references: [municipalities.id],
    relationName: 'distanceOrigin',
  }),
  dest: one(municipalities, {
    fields: [distances.destId],
    references: [municipalities.id],
    relationName: 'distanceDest',
  }),
}))

// ── Persons ────────────────────────────────────────────────────────────────

export const persons = pgTable('persons', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }),
  role: personRoleEnum('role').notNull(),
  category: refereeCategoryEnum('category'),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  municipalityId: uuid('municipality_id').references(() => municipalities.id),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  bankIban: varchar('bank_iban', { length: 34 }),
  active: boolean('active').default(true).notNull(),
  authUserId: uuid('auth_user_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const personsRelations = relations(persons, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [persons.municipalityId],
    references: [municipalities.id],
  }),
  availabilities: many(availabilities),
  designations: many(designations),
  incompatibilities: many(incompatibilities),
}))

// ── Venues ─────────────────────────────────────────────────────────────────

export const venues = pgTable('venues', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address'),
  municipalityId: uuid('municipality_id').references(() => municipalities.id),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  postalCode: varchar('postal_code', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const venuesRelations = relations(venues, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [venues.municipalityId],
    references: [municipalities.id],
  }),
  matches: many(matches),
}))

// ── Competitions ───────────────────────────────────────────────────────────

export const competitions = pgTable('competitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  gender: genderEnum('gender').notNull(),
  refereesNeeded: smallint('referees_needed').default(2).notNull(),
  scorersNeeded: smallint('scorers_needed').default(1).notNull(),
  minRefCategory: refereeCategoryEnum('min_ref_category'),
  seasonId: uuid('season_id').references(() => seasons.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
  season: one(seasons, {
    fields: [competitions.seasonId],
    references: [seasons.id],
  }),
  matches: many(matches),
}))

// ── Matches ────────────────────────────────────────────────────────────────

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: date('date').notNull(),
  time: time('time').notNull(),
  venueId: uuid('venue_id').references(() => venues.id),
  competitionId: uuid('competition_id').references(() => competitions.id),
  homeTeam: varchar('home_team', { length: 200 }).notNull(),
  awayTeam: varchar('away_team', { length: 200 }).notNull(),
  refereesNeeded: smallint('referees_needed').default(2).notNull(),
  scorersNeeded: smallint('scorers_needed').default(1).notNull(),
  status: matchStatusEnum('status').default('scheduled').notNull(),
  seasonId: uuid('season_id').references(() => seasons.id),
  matchday: integer('matchday'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const matchesRelations = relations(matches, ({ one, many }) => ({
  venue: one(venues, {
    fields: [matches.venueId],
    references: [venues.id],
  }),
  competition: one(competitions, {
    fields: [matches.competitionId],
    references: [competitions.id],
  }),
  season: one(seasons, {
    fields: [matches.seasonId],
    references: [seasons.id],
  }),
  designations: many(designations),
}))

// ── Availabilities ─────────────────────────────────────────────────────────

export const availabilities = pgTable('availabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .references(() => persons.id)
    .notNull(),
  weekStart: date('week_start').notNull(),
  dayOfWeek: smallint('day_of_week').notNull(), // 0=lunes … 6=domingo
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const availabilitiesRelations = relations(availabilities, ({ one }) => ({
  person: one(persons, {
    fields: [availabilities.personId],
    references: [persons.id],
  }),
}))

// ── Designations ───────────────────────────────────────────────────────────

export const designations = pgTable('designations', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id')
    .references(() => matches.id)
    .notNull(),
  personId: uuid('person_id')
    .references(() => persons.id)
    .notNull(),
  role: personRoleEnum('role').notNull(),
  travelCost: numeric('travel_cost', { precision: 8, scale: 2 }),
  distanceKm: numeric('distance_km', { precision: 6, scale: 1 }),
  status: designationStatusEnum('status').default('pending').notNull(),
  notifiedAt: timestamp('notified_at'),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const designationsRelations = relations(designations, ({ one }) => ({
  match: one(matches, {
    fields: [designations.matchId],
    references: [matches.id],
  }),
  person: one(persons, {
    fields: [designations.personId],
    references: [persons.id],
  }),
}))

// ── Incompatibilities ──────────────────────────────────────────────────────

export const incompatibilities = pgTable('incompatibilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .references(() => persons.id)
    .notNull(),
  teamName: varchar('team_name', { length: 200 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const incompatibilitiesRelations = relations(incompatibilities, ({ one }) => ({
  person: one(persons, {
    fields: [incompatibilities.personId],
    references: [persons.id],
  }),
}))
