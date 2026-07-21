import { mockMunicipalities } from '@/lib/mock-data'

// Mismo criterio que normalize() en app/api/admin/matches/import-xlsx/route.ts,
// replicado aquí para que este fichero sea self-contained.
function normalize(value: string): string {
  return value
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// El calendario FBM a veces invierte el artículo: "Rozas de Madrid, Las" en
// vez de "Las Rozas de Madrid". Lo reordena antes de normalizar/casar.
function applyInvertedArticleAlias(poblacion: string): string {
  const match = poblacion.match(/^(.+),\s*(Las|El|Los|La)$/i)
  if (!match) return poblacion
  const [, name, article] = match
  return `${article} ${name}`
}

// Casos que ni el match exacto ni la contención por tokens resuelven, vistos
// en el calendario real de temporada (~24.500 partidos): pedanías/distritos
// que no son municipio propio, y formas truncadas/con preposición u artículo
// interno omitido que llegan así en volumen (no son un descarte, algunas son
// la forma MAYORITARIA en la que aparece ese municipio). Clave = normalize()
// del valor de entrada (tras aplicar applyInvertedArticleAlias); valor = id
// del municipio real al que se mapea. Documentado caso a caso.
const KNOWN_ALIASES: Record<string, string> = {
  // Distritos/barrios de un municipio mayor: NO son municipio propio.
  ARAVACA: 'muni-001', // distrito de Madrid capital
  'PERALES DEL RIO': 'muni-003', // barrio de Getafe
  'LA POVEDA': 'muni-019', // barrio de Arganda del Rey (apeadero de Cercanías)
  // Formas truncadas: al valor le falta la última palabra del nombre oficial.
  'ROZAS DE MADRID': 'muni-011', // "Rozas de Madrid, Las" sin el "Las" final (571 filas)
  'VILLANUEVA DEL': 'muni-057', // "Villanueva del Pardillo" sin "Pardillo"
  'MANZANARES EL': 'muni-044', // "Manzanares el Real" sin "Real"
  'VILLAVICIOSA DE': 'muni-031', // "Villaviciosa de Odón" sin "Odón" (única forma en el CSV)
  // Formas con preposición/artículo interno omitido.
  'SAN FERNANDO HENARES': 'muni-025', // "San Fernando DE Henares"
  'SAN SEBASTIAN REYES': 'muni-015', // "San Sebastián DE LOS Reyes"
  'SAN LORENZO DE ESCORIAL': 'muni-049', // "San Lorenzo de EL Escorial"
  'SAN MARTIN DE VEGA': 'muni-050', // "San Martín de LA Vega"
  'FUENTE EL SAZ JARAMA': 'muni-040', // "Fuente el Saz DE Jarama"
  // Localidad/pedanía cuyo municipio administrativo tiene otro nombre.
  ALALPARDO: 'muni-055', // localidad sede de "Valdeolmos-Alalpardo"
  SERRACINES: 'muni-039', // pedanía de "Fresno de Torote"
}

export function resolveMunicipality(poblacion: string): {
  municipalityId: string | null
  municipalityName: string
  matched: boolean
} {
  const normInput = normalize(applyInvertedArticleAlias(poblacion))

  if (normInput) {
    const exact = mockMunicipalities.find((m) => normalize(m.name) === normInput)
    if (exact) {
      return { municipalityId: exact.id, municipalityName: exact.name, matched: true }
    }

    const aliasId = KNOWN_ALIASES[normInput]
    if (aliasId) {
      const aliasMuni = mockMunicipalities.find((m) => m.id === aliasId)
      if (aliasMuni) {
        return { municipalityId: aliasMuni.id, municipalityName: aliasMuni.name, matched: true }
      }
    }

    // Sin igualdad exacta ni alias: contención por PALABRAS COMPLETAS (no subcadena),
    // priorizando el nombre de municipio más largo (más específico). Casa si
    // todas las palabras del municipio están en la población de entrada:
    // "Las Rozas de Madrid" → "Las Rozas" (gana a "Madrid" por longitud). El
    // match por subcadena daba falsos positivos silenciosos como
    // "Rivas Vaciamadrid" → "Madrid" (VACIAMADRID contiene MADRID). Se tokeniza
    // por espacios y guiones para que "Rivas Vaciamadrid" case con el mock
    // "Rivas-Vaciamadrid".
    const inputTokens = new Set(normInput.split(/[\s-]+/).filter(Boolean))
    let best: (typeof mockMunicipalities)[number] | null = null
    for (const m of mockMunicipalities) {
      const muniTokens = normalize(m.name)
        .split(/[\s-]+/)
        .filter(Boolean)
      const contained = muniTokens.length > 0 && muniTokens.every((t) => inputTokens.has(t))
      if (contained && (!best || normalize(m.name).length > normalize(best.name).length)) {
        best = m
      }
    }
    if (best) {
      return { municipalityId: best.id, municipalityName: best.name, matched: true }
    }
  }

  return {
    municipalityId: null,
    municipalityName: poblacion.replace(/\s+/g, ' ').trim(),
    matched: false,
  }
}
