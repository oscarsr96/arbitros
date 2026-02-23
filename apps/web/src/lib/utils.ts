import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDirectionsUrl(origin: string, destination: string, hasCar: boolean): string {
  const mode = hasCar ? 'driving' : 'transit'
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: mode,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

// ── Departure time helpers ──────────────────────────────────────────────

const ARRIVAL_BUFFER_MIN = 30 // llegar 30 min antes del partido

function estimateTravelMinutes(km: number, hasCar: boolean): number {
  if (km <= 0) return hasCar ? 15 : 20 // mismo municipio
  // Driving: ~40 km/h media urbana → 1.5 min/km
  // Transit: ~20 km/h media con esperas → 3 min/km
  return Math.ceil(hasCar ? km * 1.5 : km * 3)
}

export interface DepartureInfo {
  departureTime: Date
  label: string // "09:15" or "Sal ya!"
  urgency: 'past' | 'soon' | 'normal'
  travelMin: number
}

export function getDepartureInfo(
  matchDate: string,
  matchTime: string,
  distanceKm: number,
  hasCar: boolean,
): DepartureInfo {
  const travelMin = estimateTravelMinutes(distanceKm, hasCar)
  const [hours, minutes] = matchTime.split(':').map(Number)
  const matchDateTime = new Date(matchDate + 'T00:00:00')
  matchDateTime.setHours(hours, minutes, 0, 0)

  const departureTime = new Date(matchDateTime.getTime() - (travelMin + ARRIVAL_BUFFER_MIN) * 60000)
  const now = new Date()

  const label = departureTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  let urgency: DepartureInfo['urgency'] = 'normal'
  if (now >= departureTime) {
    urgency = 'past'
  } else if (departureTime.getTime() - now.getTime() < 60 * 60000) {
    urgency = 'soon'
  }

  return { departureTime, label, urgency, travelMin }
}
