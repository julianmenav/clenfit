import {
  muscleBalance,
  muscleSetBreakdown,
  repRangeDistribution,
  type BalanceGroup,
  type RepRange,
} from './analytics'
import { prDisplayGroups, type PrExerciseGroup } from './prDetails'
import { summarizeWorkout } from './workoutSummary'
import type {
  Equipment,
  ExerciseDef,
  Measurement,
  MuscleGroup,
  OneRmFormula,
  SetType,
  Workout,
  WorkoutExercise,
} from './types'

/* --------------------------------- Options -------------------------------- */

export type ReportSection = 'sessions' | 'weekly' | 'progression'
export const reportSections: readonly ReportSection[] = ['sessions', 'weekly', 'progression']

/** An exercise needs this many sessions in the range to get a progression block. */
export const MIN_PROGRESSION_SESSIONS = 5

/** What the report reads from a workout. `startedAt` is structural so tests need no Timestamp. */
export type ReportWorkout = Pick<
  Workout,
  'dateKey' | 'name' | 'durationSeconds' | 'bodyWeightKg' | 'notes' | 'exercises' | 'prDetails'
> & { startedAt: { toMillis(): number } }

export interface ReportInput {
  /** Any order; only those with dateKey inside [fromKey, toKey] are used. */
  workouts: ReportWorkout[]
  fromKey: string
  toKey: string
  sections: readonly ReportSection[]
  formula: OneRmFormula
  /** Current body weight from settings (each session carries its own snapshot). */
  bodyWeightKg: number | null
  resolveDef: (exerciseId: string) => ExerciseDef | undefined
  /** Injected calendar helpers: this module stays date-lib-free (see analytics.ts). */
  weekStartKeyOf: (dateKey: string) => string
  weekEndKeyOf: (weekStartKey: string) => string
  minProgressionSessions?: number
}

/* ---------------------------------- Model --------------------------------- */

export interface ReportExercise {
  exerciseId: string
  name: string
  muscle: MuscleGroup
  /** null = definition not found (deleted custom exercise). */
  secondaryMuscles: MuscleGroup[] | null
  equipment: Equipment | null
  measurement: Measurement
  custom: boolean
}

export interface ReportSet {
  /** 1-based within the exercise, warmups included. */
  position: number
  type: SetType
  weightKg: number | null
  reps: number | null
  durationSeconds: number | null
  distanceMeters: number | null
  rpe: number | null
}

export interface ReportSessionExercise {
  exerciseId: string
  name: string
  measurement: Measurement
  usesBodyweight: boolean
  restSeconds: number | null
  notes: string | null
  sets: ReportSet[]
}

export interface ReportSession {
  dateKey: string
  name: string
  durationSeconds: number | null
  bodyWeightKg: number | null
  notes: string | null
  exercises: ReportSessionExercise[]
  prs: PrExerciseGroup[]
  workingSets: number
  volumeKg: number
}

export interface ReportWeek {
  weekStartKey: string
  weekEndKey: string
  sessions: number
  workingSets: number
  volumeKg: number
  /** Only muscles with sets, total descending. */
  muscles: { muscle: MuscleGroup; direct: number; indirect: number }[]
  balance: Record<BalanceGroup, number>
  repRanges: Record<RepRange, number>
}

export interface ReportProgressionPoint {
  dateKey: string
  oneRm: number
  weightKg: number
  reps: number
}

export interface ReportProgression {
  exerciseId: string
  name: string
  points: ReportProgressionPoint[]
}

export interface Report {
  range: { fromKey: string; toKey: string; days: number; sessions: number }
  bodyWeightKg: number | null
  formula: OneRmFormula
  /** Every exercise in the range, once, by name. Always present. */
  exercises: ReportExercise[]
  /** null = section not requested. */
  sessions: ReportSession[] | null
  weeks: ReportWeek[] | null
  progression: ReportProgression[] | null
}

/* ---------------------------------- Build --------------------------------- */

export function buildReport(input: ReportInput): Report {
  const { fromKey, toKey } = input
  const inRange = input.workouts
    .filter((w) => w.dateKey >= fromKey && w.dateKey <= toKey)
    .sort(
      (a, b) =>
        a.dateKey.localeCompare(b.dateKey) || a.startedAt.toMillis() - b.startedAt.toMillis(),
    )
  const wanted = new Set(input.sections)
  // The catalog name wins over the workout copy so glossary and sessions agree
  // even after a custom exercise was renamed.
  const nameOf = (ex: Pick<WorkoutExercise, 'exerciseId' | 'exerciseName'>) =>
    input.resolveDef(ex.exerciseId)?.name ?? ex.exerciseName

  return {
    range: { fromKey, toKey, days: inclusiveDays(fromKey, toKey), sessions: inRange.length },
    bodyWeightKg: input.bodyWeightKg,
    formula: input.formula,
    exercises: glossary(inRange, input.resolveDef),
    sessions: wanted.has('sessions')
      ? inRange.map((w) => toSession(w, input.formula, nameOf))
      : null,
    weeks: wanted.has('weekly') ? weeklySummary(inRange, input) : null,
    progression: null,
  }
}

/** Inclusive day count between two 'YYYY-MM-DD' keys (UTC arithmetic, no date library). */
function inclusiveDays(fromKey: string, toKey: string): number {
  return Math.round((utcMidnight(toKey) - utcMidnight(fromKey)) / 86_400_000) + 1
}

function utcMidnight(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function glossary(
  workouts: ReportWorkout[],
  resolveDef: ReportInput['resolveDef'],
): ReportExercise[] {
  const seen = new Map<string, ReportExercise>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (seen.has(ex.exerciseId)) continue
      const def = resolveDef(ex.exerciseId)
      seen.set(
        ex.exerciseId,
        def
          ? {
              exerciseId: ex.exerciseId,
              name: def.name,
              muscle: def.muscle,
              secondaryMuscles: def.secondaryMuscles ?? [],
              equipment: def.equipment,
              measurement: def.measurement,
              custom: def.custom === true,
            }
          : {
              exerciseId: ex.exerciseId,
              name: ex.exerciseName,
              muscle: ex.muscle,
              secondaryMuscles: null,
              equipment: null,
              measurement: ex.measurement,
              custom: false,
            },
      )
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function toSession(
  w: ReportWorkout,
  formula: OneRmFormula,
  nameOf: (ex: WorkoutExercise) => string,
): ReportSession {
  const totals = summarizeWorkout(w)
  return {
    dateKey: w.dateKey,
    name: w.name,
    durationSeconds: w.durationSeconds,
    bodyWeightKg: w.bodyWeightKg,
    notes: w.notes,
    exercises: [...w.exercises]
      .sort((a, b) => a.order - b.order)
      .map((ex) => ({
        exerciseId: ex.exerciseId,
        name: nameOf(ex),
        measurement: ex.measurement,
        usesBodyweight: ex.usesBodyweight,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        sets: [...ex.sets]
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({
            position: i + 1,
            type: s.type,
            weightKg: s.weightKg,
            reps: s.reps,
            durationSeconds: s.durationSeconds,
            distanceMeters: s.distanceMeters,
            rpe: s.rpe,
          })),
      })),
    prs: prDisplayGroups(w.prDetails ?? [], formula),
    workingSets: totals.totalSets,
    volumeKg: totals.totalVolumeKg,
  }
}

function weeklySummary(workouts: ReportWorkout[], input: ReportInput): ReportWeek[] {
  const byWeek = new Map<string, ReportWorkout[]>()
  for (const w of workouts) {
    const key = input.weekStartKeyOf(w.dateKey)
    byWeek.set(key, [...(byWeek.get(key) ?? []), w])
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStartKey, list]) => {
      const totals = list.map((w) => summarizeWorkout(w))
      const breakdown = muscleSetBreakdown(
        list,
        (id) => input.resolveDef(id)?.secondaryMuscles ?? [],
      )
      const muscles = [...breakdown.entries()]
        .map(([muscle, b]) => ({ muscle, direct: b.direct, indirect: b.indirect }))
        .filter((m) => m.direct + m.indirect > 0)
        .sort(
          (a, b) =>
            b.direct + b.indirect - (a.direct + a.indirect) || a.muscle.localeCompare(b.muscle),
        )
      return {
        weekStartKey,
        weekEndKey: input.weekEndKeyOf(weekStartKey),
        sessions: list.length,
        workingSets: totals.reduce((sum, t) => sum + t.totalSets, 0),
        volumeKg: totals.reduce((sum, t) => sum + t.totalVolumeKg, 0),
        muscles,
        balance: muscleBalance(totals.map((t) => ({ setsByMuscle: t.setsByMuscle }))),
        repRanges: repRangeDistribution(list),
      }
    })
}
