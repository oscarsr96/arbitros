import { describe, it, expect } from 'vitest'
import { synthesizeSchedules, type SchedulableMatch } from '../synthesize-schedule'
import { SCHEDULE_BY_BASES_CATEGORY, type BasesCategory } from '../bases-fbm'
import { timeToMinutes } from '@/lib/overlap'

function build(overrides: Partial<SchedulableMatch> & { id: string }): SchedulableMatch {
  return {
    date: '2026-03-14',
    venueId: 'venue-A',
    realTime: null,
    basesCategory: 'junior_preferente', // franja general 09:00-20:30
    ...overrides,
  }
}

/** Horas asignadas, en el orden en que se pasaron los partidos. */
function timesOf(matches: SchedulableMatch[]): string[] {
  const { times } = synthesizeSchedules(matches)
  return matches.map((m) => times.get(m.id)?.time ?? '(sin hora)')
}

describe('synthesizeSchedules', () => {
  it('escalona en bloque consecutivo de 90 min dentro de la franja', () => {
    const matches = [build({ id: 'm-1' }), build({ id: 'm-2' }), build({ id: 'm-3' })]
    const { times, stats } = synthesizeSchedules(matches)

    const mins = matches.map((m) => timeToMinutes(times.get(m.id)!.time))
    expect(mins[1] - mins[0]).toBe(90)
    expect(mins[2] - mins[1]).toBe(90)
    expect(mins[0]).toBeGreaterThanOrEqual(timeToMinutes('09:00'))
    // El bloque entero cabe en la franja: el último no pasa de las 20:30.
    expect(mins[2]).toBeLessThanOrEqual(timeToMinutes('20:30'))
    expect(matches.every((m) => times.get(m.id)!.timeIsEstimated)).toBe(true)

    expect(stats.synthesizedTimes).toBe(3)
    expect(stats.realTimes).toBe(0)
    expect(stats.venueDaysWithParallelTracks).toBe(0)
  })

  // Sin desplazamiento por pabellón-día, los 4.434 pabellón-día de un solo
  // partido de la temporada arrancarían TODOS a las 09:00 (8.142 partidos
  // simultáneos), que no se parece a las horas reales del CSV ni deja medir
  // cobertura.
  it('reparte el inicio entre pabellón-día en vez de anclarlos todos a las 09:00', () => {
    const starts = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const { times } = synthesizeSchedules([build({ id: 'm-1', venueId: `venue-${i}` })])
      starts.add(times.get('m-1')!.time)
    }
    // Los 8 slots de la franja general quedan representados.
    expect(starts.size).toBe(8)
  })

  it('preserva la hora real del CSV y la marca como no estimada', () => {
    const { times, stats } = synthesizeSchedules([build({ id: 'm-1', realTime: '18:45' })])

    expect(times.get('m-1')).toEqual({ time: '18:45', timeIsEstimated: false })
    expect(stats.realTimes).toBe(1)
    expect(stats.synthesizedTimes).toBe(0)
  })

  it('la hora real ocupa slot: las sintetizadas la esquivan en vez de solaparla', () => {
    // Grupo lleno (8 partidos para los 8 slots de la franja) → sin margen de
    // desplazamiento, el reparto arranca en 09:00 y las horas son literales.
    // El partido real de 10:00 ocupa [10:00, 11:30), que pisa los slots de
    // rejilla 09:00 y 10:30: en la primera pista solo quedan 6 huecos y el
    // séptimo sintetizado abre pista paralela.
    const matches = [
      build({ id: 'm-0-real', realTime: '10:00' }),
      ...Array.from({ length: 7 }, (_, i) => build({ id: `m-${i + 1}` })),
    ]
    expect(timesOf(matches)).toEqual([
      '10:00',
      '12:00',
      '13:30',
      '15:00',
      '16:30',
      '18:00',
      '19:30',
      '09:00',
    ])
  })

  it('agrupa por pabellón Y fecha: grupos distintos no comparten slots', () => {
    // Cambiar de pabellón o de fecha abre un grupo nuevo: cada uno se programa
    // por su cuenta, igual que si estuviera solo. Que dos grupos coincidan en
    // hora es legítimo (son pabellones distintos).
    const otherVenue = build({ id: 'm-3', venueId: 'venue-B', date: '2026-03-14' })
    const otherDate = build({ id: 'm-4', venueId: 'venue-A', date: '2026-03-15' })
    const matches = [
      build({ id: 'm-1', venueId: 'venue-A', date: '2026-03-14' }),
      build({ id: 'm-2', venueId: 'venue-A', date: '2026-03-14' }),
      otherVenue,
      otherDate,
    ]

    const [a1, a2, b1, c1] = timesOf(matches)
    expect(timeToMinutes(a2) - timeToMinutes(a1)).toBe(90) // mismo grupo → escalonados
    expect(b1).toBe(timesOf([otherVenue])[0]) // otro pabellón → programado aparte
    expect(c1).toBe(timesOf([otherDate])[0]) // otra fecha → programado aparte
  })

  it('respeta la franja de cada categoría y programa antes la más estrecha', () => {
    // Minibasket cierra a las 18:30 (7 slots), la general a las 20:30 (8). Con
    // 7 partidos el grupo llena la franja estrecha → desplazamiento 0.
    // El minibasket entra primero (más restringido) y se queda la mañana.
    const matches = [
      build({ id: 'm-general', basesCategory: 'junior_preferente' }),
      build({ id: 'm-mini', basesCategory: 'minibasket' }),
      ...Array.from({ length: 5 }, (_, i) => build({ id: `m-z${i}` })),
    ]
    const [general, mini] = timesOf(matches)
    expect(mini).toBe('09:00')
    expect(general).toBe('10:30')
  })

  it('caso límite minibasket: ningún partido pasa del borde de las 18:30', () => {
    // 8 partidos minibasket contra una franja 09:00-18:30 que solo da 7 slots.
    const matches = Array.from({ length: 8 }, (_, i) =>
      build({ id: `m-${i}`, basesCategory: 'minibasket' }),
    )
    const { times, stats } = synthesizeSchedules(matches)

    const end = timeToMinutes('18:30')
    for (const m of matches) {
      expect(timeToMinutes(times.get(m.id)!.time)).toBeLessThanOrEqual(end)
    }
    // Los 7 slots de la franja y el 8º repitiendo 09:00 en pista paralela.
    expect(matches.map((m) => times.get(m.id)!.time)).toEqual([
      '09:00',
      '10:30',
      '12:00',
      '13:30',
      '15:00',
      '16:30',
      '18:00',
      '09:00',
    ])
    expect(stats.maxParallelTracks).toBe(2)
    expect(stats.matchesOnParallelTracks).toBe(1)
  })

  it('caso límite pabellón saturado: abre pista paralela sin salirse de la franja', () => {
    // 17 partidos en una franja de 8 slots → 3 pistas (8 + 8 + 1).
    const matches = Array.from({ length: 17 }, (_, i) =>
      build({ id: `m-${String(i).padStart(2, '0')}` }),
    )
    const { times, stats } = synthesizeSchedules(matches)

    const start = timeToMinutes('09:00')
    const end = timeToMinutes('20:30')
    for (const m of matches) {
      const min = timeToMinutes(times.get(m.id)!.time)
      expect(min).toBeGreaterThanOrEqual(start)
      expect(min).toBeLessThanOrEqual(end)
    }

    expect(stats.venueDaysWithParallelTracks).toBe(1)
    expect(stats.maxParallelTracks).toBe(3)
    expect(stats.matchesOnParallelTracks).toBe(9)

    // Cada slot de la rejilla se usa como mucho una vez por pista: 8 slots × 3
    // pistas, con el último slot ocupado una sola vez.
    const counts = new Map<string, number>()
    for (const m of matches) {
      const t = times.get(m.id)!.time
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    expect(counts.get('09:00')).toBe(3)
    expect(Math.max(...counts.values())).toBe(3)
  })

  it('categoría sin fila en la Tabla B usa la franja general por defecto', () => {
    // `liga_universitaria` es la única con horario null en las Bases.
    expect(SCHEDULE_BY_BASES_CATEGORY.liga_universitaria).toBeNull()

    // Misma franja general que una categoría con fila: mismo pabellón-día y
    // mismo id ⇒ misma hora que la de referencia.
    const reference = timesOf([build({ id: 'm-1', basesCategory: 'junior_preferente' })])
    expect(timesOf([build({ id: 'm-1', basesCategory: 'liga_universitaria' })])).toEqual(reference)
    expect(timesOf([build({ id: 'm-1', basesCategory: null })])).toEqual(reference)
  })

  it('es determinista: el mismo input produce el mismo output', () => {
    const matches = Array.from({ length: 40 }, (_, i) =>
      build({
        id: `m-${String(i).padStart(2, '0')}`,
        venueId: `venue-${i % 3}`,
        basesCategory: (i % 2 === 0 ? 'minibasket' : 'junior_preferente') as BasesCategory,
        realTime: i % 7 === 0 ? '11:15' : null,
      }),
    )

    const a = JSON.stringify([...synthesizeSchedules(matches).times.entries()].sort())
    const b = JSON.stringify([...synthesizeSchedules(matches).times.entries()].sort())
    expect(a).toBe(b)
  })

  it('es estable ante el orden de entrada: el reparto depende del id, no del orden', () => {
    const matches = Array.from({ length: 12 }, (_, i) =>
      build({ id: `m-${String(i).padStart(2, '0')}` }),
    )
    const shuffled = [...matches].reverse()

    const straight = synthesizeSchedules(matches).times
    const reversed = synthesizeSchedules(shuffled).times
    for (const m of matches) {
      expect(reversed.get(m.id)).toEqual(straight.get(m.id))
    }
  })

  it('ninguna pista tiene dos partidos solapados (invariante sobre un caso mixto)', () => {
    const matches = [
      ...Array.from({ length: 10 }, (_, i) => build({ id: `s-${i}` })),
      build({ id: 'r-1', realTime: '12:15' }),
      build({ id: 'r-2', realTime: '12:15' }),
    ]
    const { times, stats } = synthesizeSchedules(matches)

    // Con 12 partidos y 8 slots hay solapes entre pistas por construcción; lo
    // que se comprueba es que ningún instante acumula más partidos simultáneos
    // que pistas abiertas.
    const starts = matches.map((m) => timeToMinutes(times.get(m.id)!.time))
    for (const t of starts) {
      const simultaneous = starts.filter((s) => s < t + 90 && t < s + 90).length
      expect(simultaneous).toBeLessThanOrEqual(stats.maxParallelTracks)
    }
  })
})
