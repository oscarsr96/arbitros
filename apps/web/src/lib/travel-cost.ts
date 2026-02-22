import { db } from './db'
import { distances } from './db/schema'
import { and, eq } from 'drizzle-orm'

const COST_PER_KM = Number(process.env.TRAVEL_COST_PER_KM ?? '0.10')
const COST_SAME_MUNICIPALITY = Number(process.env.TRAVEL_COST_SAME_MUNICIPALITY ?? '3.00')

interface TravelCostResult {
  cost: number
  km: number
}

export async function calculateTravelCost(
  personMunicipalityId: string,
  venueMunicipalityId: string,
): Promise<TravelCostResult> {
  // Mismo municipio → tarifa fija
  if (personMunicipalityId === venueMunicipalityId) {
    return { cost: COST_SAME_MUNICIPALITY, km: 0 }
  }

  // Distinto municipio → consultar matriz de distancias
  const [row] = await db
    .select({ distanceKm: distances.distanceKm })
    .from(distances)
    .where(
      and(eq(distances.originId, personMunicipalityId), eq(distances.destId, venueMunicipalityId)),
    )
    .limit(1)

  if (!row) {
    return { cost: 0, km: 0 }
  }

  const km = Number(row.distanceKm)
  return { cost: Math.round(km * COST_PER_KM * 100) / 100, km }
}
