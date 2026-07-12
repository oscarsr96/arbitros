import { NextResponse } from 'next/server'
import { mockMatches, mockVenues, mockCompetitions, mockDesignations } from '@/lib/mock-data'
import { parseCalendarCsv, type ParsedCsvMatch } from '@/lib/fbm-calendar/parse-calendar-csv'
import { materializeImport } from '@/lib/fbm-calendar/materialize-import'
import { persistDesignations } from '@/lib/designation-persistence'

// Importador del CSV oficial de calendario de partidos de la FBM. El fichero
// llega en cp1252/latin1 (tildes se corrompen si se lee como UTF-8): se
// decodifica explícitamente antes de pasarlo al parser, que exige la
// cabecera con tildes correctas (p. ej. "CATEGORÍA").
function decodeCalendarFile(buf: Buffer): string {
  try {
    return new TextDecoder('windows-1252').decode(buf)
  } catch {
    return buf.toString('latin1')
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)

  if (files.length === 0) {
    return NextResponse.json({ error: 'No se proporcionó ningún fichero' }, { status: 400 })
  }

  const dryRun = formData.get('dryRun') === 'true'

  const allParsed: ParsedCsvMatch[] = []
  const allWarnings: string[] = []
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer())
    const text = decodeCalendarFile(buf)
    const { matches, warnings } = parseCalendarCsv(text)
    allParsed.push(...matches)
    allWarnings.push(...warnings.map((w) => `${file.name}: ${w}`))
  }

  const { matches, venues, competitions, summary } = materializeImport(
    allParsed,
    allWarnings,
    files.length,
  )

  // No mutar si el import no produjo partidos: confirmar un CSV vacío o
  // rechazado (p. ej. re-guardado como UTF-8 → cabecera ilegible, o todas las
  // categorías sin mapear) NO debe borrar los partidos/designaciones actuales.
  if (!dryRun && matches.length > 0) {
    mockMatches.length = 0
    mockMatches.push(...matches)

    // Las designaciones referenciaban partidos que ya no existen tras vaciar
    // mockMatches: quedarían huérfanas.
    // FOOTGUN: reimportar el CSV borra TODAS las designaciones (incluidas publicadas).
    // Comportamiento intencionado al cambiar de calendario; documentado, no se cambia.
    mockDesignations.length = 0
    persistDesignations()

    const existingVenueIds = new Set(mockVenues.map((v) => v.id))
    for (const venue of venues) {
      if (!existingVenueIds.has(venue.id)) mockVenues.push(venue)
    }

    const existingCompetitionIds = new Set(mockCompetitions.map((c) => c.id))
    for (const comp of competitions) {
      if (!existingCompetitionIds.has(comp.id)) mockCompetitions.push(comp)
    }
  }

  return NextResponse.json({ dryRun, ...summary })
}
