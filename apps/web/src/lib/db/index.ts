import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// `prepare: false` es necesario para el pooler de Supabase (modo transaction)
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
