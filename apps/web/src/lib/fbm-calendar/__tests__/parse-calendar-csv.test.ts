import { describe, it, expect } from 'vitest'
import { parseCalendarCsv } from '../parse-calendar-csv'

const HEADER =
  'DEL.;COMPETICIÓN;CATEGORÍA;FASE;GRUPO;JORNADA;CLUB L.;EQ. LOCAL;PTS. L.;CLUB V.;EQ. VISITANTE;PTS. V.;FECHA;HORA;ESTADO;INFORME;CAMPO;DIRECCIÓN;POBLACIÓN;AFORO;VESTUARIOS;IDENTIFICADOR;'

// Filas reales de un export del backend de competición FBM
const ROW_OK =
  'FBM;COMPETICIONES FEDERADAS FBM;Junior Masc. Pref.;PRIMERA 4ª DIVISION;GRUPO 1;1;VALLEKAS BASKET CDE;VALLEKAS BASKET AZUL;27;VERITAS POZUELO C.D.E.;VERITAS POZUELO;86;21/09/2025;09:15;Terminado;NO;ZAZUAR, COLEGIO;ZAZUAR, 17;Madrid;0;NO;314291;'
const ROW_NOT_PLAYED =
  'FBM;COMPETICIONES FEDERADAS FBM;Junior Masc. Pref.;PRIMERA 2ª DIVISION;GRUPO 4;16;MADRID SIERRA C.D.E.;BECERRIL DE LA SIERRA;1;VALLEKAS BASKET CDE;VALLEKAS BASKET NARANJA;1;08/08/1928;00:00;Terminado;NO;SOLOSPRADOS, PDVO. MPAL.;SOLOSPRADOS, S/N;Becerril de la Sierra;0;NO;313526;'
const ROW_QUOTED_TEAM =
  'FBM;COMPETICIONES FEDERADAS FBM;Cadete Masc. Pref.;PRIMERA 4ª DIVISION;GRUPO 3;1;VALLEKAS BASKET CDE;VALLEKAS BASKET AZUL;66;VILLA DE VALDEMORO C.B.;C.B. VILLA DE VALDEMORO  "D";36;04/10/2025;09:15;Terminado;NO;ZAZUAR, COLEGIO;ZAZUAR, 17;Madrid;0;NO;319916;'

function buildCsv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n')
}

describe('parseCalendarCsv — filas reales', () => {
  const result = parseCalendarCsv(buildCsv(ROW_OK, ROW_NOT_PLAYED, ROW_QUOTED_TEAM))

  it('parsea las 3 filas sin lanzar excepción', () => {
    expect(result.matches).toHaveLength(3)
  })

  it('fila 1: fecha, hora, sourceId, equipos, población, jornada y categoría correctos', () => {
    expect(result.matches[0]).toMatchObject({
      sourceId: '314291',
      category: 'Junior Masc. Pref.',
      matchday: 1,
      homeTeam: 'VALLEKAS BASKET AZUL',
      awayTeam: 'VERITAS POZUELO',
      date: '2025-09-21',
      time: '09:15',
      poblacion: 'Madrid',
    })
  })

  it('fila 2: fecha centinela (año 1928) → null + warning; hora 00:00 → null + warning', () => {
    expect(result.matches[1].date).toBeNull()
    expect(result.matches[1].time).toBeNull()
    expect(result.warnings.some((w) => w.includes('313526') && w.includes('fecha'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('313526') && w.includes('hora'))).toBe(true)
  })

  it('fila 3: comillas literales en medio del equipo visitante se conservan intactas', () => {
    expect(result.matches[2].awayTeam).toBe('C.B. VILLA DE VALDEMORO  "D"')
  })
})

describe('parseCalendarCsv — robustez', () => {
  it('nunca lanza excepción con un CSV vacío', () => {
    let result: ReturnType<typeof parseCalendarCsv> | undefined
    expect(() => {
      result = parseCalendarCsv('')
    }).not.toThrow()
    expect(result!.matches).toHaveLength(0)
  })

  it('cabecera irreconocible → warning y sin partidos, sin excepción', () => {
    const result = parseCalendarCsv('A;B;C\n1;2;3')
    expect(result.matches).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes('cabecera no reconocida'))).toBe(true)
  })

  it('fila sin IDENTIFICADOR se omite con warning, el resto se parsea', () => {
    const rowMissingId = ROW_OK.replace(/314291;$/, ';')
    const result = parseCalendarCsv(buildCsv(rowMissingId, ROW_QUOTED_TEAM))
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].sourceId).toBe('319916')
    expect(result.warnings.some((w) => w.includes('sin IDENTIFICADOR'))).toBe(true)
  })

  it('JORNADA no numérica → matchday null sin warning', () => {
    const rowBadMatchday = ROW_OK.replace(';1;VALLEKAS', ';N/D;VALLEKAS')
    const result = parseCalendarCsv(buildCsv(rowBadMatchday))
    expect(result.matches[0].matchday).toBeNull()
  })

  it('M3: fecha imposible dentro de rango (31/02/2026) → date null + warning', () => {
    const rowBadDate = ROW_OK.replace('21/09/2025', '31/02/2026')
    const result = parseCalendarCsv(buildCsv(rowBadDate))
    expect(result.matches[0].date).toBeNull()
    expect(result.warnings.some((w) => w.includes('fecha'))).toBe(true)
  })
})
