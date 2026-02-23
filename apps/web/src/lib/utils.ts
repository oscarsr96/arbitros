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
