import { db } from './db'
import { distances } from './db/schema'
import { and, eq } from 'drizzle-orm'

const COST_PER_KM = Number(process.env.TRAVEL_COST_PER_KM ?? '0.26')
const COST_SAME_MUNICIPALITY = Number(process.env.TRAVEL_COST_SAME_MUNICIPALITY ?? '3.00')

interface TravelCostResult {
  cost: number
  km: number
}

// Ruta DB legacy (probablemente no usada en modo mock). Estimación POR
// PARTIDO, igual que calculateMockTravelCost en mock-data.ts. El fijo por
// mismo municipio ya NO es un único valor: la regla FBM lo calcula POR DÍA
// (Madrid 3€, resto 2€) en calculateDailyTravelCost (mock-data.ts); esta
// función se deja como estimación legacy y no se ha migrado a esa lógica.
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
