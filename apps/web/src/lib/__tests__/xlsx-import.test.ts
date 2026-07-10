import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseJornadaWorkbook } from '../xlsx-import'

// Sabado de referencia: 2026-03-14 (sabado real del calendario)
const SATURDAY = '2026-03-14'
const SUNDAY = '2026-03-15'

// Fixture sintetico que reproduce la estructura del fichero real de jornada
// (dos bandas de mini-tablas, sufijos de pista, cabeceras de dia, satelites,
// CAMPOS y SANCIONADOS). Sin nombres reales de personas.
function buildHappyWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // SABADO: dos pabellones; el primero con 2 pistas (bandas paralelas),
  // el segundo sin sufijo (pista implicita)
  const sabado: unknown[][] = [
    [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Sábado 14 Marzo',
    ],
    [],
    [null, null, null, null, null, null, null, null, 'DISTRITO NORTE'],
    [
      null,
      null,
      null,
      null,
      'PABELLON CENTRAL - 1',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'PABELLON CENTRAL - 2',
    ],
    [
      'H',
      'CAT',
      'GR.',
      'DISTRITO',
      'LOCAL',
      'VISITANTE',
      'ARBITRO',
      'ANOT.',
      null,
      'H',
      'CAT',
      'GR.',
      'DISTRITO',
      'LOCAL',
      'VISITANTE',
      'ARBITRO',
      'ANOT.',
    ],
    [
      '9:00',
      'SEN M',
      '1',
      'NORTE',
      'EQUIPO LINCE',
      'EQUIPO CIERVO',
      'AR1',
      'AN1',
      null,
      '10:15',
      'JUV F',
      '2',
      'NORTE',
      'EQUIPO GAMO',
      'EQUIPO CORZO',
      'AR2',
      'AN2',
    ],
    ['10:15', 'SEN M', '1', 'NORTE', 'EQUIPO ZORRO', 'EQUIPO TEJON', 'AR1', 'AN1'],
    [],
    [null, null, null, null, 'POLIDEPORTIVO SUR'],
    ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
    // Hora como numero Excel (0.5 = 12:00)
    [0.5, 'CAD M', 'A', 'SUR', 'EQUIPO BUHO', 'EQUIPO MIRLO', 'AR3', 'AN3'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sabado), 'SABADO')

  // DOMINGO: cabecera con la celda DISTRITO vacia (ocurre en el fichero real)
  const domingo: unknown[][] = [
    [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Domingo 15 Marzo',
    ],
    [],
    [null, null, null, null, 'PABELLON DEL RIO - 3'],
    ['H', 'CAT', 'GR.', null, 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
    ['9:00', 'SEN F', 'D1', 'RIBERA', 'EQUIPO NUTRIA', 'EQUIPO GARZA', 'AR', 'AN'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(domingo), 'DOMINGO')

  // ENTRE SEMANA: tres dias; con fecha explicita, solo nombre de dia (sin
  // tilde) y fecha explicita anterior al fin de semana (patron fichero real)
  const entreSemana: unknown[][] = [
    [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Martes 17 Marzo',
    ],
    [null, null, null, null, null, null, null, null, 'DISTRITO ESTE'],
    [null, null, null, null, 'COLEGIO LA ENCINA'],
    ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
    ['18:30', 'INF F', '1', 'ESTE', 'EQUIPO ROBLE', 'EQUIPO ALAMO', 'AR', 'AN'],
    [],
    [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Miercoles',
    ],
    [null, null, null, null, 'COLEGIO EL OLMO - 2'],
    ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
    ['19:00', 'CAD M', '2', 'ESTE', 'EQUIPO PINO', 'EQUIPO SAUCE', 'AR', 'AN'],
    [],
    [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Jueves 12 Marzo',
    ],
    [null, null, null, null, 'COLEGIO EL OLMO'],
    ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
    ['20:00', 'JUV M', '1', 'ESTE', 'EQUIPO HAYA', 'EQUIPO FRESNO', 'AR', 'AN'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(entreSemana), 'ENTRE SEMANA')

  // MOSTOLES (satelite): cabecera ARBITRO 1 | ARBITRO 2, zonas y dos dias
  const mostoles: unknown[][] = [
    [null, null, null, null, null, null, null, 'Sábado 14 Marzo'],
    [],
    [null, null, null, null, 'POLIDEPORTIVO DEL OESTE'],
    [],
    [null, null, null, 'ZONA "A"'],
    [null, 'H', 'CAT', 'LOCAL', 'VISITANTE', 'ARBITRO 1', 'ARBITRO 2', 'ANOTADOR'],
    [null, '9:00', 'ALE', 'EQUIPO CIGARRA', 'EQUIPO HORMIGA', 'A1', 'A2', 'AN'],
    [null, '10:15', 'SEN.2ª', 'EQUIPO GRILLO', 'EQUIPO ABEJA', 'A1', null, 'AN'],
    [],
    [null, null, null, null, null, null, null, 'Domingo 15 Marzo'],
    [null, null, null, 'ZONA "B"'],
    [null, 'H', 'CAT', 'LOCAL', 'VISITANTE', 'ARBITRO 1', 'ARBITRO 2', 'ANOTADOR'],
    [null, '16:00', 'SEN.1ª', 'EQUIPO AVISPA', 'EQUIPO MOSCA', 'A1', 'A2', 'AN'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mostoles), 'MOSTOLES')

  // ARANJUEZ (satelite): dos bandas, pabellon centrado en la columna-hueco
  // entre ambas y una sola columna ARBITRO (→ 1 arbitro)
  const aranjuez: unknown[][] = [
    [null, null, null, null, null, null, null, null, null, null, null, null, 'Sábado 14 Marzo'],
    [],
    [null, null, null, null, null, null, null, 'POLIDEPORTIVO GRANDE'],
    [null, null, null, 'PISTA  - 1', null, null, null, null, null, null, null, 'PISTA - 2'],
    [
      'H',
      'CAT',
      'GR.',
      'LOCAL',
      'VISITANTE',
      'ARBITRO',
      'ANOT.',
      null,
      'H',
      'CAT',
      'GR.',
      'LOCAL',
      'VISITANTE',
      'ARBITRO',
      'ANOT.',
    ],
    [
      '16:00',
      'SEN M',
      '1',
      'EQUIPO CIGÜEÑA',
      'EQUIPO MILANO',
      'AR',
      'AN',
      null,
      '17:15',
      'SEN M',
      '1',
      'EQUIPO VENCEJO',
      'EQUIPO JILGUERO',
      'AR',
      'AN',
    ],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aranjuez), 'ARANJUEZ')

  // CAMPOS: cabecera con el typo real "OBSERVAVIONES"
  const campos: unknown[][] = [
    ['DISTRITO', 'NOMBRE', 'DIRECCIÓN', 'METRO // (CERCANÍAS)', 'AUTOBUS', 'MAPA', 'OBSERVAVIONES'],
    ['NORTE', 'PABELLON CENTRAL', 'CALLE UNO, 1', 'ESTACION NORTE', '10,20', 'Ver Mapa', null],
    ['SUR', 'POLIDEPORTIVO SUR', 'CALLE DOS, 2', null, null, 'Ver Mapa', 'CERRADO EN AGOSTO'],
    ['ESTE', 'CANCHA ESTE', 'CALLE TRES, 3', 'ESTACION ESTE', '30', null, null],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(campos), 'CAMPOS')

  // SANCIONADOS: debe ignorarse con warning informativo
  const sancionados: unknown[][] = [
    ['NOMBRE', 'EQUIPO', 'DISTRITO', 'SANCION'],
    ['PERSONA FICTICIA', 'EQUIPO LINCE', 'NORTE', '2'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sancionados), 'SANCIONADOS')

  return wb
}

describe('parseJornadaWorkbook — happy path', () => {
  const result = parseJornadaWorkbook(buildHappyWorkbook(), SATURDAY)

  it('parsea todos los partidos de todas las hojas', () => {
    expect(result.matches).toHaveLength(13)
    expect(result.matches.filter((m) => m.sheet === 'SABADO')).toHaveLength(4)
    expect(result.matches.filter((m) => m.sheet === 'DOMINGO')).toHaveLength(1)
    expect(result.matches.filter((m) => m.sheet === 'ENTRE SEMANA')).toHaveLength(3)
    expect(result.matches.filter((m) => m.sheet === 'MOSTOLES')).toHaveLength(3)
    expect(result.matches.filter((m) => m.sheet === 'ARANJUEZ')).toHaveLength(2)
  })

  it('solo genera el warning informativo de SANCIONADOS', () => {
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('SANCIONADOS')
  })

  it('separa pabellon y pista con sufijo " - N" y detecta pista implicita', () => {
    const sabado = result.matches.filter((m) => m.sheet === 'SABADO')
    const central = sabado.filter((m) => m.venueName === 'PABELLON CENTRAL')
    expect(central.map((m) => m.courtName).sort()).toEqual(['1', '1', '2'])
    const sur = sabado.find((m) => m.venueName === 'POLIDEPORTIVO SUR')
    expect(sur?.courtName).toBeNull()
  })

  it('procesa las dos bandas de mini-tablas en paralelo de forma independiente', () => {
    const banda2 = result.matches.find((m) => m.homeTeam === 'EQUIPO GAMO')
    expect(banda2).toMatchObject({
      venueName: 'PABELLON CENTRAL',
      courtName: '2',
      time: '10:15',
      category: 'JUV F',
      group: '2',
      district: 'NORTE',
    })
  })

  it('asigna saturdayDate a SABADO y saturdayDate+1 a DOMINGO', () => {
    for (const m of result.matches.filter((m) => m.sheet === 'SABADO')) {
      expect(m.date).toBe(SATURDAY)
    }
    for (const m of result.matches.filter((m) => m.sheet === 'DOMINGO')) {
      expect(m.date).toBe(SUNDAY)
    }
  })

  it('normaliza horas de texto y numericas Excel a HH:MM', () => {
    const lince = result.matches.find((m) => m.homeTeam === 'EQUIPO LINCE')
    expect(lince?.time).toBe('09:00')
    const buho = result.matches.find((m) => m.homeTeam === 'EQUIPO BUHO')
    expect(buho?.time).toBe('12:00')
  })

  it('infiere la columna DISTRITO cuando la celda de cabecera esta vacia', () => {
    const domingo = result.matches.find((m) => m.sheet === 'DOMINGO')
    expect(domingo).toMatchObject({
      district: 'RIBERA',
      venueName: 'PABELLON DEL RIO',
      courtName: '3',
    })
  })

  it('satelite con ARBITRO 1 | ARBITRO 2 → refereesNeeded 2; con ARBITRO → 1', () => {
    for (const m of result.matches.filter((m) => m.sheet === 'MOSTOLES')) {
      expect(m.refereesNeeded).toBe(2)
    }
    for (const m of result.matches.filter((m) => m.sheet === 'ARANJUEZ')) {
      expect(m.refereesNeeded).toBe(1)
    }
    // Hojas estandar: una sola columna ARBITRO
    for (const m of result.matches.filter((m) => m.sheet === 'SABADO')) {
      expect(m.refereesNeeded).toBe(1)
    }
  })

  it('satelite: zonas como pista, dias propios y nombre de hoja como distrito', () => {
    const mostoles = result.matches.filter((m) => m.sheet === 'MOSTOLES')
    const zonaA = mostoles.filter((m) => m.courtName === 'ZONA "A"')
    expect(zonaA).toHaveLength(2)
    expect(zonaA.every((m) => m.date === SATURDAY)).toBe(true)
    const zonaB = mostoles.find((m) => m.courtName === 'ZONA "B"')
    expect(zonaB?.date).toBe(SUNDAY)
    expect(mostoles.every((m) => m.venueName === 'POLIDEPORTIVO DEL OESTE')).toBe(true)
    expect(mostoles.every((m) => m.district === 'MOSTOLES')).toBe(true)
    expect(mostoles.every((m) => m.group === '')).toBe(true)
  })

  it('satelite ARANJUEZ: pabellon en la columna-hueco compartido por ambas bandas', () => {
    const aranjuez = result.matches.filter((m) => m.sheet === 'ARANJUEZ')
    expect(aranjuez.every((m) => m.venueName === 'POLIDEPORTIVO GRANDE')).toBe(true)
    expect(aranjuez.map((m) => m.courtName).sort()).toEqual(['PISTA - 1', 'PISTA - 2'])
  })

  it('parsea la hoja CAMPOS con el typo real de OBSERVAVIONES', () => {
    expect(result.camposVenues).toHaveLength(3)
    expect(result.camposVenues[0]).toEqual({
      district: 'NORTE',
      name: 'PABELLON CENTRAL',
      address: 'CALLE UNO, 1',
      metro: 'ESTACION NORTE',
      bus: '10,20',
      observations: '',
    })
    expect(result.camposVenues[1]).toMatchObject({
      name: 'POLIDEPORTIVO SUR',
      metro: '',
      bus: '',
      observations: 'CERRADO EN AGOSTO',
    })
  })
})

describe('parseJornadaWorkbook — mapeo de fechas de ENTRE SEMANA', () => {
  it('fecha explicita gana, incluso anterior al fin de semana (patron fichero real)', () => {
    const result = parseJornadaWorkbook(buildHappyWorkbook(), SATURDAY)
    const entre = result.matches.filter((m) => m.sheet === 'ENTRE SEMANA')
    expect(entre.find((m) => m.homeTeam === 'EQUIPO ROBLE')?.date).toBe('2026-03-17') // Martes 17 Marzo
    expect(entre.find((m) => m.homeTeam === 'EQUIPO HAYA')?.date).toBe('2026-03-12') // Jueves 12 Marzo
  })

  it('solo nombre de dia → fecha unica dentro de la ventana viernes→jueves', () => {
    const result = parseJornadaWorkbook(buildHappyWorkbook(), SATURDAY)
    const entre = result.matches.filter((m) => m.sheet === 'ENTRE SEMANA')
    // "Miercoles" (sin tilde, sin fecha) → miercoles posterior al sabado
    expect(entre.find((m) => m.homeTeam === 'EQUIPO PINO')?.date).toBe('2026-03-18')
  })

  it('cubre los limites de la ventana: viernes anterior y jueves posterior', () => {
    const wb = XLSX.utils.book_new()
    const rows: unknown[][] = [
      [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'Viernes',
      ],
      [null, null, null, null, 'COLEGIO A'],
      ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
      ['18:00', 'INF M', '1', 'X', 'EQUIPO UNO', 'EQUIPO DOS', 'AR', 'AN'],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'Lunes'],
      [null, null, null, null, 'COLEGIO B'],
      ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
      ['18:00', 'INF M', '1', 'X', 'EQUIPO TRES', 'EQUIPO CUATRO', 'AR', 'AN'],
      [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'Jueves',
      ],
      [null, null, null, null, 'COLEGIO C'],
      ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
      ['18:00', 'INF M', '1', 'X', 'EQUIPO CINCO', 'EQUIPO SEIS', 'AR', 'AN'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'ENTRE SEMANA')
    const result = parseJornadaWorkbook(wb, SATURDAY)
    expect(result.matches.map((m) => m.date)).toEqual(['2026-03-13', '2026-03-16', '2026-03-19'])
    expect(result.warnings).toHaveLength(0)
  })
})

describe('parseJornadaWorkbook — robustez ante filas corruptas', () => {
  function buildCorruptWorkbook(): XLSX.WorkBook {
    const wb = XLSX.utils.book_new()
    const sabado: unknown[][] = [
      // Fila de partido antes de cualquier cabecera → datos no reconocidos
      ['10:00', 'SEN M', '1', 'X', 'EQUIPO HURON', 'EQUIPO VISON', 'AR', 'AN'],
      [null, null, null, null, 'PABELLON ROTO'],
      ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
      // Hora sin visitante
      ['10:00', 'SEN M', '1', 'X', 'EQUIPO LOBO', null, 'AR', 'AN'],
      // Hora invalida
      ['99:99', 'SEN M', '1', 'X', 'EQUIPO OSO', 'EQUIPO LINCE', 'AR', 'AN'],
      // Fila valida
      ['11:00', 'SEN M', '1', 'X', 'EQUIPO OSO', 'EQUIPO LINCE', 'AR', 'AN'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sabado), 'SABADO')
    // Partido sin etiqueta de pabellon previa
    const domingo: unknown[][] = [
      ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
      ['9:00', 'SEN F', '1', 'X', 'EQUIPO FOCA', 'EQUIPO MORSA', 'AR', 'AN'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(domingo), 'DOMINGO')
    // ENTRE SEMANA sin cabecera de dia → partido sin fecha
    const entreSemana: unknown[][] = [
      [null, null, null, null, 'COLEGIO PERDIDO'],
      ['H', 'CAT', 'GR.', 'DISTRITO', 'LOCAL', 'VISITANTE', 'ARBITRO', 'ANOT.'],
      ['18:00', 'INF M', '1', 'X', 'EQUIPO TRUCHA', 'EQUIPO SALMON', 'AR', 'AN'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(entreSemana), 'ENTRE SEMANA')
    return wb
  }

  it('no lanza excepcion y acumula warnings por cada fila descartada', () => {
    let result: ReturnType<typeof parseJornadaWorkbook> | undefined
    expect(() => {
      result = parseJornadaWorkbook(buildCorruptWorkbook(), SATURDAY)
    }).not.toThrow()
    expect(result!.matches).toHaveLength(1)
    expect(result!.matches[0]).toMatchObject({
      homeTeam: 'EQUIPO OSO',
      venueName: 'PABELLON ROTO',
      time: '11:00',
    })
    expect(result!.warnings.length).toBeGreaterThanOrEqual(5)
    expect(result!.warnings.some((w) => w.includes('sin equipos completos'))).toBe(true)
    expect(result!.warnings.some((w) => w.includes('sin pabellón'))).toBe(true)
    expect(result!.warnings.some((w) => w.includes('sin cabecera de día'))).toBe(true)
    expect(result!.warnings.some((w) => w.includes('no reconocidos'))).toBe(true)
  })

  it('fecha de sabado invalida → resultado vacio con warning, sin excepcion', () => {
    const result = parseJornadaWorkbook(buildHappyWorkbook(), 'no-es-fecha')
    expect(result.matches).toHaveLength(0)
    expect(result.camposVenues).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes('inválida'))).toBe(true)
  })

  it('hoja desconocida → warning y se ignora', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['cualquier', 'cosa']]), 'MISTERIOSA')
    const result = parseJornadaWorkbook(wb, SATURDAY)
    expect(result.matches).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes('MISTERIOSA'))).toBe(true)
  })
})
