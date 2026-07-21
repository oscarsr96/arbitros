// Tablas OFICIALES de las Bases Generales de la FBM, transcritas literalmente.
//
// Fuente: "Bases_Generales_2026-2027_V.16-06-2026.pdf"
//   - Tabla A (arbitraje): p. 25, "COMPENSACIONES DE ARBITRAJE A CARGO DE LOS
//     CLUBS FEDERADOS", columna "TIPO DE ARBITRAJE".
//   - Tabla B (horarios): p. 55, "DIAS Y HORARIOS DE JUEGO POR CATEGORIAS".
//
// SALVEDAD TEMPORAL: las Bases son de la temporada 2026/2027 y los calendarios
// que importamos son de 2025/2026. Se asume continuidad de ambas tablas entre
// temporadas (la estructura de competiciones y el tipo de arbitraje por
// categoría no cambió). Revisar si aparecen las Bases 2025/2026.
//
// Este módulo es HOJA y puro: solo datos + tipos, sin imports del dominio. Es
// la única fuente de verdad de refereesNeeded/scorersNeeded; `category-mapping.ts`
// no repite los conteos, los deriva de aquí.

/** Una de las 22 filas de la Tabla A (p. 25). */
export type BasesCategory =
  | 'primera_nac_masc'
  | 'primera_nac_fem'
  | 'liga_universitaria'
  | 'primera_aut_masc_oro'
  | 'primera_aut_masc_plata'
  | 'primera_aut_fem'
  | 'segunda_aut_masc'
  | 'segunda_aut_fem'
  | 'sub22_masc_oro_y_fem'
  | 'sub22_plata_bronce'
  | 'junior_oro'
  | 'junior_plata_bronce'
  | 'junior_primer_ano'
  | 'junior_preferente'
  | 'cadete_oro'
  | 'cadete_plata_bronce'
  | 'cadete_primer_ano'
  | 'cadete_preferente'
  | 'infantil_oro'
  | 'infantil_plata_bronce'
  | 'infantil_preferente_y_primer_ano'
  | 'minibasket'

export type ArbitrationCounts = {
  /** Literal de la fila en las Bases, para trazabilidad y mensajes de error. */
  basesLabel: string
  refereesNeeded: number
  scorersNeeded: number
}

/**
 * TABLA A — tipo de arbitraje por categoría (Bases p. 25).
 * Transcripción literal de la columna "TIPO DE ARBITRAJE". NO son estimaciones:
 * son los conteos oficiales que factura la FBM a los clubs.
 */
export const ARBITRATION_BY_BASES_CATEGORY: Record<BasesCategory, ArbitrationCounts> = {
  primera_nac_masc: { basesLabel: '1ª Div. Nac. Masculina', refereesNeeded: 2, scorersNeeded: 3 },
  primera_nac_fem: { basesLabel: '1ª Div. Nac. Femenina', refereesNeeded: 2, scorersNeeded: 3 },
  liga_universitaria: { basesLabel: 'Liga Universitaria', refereesNeeded: 2, scorersNeeded: 2 },
  primera_aut_masc_oro: {
    basesLabel: '1ª Div. Aut. Masculina "ORO"',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  primera_aut_masc_plata: {
    basesLabel: '1ª Div. Aut. Masculina "PLATA"',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  primera_aut_fem: { basesLabel: '1ª Div. Aut. Femenina', refereesNeeded: 2, scorersNeeded: 2 },
  segunda_aut_masc: {
    basesLabel: '2ª Div. Autonómica Masculina',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  segunda_aut_fem: {
    basesLabel: '2ª Div. Autonómica Femenina',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  sub22_masc_oro_y_fem: {
    basesLabel: 'Sub-22 Mas. ORO y Sub-22 Fem.',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  sub22_plata_bronce: {
    basesLabel: 'Sub-22 PLATA y BRONCE',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  junior_oro: { basesLabel: 'Junior ORO', refereesNeeded: 2, scorersNeeded: 3 },
  junior_plata_bronce: {
    basesLabel: 'JUNIOR PLATA Y BRONCE',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  junior_primer_ano: { basesLabel: 'Junior de 1er. año', refereesNeeded: 2, scorersNeeded: 1 },
  junior_preferente: { basesLabel: 'Junior Preferente', refereesNeeded: 2, scorersNeeded: 1 },
  cadete_oro: { basesLabel: 'Cadete ORO', refereesNeeded: 2, scorersNeeded: 3 },
  cadete_plata_bronce: {
    basesLabel: 'Cadete PLATA y BRONCE',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  cadete_primer_ano: { basesLabel: 'Cadete de 1er. año', refereesNeeded: 2, scorersNeeded: 1 },
  // Única categoría de club con UN solo árbitro además de minibasket/infantil.
  cadete_preferente: { basesLabel: 'Cadete Preferente', refereesNeeded: 1, scorersNeeded: 1 },
  infantil_oro: { basesLabel: 'Infantil ORO', refereesNeeded: 2, scorersNeeded: 3 },
  infantil_plata_bronce: {
    basesLabel: 'Infantil PLATA y BRONCE',
    refereesNeeded: 2,
    scorersNeeded: 2,
  },
  // Las Bases fusionan Preferente y 1er año en UNA fila: mismo arbitraje.
  infantil_preferente_y_primer_ano: {
    basesLabel: 'Infantil Preferente e Infantil 1er.año',
    refereesNeeded: 1,
    scorersNeeded: 1,
  },
  // Alevín y Benjamín (ligas Marco Aldany), todos los años y niveles.
  minibasket: { basesLabel: 'Competiciones Minibasket', refereesNeeded: 1, scorersNeeded: 1 },
}

/** Día oficial de juego (Tabla B). El domingo es la fecha oficial administrativa. */
export type PlayDay = 'sabado' | 'domingo' | 'sabado_o_domingo'

export type ScheduleWindow = {
  /** Literal de la fila en la Tabla B, para trazabilidad. */
  basesLabel: string
  day: PlayDay
  /** Hora de inicio del encuentro, HH:MM. */
  startTime: string
  endTime: string
}

/**
 * TABLA B — día oficial y franja horaria (Bases p. 55).
 *
 * La Tabla B tiene 11 filas con una granularidad distinta a la Tabla A (22
 * filas): agrupa por bloques ("1ª y 2ª DIVISIÓN AUTONOMICA", "SUB-22, JUNIOR
 * ORO, PLATA y BRONCE"...). Aquí se proyecta sobre las 22 claves de la Tabla A
 * para poder consultarla con la misma clave; `basesLabel` conserva la fila
 * original de la que sale cada entrada.
 *
 * `liga_universitaria` es `null`: no aparece en la Tabla B (no tiene día ni
 * franja oficial asignados en las Bases).
 */
export const SCHEDULE_BY_BASES_CATEGORY: Record<BasesCategory, ScheduleWindow | null> = {
  primera_nac_masc: {
    basesLabel: '1ª DIVISIÓN NACIONAL',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  primera_nac_fem: {
    basesLabel: '1ª DIVISIÓN NACIONAL',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  liga_universitaria: null,
  primera_aut_masc_oro: {
    basesLabel: '1ª y 2ª DIVISIÓN AUTONOMICA',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  primera_aut_masc_plata: {
    basesLabel: '1ª y 2ª DIVISIÓN AUTONOMICA',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  primera_aut_fem: {
    basesLabel: '1ª y 2ª DIVISIÓN AUTONOMICA',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  segunda_aut_masc: {
    basesLabel: '1ª y 2ª DIVISIÓN AUTONOMICA',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  segunda_aut_fem: {
    basesLabel: '1ª y 2ª DIVISIÓN AUTONOMICA',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  sub22_masc_oro_y_fem: {
    basesLabel: 'SUB-22, JUNIOR ORO, PLATA y BRONCE',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  sub22_plata_bronce: {
    basesLabel: 'SUB-22, JUNIOR ORO, PLATA y BRONCE',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  junior_oro: {
    basesLabel: 'SUB-22, JUNIOR ORO, PLATA y BRONCE',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  junior_plata_bronce: {
    basesLabel: 'SUB-22, JUNIOR ORO, PLATA y BRONCE',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  junior_primer_ano: {
    basesLabel: 'JUNIOR PREFERENTE y JUNIOR DE 1ª AÑO',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  junior_preferente: {
    basesLabel: 'JUNIOR PREFERENTE y JUNIOR DE 1ª AÑO',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  cadete_oro: {
    basesLabel: 'CADETE ORO, PLATA y BRONCE',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  cadete_plata_bronce: {
    basesLabel: 'CADETE ORO, PLATA y BRONCE',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  cadete_primer_ano: {
    basesLabel: 'CADETE DE 1er. AÑO',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  cadete_preferente: {
    basesLabel: 'CADETE PREFERENTE',
    day: 'sabado_o_domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  infantil_oro: {
    basesLabel: 'INFANTIL ORO, PLATA y BRONCE',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  infantil_plata_bronce: {
    basesLabel: 'INFANTIL ORO, PLATA y BRONCE',
    day: 'domingo',
    startTime: '09:00',
    endTime: '20:30',
  },
  // La Tabla B separa "INFANTIL PREFERENTE" e "INFANTIL DE 1er. AÑO" en dos
  // filas, pero ambas dicen Sábado 9:00-20:30: la clave fusionada de la Tabla A
  // no queda ambigua.
  infantil_preferente_y_primer_ano: {
    basesLabel: 'INFANTIL PREFERENTE / INFANTIL DE 1er. AÑO',
    day: 'sabado',
    startTime: '09:00',
    endTime: '20:30',
  },
  // Único bloque que cierra antes: 18:30 en vez de 20:30.
  minibasket: {
    basesLabel: 'MINIBASKET (ALEVÍN Y BENJAMÍN)',
    day: 'sabado',
    startTime: '09:00',
    endTime: '18:30',
  },
}
