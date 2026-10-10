import { describe, expect, it } from 'vitest'
import { buildReport, reportRangeProblem, type ReportInput, type ReportWorkout } from './report'
import type { ExerciseDef, SetEntry, WorkoutExercise } from './types'

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    order: 0,
    type: 'normal',
    weightKg: null,
    reps: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    completed: true,
    ...partial,
  }
}

function exercise(partial: Partial<WorkoutExercise> & { sets: SetEntry[] }): WorkoutExercise {
  return {
    exerciseId: 'bench',
    exerciseName: 'Press banca',
    muscle: 'chest',
    measurement: 'weight_reps',
    usesBodyweight: false,
    order: 0,
    slotIndex: null,
    swappedFrom: null,
    restSeconds: null,
    notes: null,
    ...partial,
  }
}

function workout(partial: Partial<ReportWorkout> & { dateKey: string }): ReportWorkout {
  return {
    name: 'Empuje',
    startedAt: { toMillis: () => 0 },
    durationSeconds: 3600,
    bodyWeightKg: 80,
    notes: null,
    exercises: [],
    prDetails: null,
    ...partial,
  }
}

const bench: ExerciseDef = {
  id: 'bench',
  name: 'Press banca con barra',
  muscle: 'chest',
  secondaryMuscles: ['triceps', 'shoulders'],
  equipment: 'barbell',
  movement: 'horizontal_press',
  measurement: 'weight_reps',
}

const defs = new Map<string, ExerciseDef>([[bench.id, bench]])

/** Mondays for a fixed September 2026 calendar (the 14th is a Monday). */
function mondayOf(dateKey: string): string {
  const day = Number(dateKey.slice(8))
  const monday = day - ((day - 14 + 700) % 7)
  return `2026-09-${String(monday).padStart(2, '0')}`
}
function sundayOf(weekStart: string): string {
  return `2026-09-${String(Number(weekStart.slice(8)) + 6).padStart(2, '0')}`
}

function input(partial: Partial<ReportInput>): ReportInput {
  return {
    workouts: [],
    fromKey: '2026-09-01',
    toKey: '2026-09-30',
    sections: ['sessions', 'weekly', 'progression'],
    formula: 'epley',
    bodyWeightKg: 82,
    resolveDef: (id) => defs.get(id),
    weekStartKeyOf: mondayOf,
    weekEndKeyOf: sundayOf,
    ...partial,
  }
}

describe('buildReport · rango', () => {
  it('incluye solo las sesiones dentro del rango (ambos extremos inclusive)', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({ dateKey: '2026-08-31' }),
          workout({ dateKey: '2026-09-01' }),
          workout({ dateKey: '2026-09-30' }),
          workout({ dateKey: '2026-10-01' }),
        ],
      }),
    )
    expect(r.range.sessions).toBe(2)
    expect(r.sessions?.map((s) => s.dateKey)).toEqual(['2026-09-01', '2026-09-30'])
  })

  it('ordena las sesiones ascendentemente por fecha y hora de inicio', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({ dateKey: '2026-09-15', startedAt: { toMillis: () => 20 }, name: 'tarde' }),
          workout({ dateKey: '2026-09-15', startedAt: { toMillis: () => 10 }, name: 'mañana' }),
          workout({ dateKey: '2026-09-14', name: 'ayer' }),
        ],
      }),
    )
    expect(r.sessions?.map((s) => s.name)).toEqual(['ayer', 'mañana', 'tarde'])
  })

  it('cuenta los días del rango de forma inclusiva', () => {
    const r = buildReport(input({ fromKey: '2026-09-12', toKey: '2026-10-10' }))
    expect(r.range.days).toBe(29)
    expect(buildReport(input({ fromKey: '2026-09-12', toKey: '2026-09-12' })).range.days).toBe(1)
  })

  it('devuelve null en las secciones no pedidas', () => {
    const r = buildReport(input({ sections: [] }))
    expect(r.sessions).toBeNull()
    expect(r.weeks).toBeNull()
    expect(r.progression).toBeNull()
  })

  it('copia el peso corporal y la fórmula de los ajustes', () => {
    const r = buildReport(input({ bodyWeightKg: 82, formula: 'brzycki' }))
    expect(r.bodyWeightKg).toBe(82)
    expect(r.formula).toBe('brzycki')
  })
})

describe('buildReport · glosario', () => {
  it('lista cada ejercicio una vez, ordenado por nombre, con sus datos del catálogo', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ sets: [set({ weightKg: 80, reps: 5 })] }),
              exercise({ order: 1, sets: [set({ weightKg: 80, reps: 5 })] }),
            ],
          }),
          workout({
            dateKey: '2026-09-16',
            exercises: [exercise({ sets: [set({ weightKg: 80, reps: 5 })] })],
          }),
        ],
      }),
    )
    expect(r.exercises).toEqual([
      {
        exerciseId: 'bench',
        name: 'Press banca con barra',
        muscle: 'chest',
        secondaryMuscles: ['triceps', 'shoulders'],
        equipment: 'barbell',
        measurement: 'weight_reps',
        custom: false,
      },
    ])
  })

  it('marca los ejercicios personalizados y usa [] si no tienen secundarios', () => {
    const custom: ExerciseDef = { ...bench, id: 'mine', name: 'Mi curl', custom: true }
    delete custom.secondaryMuscles
    const r = buildReport(
      input({
        resolveDef: (id) => (id === 'mine' ? custom : undefined),
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [exercise({ exerciseId: 'mine', exerciseName: 'Mi curl', sets: [] })],
          }),
        ],
      }),
    )
    expect(r.exercises[0]).toMatchObject({ name: 'Mi curl', custom: true, secondaryMuscles: [] })
  })

  it('sin definición, usa la copia del entrenamiento y marca los secundarios como desconocidos', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                exerciseId: 'gone',
                exerciseName: 'Curl raro',
                muscle: 'biceps',
                sets: [],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.exercises[0]).toEqual({
      exerciseId: 'gone',
      name: 'Curl raro',
      muscle: 'biceps',
      secondaryMuscles: null,
      equipment: null,
      measurement: 'weight_reps',
      custom: false,
    })
  })

  it('ordena por nombre con localeCompare', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ exerciseId: 'z', exerciseName: 'Zancadas', sets: [] }),
              exercise({ exerciseId: 'a', exerciseName: 'Ábdominales', order: 1, sets: [] }),
            ],
          }),
        ],
      }),
    )
    expect(r.exercises.map((e) => e.name)).toEqual(['Ábdominales', 'Zancadas'])
  })
})

describe('buildReport · sesiones', () => {
  it('lista todas las series (calentamientos incluidos) pero solo cuenta las efectivas', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                restSeconds: 120,
                notes: 'hombro molesto',
                sets: [
                  set({ order: 0, type: 'warmup', weightKg: 40, reps: 10 }),
                  set({ order: 1, weightKg: 80, reps: 6, rpe: 8 }),
                  set({ order: 2, type: 'failure', weightKg: 80, reps: 5 }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    const s = r.sessions![0]
    expect(s.workingSets).toBe(2)
    expect(s.volumeKg).toBe(80 * 6 + 80 * 5)
    expect(s.exercises[0]).toMatchObject({
      name: 'Press banca con barra',
      restSeconds: 120,
      notes: 'hombro molesto',
    })
    expect(s.exercises[0].sets).toEqual([
      {
        position: 1,
        type: 'warmup',
        weightKg: 40,
        reps: 10,
        durationSeconds: null,
        distanceMeters: null,
        rpe: null,
      },
      {
        position: 2,
        type: 'normal',
        weightKg: 80,
        reps: 6,
        durationSeconds: null,
        distanceMeters: null,
        rpe: 8,
      },
      {
        position: 3,
        type: 'failure',
        weightKg: 80,
        reps: 5,
        durationSeconds: null,
        distanceMeters: null,
        rpe: null,
      },
    ])
  })

  it('ordena ejercicios y series por `order`, no por posición en el array', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                exerciseId: 'b',
                exerciseName: 'B',
                order: 5,
                sets: [set({ order: 3, reps: 3 }), set({ order: 1, reps: 1 })],
              }),
              exercise({ exerciseId: 'a', exerciseName: 'A', order: 2, sets: [] }),
            ],
          }),
        ],
      }),
    )
    const s = r.sessions![0]
    expect(s.exercises.map((e) => e.name)).toEqual(['A', 'B'])
    expect(s.exercises[1].sets.map((x) => x.reps)).toEqual([1, 3])
    expect(s.exercises[1].sets.map((x) => x.position)).toEqual([1, 2])
  })

  it('usa el peso corporal de la sesión para el volumen de ejercicios a peso corporal', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            bodyWeightKg: 80,
            exercises: [
              exercise({
                exerciseId: 'dips',
                exerciseName: 'Fondos',
                measurement: 'reps_only',
                usesBodyweight: true,
                sets: [set({ weightKg: 10, reps: 10 })],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.sessions![0].volumeKg).toBe(900)
  })

  it('agrupa los récords de la sesión por ejercicio con la fórmula del usuario', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            prDetails: [
              {
                exerciseId: 'bench',
                exerciseName: 'Press banca',
                type: 'best1RmEpley',
                value: 96,
                previousValue: 94,
              },
              {
                exerciseId: 'bench',
                exerciseName: 'Press banca',
                type: 'best1RmBrzycki',
                value: 95,
                previousValue: 93,
              },
              {
                exerciseId: 'bench',
                exerciseName: 'Press banca',
                type: 'heaviestWeightKg',
                value: 82.5,
                previousValue: null,
              },
            ],
          }),
        ],
      }),
    )
    expect(r.sessions![0].prs).toEqual([
      {
        exerciseId: 'bench',
        exerciseName: 'Press banca',
        rows: [
          { display: 'best1Rm', value: 96, previousValue: 94 },
          { display: 'heaviestWeight', value: 82.5, previousValue: null },
        ],
      },
    ])
  })

  it('sin prDetails (docs antiguos) devuelve una lista vacía', () => {
    const r = buildReport(
      input({ workouts: [workout({ dateKey: '2026-09-14', prDetails: null })] }),
    )
    expect(r.sessions![0].prs).toEqual([])
  })
})

describe('buildReport · resumen semanal', () => {
  it('agrupa por semana (lunes inyectado), ascendente, solo semanas con sesiones', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-22',
            exercises: [exercise({ sets: [set({ weightKg: 100, reps: 5 })] })],
          }),
          workout({
            dateKey: '2026-09-14',
            exercises: [exercise({ sets: [set({ weightKg: 80, reps: 5 })] })],
          }),
          workout({
            dateKey: '2026-09-16',
            exercises: [
              exercise({
                sets: [set({ weightKg: 80, reps: 5 }), set({ order: 1, weightKg: 80, reps: 5 })],
              }),
            ],
          }),
        ],
      }),
    )
    expect(
      r.weeks?.map((w) => [w.weekStartKey, w.weekEndKey, w.sessions, w.workingSets, w.volumeKg]),
    ).toEqual([
      ['2026-09-14', '2026-09-20', 2, 3, 1200],
      ['2026-09-21', '2026-09-27', 1, 1, 500],
    ])
  })

  it('desglosa series directas e indirectas (×0,5) por músculo, total descendente', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                sets: [set({ weightKg: 80, reps: 5 }), set({ order: 1, weightKg: 80, reps: 5 })],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.weeks![0].muscles).toEqual([
      { muscle: 'chest', direct: 2, indirect: 0 },
      { muscle: 'shoulders', direct: 0, indirect: 1 },
      { muscle: 'triceps', direct: 0, indirect: 1 },
    ])
  })

  it('calcula equilibrio y rangos de repeticiones sin contar calentamientos', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                sets: [
                  set({ type: 'warmup', weightKg: 40, reps: 10 }),
                  set({ order: 1, weightKg: 100, reps: 3 }),
                  set({ order: 2, weightKg: 80, reps: 8 }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.weeks![0].balance).toEqual({ push: 2, pull: 0, legs: 0, core: 0 })
    expect(r.weeks![0].repRanges).toEqual({ strength: 1, hypertrophy: 1, endurance: 0 })
  })
})

describe('buildReport · progresión 1RM', () => {
  function benchDay(dateKey: string, weightKg: number, reps: number) {
    return workout({
      dateKey,
      exercises: [exercise({ sets: [set({ weightKg, reps })] })],
    })
  }

  it('excluye ejercicios con menos sesiones que el mínimo', () => {
    const four = ['14', '15', '16', '17'].map((d) => benchDay(`2026-09-${d}`, 80, 5))
    expect(buildReport(input({ workouts: four })).progression).toEqual([])
    const five = [...four, benchDay('2026-09-18', 80, 5)]
    expect(buildReport(input({ workouts: five })).progression).toHaveLength(1)
  })

  it('respeta minProgressionSessions', () => {
    const two = ['14', '15'].map((d) => benchDay(`2026-09-${d}`, 80, 5))
    expect(
      buildReport(input({ workouts: two, minProgressionSessions: 2 })).progression,
    ).toHaveLength(1)
  })

  it('un punto por sesión: el mejor 1RM y la serie que lo produce, fechas ascendentes', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        workouts: [
          workout({
            dateKey: '2026-09-16',
            exercises: [
              exercise({
                sets: [
                  set({ type: 'warmup', weightKg: 100, reps: 10 }),
                  set({ order: 1, weightKg: 80, reps: 6 }),
                  set({ order: 2, weightKg: 85, reps: 3 }),
                ],
              }),
            ],
          }),
          benchDay('2026-09-14', 80, 5),
        ],
      }),
    )
    expect(r.progression).toEqual([
      {
        exerciseId: 'bench',
        name: 'Press banca con barra',
        points: [
          { dateKey: '2026-09-14', oneRm: 80 * (1 + 5 / 30), weightKg: 80, reps: 5 },
          { dateKey: '2026-09-16', oneRm: 80 * (1 + 6 / 30), weightKg: 80, reps: 6 },
        ],
      },
    ])
  })

  it('fusiona dos apariciones del mismo ejercicio en una sesión', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ sets: [set({ weightKg: 80, reps: 5 })] }),
              exercise({ order: 1, sets: [set({ weightKg: 90, reps: 5 })] }),
            ],
          }),
        ],
      }),
    )
    expect(r.progression![0].points).toEqual([
      { dateKey: '2026-09-14', oneRm: 90 * (1 + 5 / 30), weightKg: 90, reps: 5 },
    ])
  })

  it('ignora ejercicios que no son de peso y repeticiones (peso corporal incluido)', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                exerciseId: 'dips',
                exerciseName: 'Fondos',
                measurement: 'reps_only',
                usesBodyweight: true,
                sets: [set({ weightKg: 10, reps: 10 })],
              }),
              exercise({
                exerciseId: 'plank',
                exerciseName: 'Plancha',
                measurement: 'time_only',
                order: 1,
                sets: [set({ durationSeconds: 60 })],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.progression).toEqual([])
  })

  it('usa la fórmula pedida', () => {
    const r = buildReport(
      input({
        formula: 'brzycki',
        minProgressionSessions: 1,
        workouts: [benchDay('2026-09-14', 80, 5)],
      }),
    )
    expect(r.progression![0].points[0].oneRm).toBeCloseTo((80 * 36) / (37 - 5))
  })

  it('ordena los ejercicios por nombre', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                exerciseId: 's',
                exerciseName: 'Sentadilla',
                sets: [set({ weightKg: 100, reps: 5 })],
              }),
              exercise({
                exerciseId: 'c',
                exerciseName: 'Curl',
                order: 1,
                sets: [set({ weightKg: 20, reps: 10 })],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.progression!.map((p) => p.name)).toEqual(['Curl', 'Sentadilla'])
  })
})

describe('reportRangeProblem', () => {
  const today = '2026-10-10'

  it('acepta un rango con fin hoy o antes y inicio no posterior al fin', () => {
    expect(reportRangeProblem('2026-09-12', '2026-10-10', today)).toBeNull()
    expect(reportRangeProblem('2026-10-10', '2026-10-10', today)).toBeNull()
  })

  it('detecta fechas vacías', () => {
    expect(reportRangeProblem('', '2026-10-10', today)).toBe('empty')
    expect(reportRangeProblem('2026-09-12', '', today)).toBe('empty')
  })

  it('detecta un inicio posterior al fin', () => {
    expect(reportRangeProblem('2026-10-09', '2026-10-01', today)).toBe('inverted')
  })

  it('detecta un fin posterior a hoy (el max del input no impide teclearlo)', () => {
    expect(reportRangeProblem('2026-09-12', '2027-01-01', today)).toBe('future')
    expect(reportRangeProblem('2026-10-11', '2026-10-12', today)).toBe('future')
  })
})
