// Tablas OFICIALES de las Bases Generales de la FBM, transcritas literalmente.
//
// Fuente: "Bases_Generales_2026-2027_V.16-06-2026.pdf"
//   - Tabla A (arbitraje): p. 25, "COMPENSACIONES DE ARBITRAJE A CARGO DE LOS
//     CLUBS FEDERADOS", columna "TIPO DE ARBITRAJE".
//   - Tabla B (horarios): p. 55, "DIAS Y HORARIOS DE JUEGO POR CATEGORIAS".
//   - Tabla C (honorarios): p. 25, "DESGLOSE DE LOS DERECHOS DE ARBITRAJE PARA
//     COMPETICIONES ORGANIZADAS POR LA FBM". Extraída y verificada en
//     tasks/fase4-tarifas-oficiales.md (2026-07-24). Honorario individual =
//     tarifa de esta tabla según la categoría del PARTIDO y el rol del slot,
//     nunca según el nivel del árbitro. `Der. Comité` y `Total` (a cargo del
//     club) quedan fuera: no son honorarios a personas.
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

export type ArbitrationFees = {
  /** Literal de la fila en las Bases, para trazabilidad y mensajes de error. */
  basesLabel: string
  principal: number
  auxiliar: number
  anotador: number
  cronometrador: number
  veinticuatro: number
}

/**
 * TABLA C — honorario individual por categoría del partido y rol del slot
 * (Bases p. 25). Transcripción literal de tasks/fase4-tarifas-oficiales.md.
 * NO son estimaciones: son los importes oficiales que cobra cada persona.
 * `Der. Comité` y `Total` (a cargo del club) no están aquí: no son honorarios
 * a personas.
 */
export const FEES_BY_BASES_CATEGORY: Record<BasesCategory, ArbitrationFees> = {
  primera_nac_masc: {
    basesLabel: '1ª Div. Nac. Masculina',
    principal: 111.6,
    auxiliar: 111.6,
    anotador: 31.8,
    cronometrador: 30.8,
    veinticuatro: 30.8,
  },
  primera_nac_fem: {
    basesLabel: '1ª Div. Nac. Femenina',
    principal: 94.15,
    auxiliar: 94.15,
    anotador: 29.65,
    cronometrador: 28.65,
    veinticuatro: 28.65,
  },
  liga_universitaria: {
    basesLabel: 'Liga Universitaria',
    principal: 36.8,
    auxiliar: 36.8,
    anotador: 26.6,
    cronometrador: 25.6,
    veinticuatro: 0,
  },
  primera_aut_masc_oro: {
    basesLabel: '1ª Div. Aut. Masculina "ORO"',
    principal: 50.25,
    auxiliar: 50.25,
    anotador: 36.75,
    cronometrador: 35.75,
    veinticuatro: 0,
  },
  primera_aut_masc_plata: {
    basesLabel: '1ª Div. Aut. Masculina "PLATA"',
    principal: 43.6,
    auxiliar: 43.6,
    anotador: 34.4,
    cronometrador: 33.4,
    veinticuatro: 0,
  },
  primera_aut_fem: {
    basesLabel: '1ª Div. Aut. Femenina',
    principal: 39.15,
    auxiliar: 39.15,
    anotador: 29.5,
    cronometrador: 28.5,
    veinticuatro: 0,
  },
  segunda_aut_masc: {
    basesLabel: '2ª Div. Autonómica Masculina',
    principal: 36.75,
    auxiliar: 36.75,
    anotador: 26.5,
    cronometrador: 25.5,
    veinticuatro: 0,
  },
  segunda_aut_fem: {
    basesLabel: '2ª Div. Autonómica Femenina',
    principal: 30.75,
    auxiliar: 30.75,
    anotador: 24.2,
    cronometrador: 23.2,
    veinticuatro: 0,
  },
  sub22_masc_oro_y_fem: {
    basesLabel: 'Sub-22 Mas. ORO y Sub-22 Fem.',
    principal: 30.35,
    auxiliar: 30.35,
    anotador: 23.9,
    cronometrador: 22.9,
    veinticuatro: 0,
  },
  sub22_plata_bronce: {
    basesLabel: 'Sub-22 PLATA y BRONCE',
    principal: 27.05,
    auxiliar: 27.05,
    anotador: 21.6,
    cronometrador: 20.6,
    veinticuatro: 0,
  },
  junior_oro: {
    basesLabel: 'Junior ORO',
    principal: 41.65,
    auxiliar: 41.65,
    anotador: 24.7,
    cronometrador: 23.7,
    veinticuatro: 23.7,
  },
  junior_plata_bronce: {
    basesLabel: 'JUNIOR PLATA Y BRONCE',
    principal: 25.8,
    auxiliar: 25.8,
    anotador: 21.6,
    cronometrador: 20.6,
    veinticuatro: 0,
  },
  junior_primer_ano: {
    basesLabel: 'Junior de 1er. año',
    principal: 22.85,
    auxiliar: 22.85,
    anotador: 23.6,
    cronometrador: 0,
    veinticuatro: 0,
  },
  junior_preferente: {
    basesLabel: 'Junior Preferente',
    principal: 22.85,
    auxiliar: 22.85,
    anotador: 23.6,
    cronometrador: 0,
    veinticuatro: 0,
  },
  cadete_oro: {
    basesLabel: 'Cadete ORO',
    principal: 24.2,
    auxiliar: 24.2,
    anotador: 22.65,
    cronometrador: 21.65,
    veinticuatro: 21.65,
  },
  cadete_plata_bronce: {
    basesLabel: 'Cadete PLATA y BRONCE',
    principal: 22.85,
    auxiliar: 22.85,
    anotador: 21.6,
    cronometrador: 20.6,
    veinticuatro: 0,
  },
  cadete_primer_ano: {
    basesLabel: 'Cadete de 1er. año',
    principal: 21.15,
    auxiliar: 21.15,
    anotador: 16.0,
    cronometrador: 0,
    veinticuatro: 0,
  },
  // Única categoría de club con UN solo árbitro además de minibasket/infantil:
  // sin auxiliar (arbitraje simple), coherente con ARBITRATION_BY_BASES_CATEGORY.
  cadete_preferente: {
    basesLabel: 'Cadete Preferente',
    principal: 21.15,
    auxiliar: 0,
    anotador: 16.0,
    cronometrador: 0,
    veinticuatro: 0,
  },
  infantil_oro: {
    basesLabel: 'Infantil ORO',
    principal: 21.15,
    auxiliar: 21.15,
    anotador: 20.6,
    cronometrador: 19.6,
    veinticuatro: 19.6,
  },
  infantil_plata_bronce: {
    basesLabel: 'Infantil PLATA y BRONCE',
    principal: 21.15,
    auxiliar: 21.15,
    anotador: 20.3,
    cronometrador: 19.3,
    veinticuatro: 0,
  },
  // Las Bases fusionan Preferente y 1er año en UNA fila: mismo honorario.
  infantil_preferente_y_primer_ano: {
    basesLabel: 'Infantil Preferente e Infantil 1er.año',
    principal: 21.15,
    auxiliar: 0,
    anotador: 16.0,
    cronometrador: 0,
    veinticuatro: 0,
  },
  // La subvención de 10 € (p.26) reduce lo que paga el CLUB (28,60 €), no lo
  // que cobra el oficial: el principal cobra 21,15 y el anotador 16,00 igual.
  minibasket: {
    basesLabel: 'Competiciones Minibasket',
    principal: 21.15,
    auxiliar: 0,
    anotador: 16.0,
    cronometrador: 0,
    veinticuatro: 0,
  },
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
