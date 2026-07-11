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

    // Sin igualdad exacta: contención por PALABRAS COMPLETAS (no subcadena),
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
