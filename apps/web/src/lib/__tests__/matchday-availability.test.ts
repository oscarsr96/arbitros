import { describe, it, expect, afterEach } from 'vitest'
import {
  materializeToSlots,
  getMatchdaySlotFootprint,
  getJornadaSaturdayForDate,
} from '../matchday-availability'
import { mockAvailabilities, isPersonAvailable } from '../mock-data'
import type { MatchdayAvailability } from '../mock-data'

// Sabado de referencia (mismo usado en availability-deadline.test.ts / solver.test.ts)
const SATURDAY = '2025-03-15'

describe('materializeToSlots', () => {
  it('registro completo (sabado manana+tarde, domingo manana+tarde, lunes..viernes) -> slots exactos', () => {
    const record: MatchdayAvailability = {
      id: 'test-record-1',
      personId: 'person-999',
      saturdayDate: SATURDAY,
      saturdayMorning: true,
      saturdayAfternoon: true,
      sundayMorning: true,
      sundayAfternoon: true,
      weekdayDays: [0, 1, 2, 3, 4], // lunes, martes, miercoles, jueves, viernes
      notes: null,
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    const slots = materializeToSlots(record)

    expect(slots).toEqual([
      // sabado 15/03 (viernes anterior + sabado + domingo -> weekStart lunes 10/03)
      {
        personId: 'person-999',
        weekStart: '2025-03-10',
        dayOfWeek: 5,
        startTime: '09:00',
        endTime: '15:30',
      },
      {
        personId: 'person-999',
        weekStart: '2025-03-10',
        dayOfWeek: 5,
        startTime: '15:30',
        endTime: '22:00',
      },
      // domingo 16/03 -> mismo weekStart que el sabado
      {
        personId: 'person-999',
        weekStart: '2025-03-10',
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '15:30',
      },
      {
        personId: 'person-999',
        weekStart: '2025-03-10',
        dayOfWeek: 6,
        startTime: '15:30',
        endTime: '22:00',
      },
      // lunes 17/03 .. jueves 20/03 -> weekStart de la semana siguiente (17/03, ya es lunes)
      {
        personId: 'person-999',
        weekStart: '2025-03-17',
        dayOfWeek: 0,
        startTime: '17:30',
        endTime: '22:00',
      },
      {
        personId: 'person-999',
        weekStart: '2025-03-17',
        dayOfWeek: 1,
        startTime: '17:30',
        endTime: '22:00',
      },
      {
        personId: 'person-999',
        weekStart: '2025-03-17',
        dayOfWeek: 2,
        startTime: '17:30',
        endTime: '22:00',
      },
      {
        personId: 'person-999',
        weekStart: '2025-03-17',
        dayOfWeek: 3,
        startTime: '17:30',
        endTime: '22:00',
      },
      // viernes 14/03 (anterior al sabado) -> mismo weekStart que el fin de semana
      {
        personId: 'person-999',
        weekStart: '2025-03-10',
        dayOfWeek: 4,
        startTime: '17:30',
        endTime: '22:00',
      },
    ])
  })

  it('jornada cuyo sabado cae a fin de mes (la semana entre-semana cruza de mes) -> weekStarts correctos', () => {
    // 2025-05-31 es sabado (77 dias == 11 semanas exactas despues de 2025-03-15)
    const record: MatchdayAvailability = {
      id: 'test-record-2',
      personId: 'person-998',
      saturdayDate: '2025-05-31',
      saturdayMorning: true,
      saturdayAfternoon: false,
      sundayMorning: false,
      sundayAfternoon: false,
      weekdayDays: [1], // martes -> cae en junio
      notes: null,
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    const slots = materializeToSlots(record)

    // sabado 31/05 -> weekStart lunes 26/05 (no cruza de mes)
    expect(slots[0]).toEqual({
      personId: 'person-998',
      weekStart: '2025-05-26',
      dayOfWeek: 5,
      startTime: '09:00',
      endTime: '15:30',
    })

    // martes de la jornada siguiente cae en junio (03/06), pero su weekStart (lunes
    // 02/06) tambien cruza a junio, aunque el sabado que origina la jornada es de mayo
    expect(slots[1]).toEqual({
      personId: 'person-998',
      weekStart: '2025-06-02',
      dayOfWeek: 1,
      startTime: '17:30',
      endTime: '22:00',
    })
  })
})

describe('getMatchdaySlotFootprint (bug 1: borrado cruzado entre jornadas vecinas)', () => {
  it('la huella de la jornada B (S=2026-08-01) no toca los dias L-J (0-3) de la jornada A (S=2026-07-25), aunque compartan weekStart 2026-07-27', () => {
    const personId = 'person-shared'
    const SATURDAY_A = '2026-07-25'
    const SATURDAY_B = '2026-08-01'

    const recordA: MatchdayAvailability = {
      id: 'jornada-a',
      personId,
      saturdayDate: SATURDAY_A,
      saturdayMorning: false,
      saturdayAfternoon: false,
      sundayMorning: false,
      sundayAfternoon: false,
      weekdayDays: [0, 1, 2, 3], // lunes..jueves siguientes -> caen en la semana del 27/07
      notes: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    // 1. Guardar jornada A: materializar e insertar sus slots en un array simulado
    let simulatedAvailabilities = materializeToSlots(recordA).map((s, i) => ({
      id: `a-${i}`,
      ...s,
    }))

    expect(simulatedAvailabilities).toHaveLength(4)
    expect(simulatedAvailabilities.every((s) => s.weekStart === '2026-07-27')).toBe(true)
    expect(simulatedAvailabilities.map((s) => s.dayOfWeek).sort()).toEqual([0, 1, 2, 3])

    // 2. Guardar jornada B para la MISMA persona: aplicar el borrado por huella de B
    // (misma logica que el POST de la ruta) y comprobar que los slots L-J de A siguen ahi
    const footprintB = getMatchdaySlotFootprint(SATURDAY_B)
    const isInFootprintB = (weekStart: string, dayOfWeek: number) =>
      footprintB.some((k) => k.weekStart === weekStart && k.dayOfWeek === dayOfWeek)

    simulatedAvailabilities = simulatedAvailabilities.filter(
      (s) => !(s.personId === personId && isInFootprintB(s.weekStart, s.dayOfWeek)),
    )

    // Los 4 slots L-J de la jornada A sobreviven: la huella de B (dias 4,5,6 en
    // weekStart 2026-07-27 + dias 0-3 en weekStart 2026-08-03) es disjunta de ellos
    expect(simulatedAvailabilities).toHaveLength(4)
    expect(simulatedAvailabilities.map((s) => s.dayOfWeek).sort()).toEqual([0, 1, 2, 3])
  })
})

describe('getJornadaSaturdayForDate (bug 2: sabado equivocado para partidos L-J)', () => {
  it('miercoles (bloque entre-semana) -> sabado de la jornada ANTERIOR', () => {
    expect(getJornadaSaturdayForDate('2026-07-29')).toBe('2026-07-25')
  })

  it('viernes (mismo fin de semana) -> sabado de esa misma semana', () => {
    expect(getJornadaSaturdayForDate('2026-07-24')).toBe('2026-07-25')
  })

  it('sabado -> el mismo dia', () => {
    expect(getJornadaSaturdayForDate('2026-07-25')).toBe('2026-07-25')
  })

  it('domingo -> sabado de esa misma jornada', () => {
    expect(getJornadaSaturdayForDate('2026-07-26')).toBe('2026-07-25')
  })
})

describe('isPersonAvailable - comparacion en minutos (fix del bug de horas enteras)', () => {
  const personId = 'test-person-minutes'

  const record: MatchdayAvailability = {
    id: 'test-record-3',
    personId,
    saturdayDate: SATURDAY,
    saturdayMorning: true,
    saturdayAfternoon: false,
    sundayMorning: false,
    sundayAfternoon: false,
    weekdayDays: [],
    notes: null,
    updatedAt: '2025-01-01T00:00:00.000Z',
  }

  const slots = materializeToSlots(record)

  afterEach(() => {
    const remaining = mockAvailabilities.filter((a) => a.personId !== personId)
    mockAvailabilities.length = 0
    mockAvailabilities.push(...remaining)
  })

  it('partido a las 15:00 con disponibilidad de manana (09:00-15:30) -> true', () => {
    mockAvailabilities.push(...slots.map((s, i) => ({ id: `test-slot-${i}`, ...s })))
    expect(isPersonAvailable(personId, SATURDAY, '15:00')).toBe(true)
  })

  it('partido a las 15:30 con solo manana marcada -> false (cae en la franja de tarde)', () => {
    mockAvailabilities.push(...slots.map((s, i) => ({ id: `test-slot-${i}`, ...s })))
    expect(isPersonAvailable(personId, SATURDAY, '15:30')).toBe(false)
  })
})
