import {
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toDateKey } from '@/lib/dates'
import { applySessionPrs, displayPrCount } from '@/domain/prs'
import { rebuildAllStats, rebuildStatsForExercise } from '@/domain/statsRebuild'
import { defUsesBodyweight } from '@/domain/volume'
import { pruneIncomplete, summarizeWorkout } from '@/domain/workoutSummary'
import type {
  ExerciseDef,
  ExerciseStats,
  PrType,
  Routine,
  RoutineSlot,
  SetEntry,
  WithId,
  Workout,
  WorkoutExercise,
} from '@/domain/types'
import {
  exerciseStatsCol,
  exerciseStatsDoc,
  routineDoc,
  routinesCol,
  workoutDoc,
  workoutsCol,
} from './converters'

export function emptySet(order: number): SetEntry {
  return {
    order,
    type: 'normal',
    weightKg: null,
    reps: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    completed: false,
  }
}

export function exerciseFromDef(
  def: ExerciseDef,
  order: number,
  opts: { slotIndex?: number | null; restSeconds?: number | null; sets?: number } = {},
): WorkoutExercise {
  const n = Math.max(1, opts.sets ?? 3)
  return {
    exerciseId: def.id,
    exerciseName: def.name,
    muscle: def.muscle,
    measurement: def.measurement,
    usesBodyweight: defUsesBodyweight(def),
    order,
    slotIndex: opts.slotIndex ?? null,
    swappedFrom: null,
    restSeconds: opts.restSeconds ?? null,
    notes: null,
    sets: Array.from({ length: n }, (_, i) => emptySet(i)),
  }
}

/**
 * Creates the active doc (client-generated id, write not awaited so it also
 * works offline: Firestore queues it durably and uploads on reconnect).
 */
export function startWorkout(
  uid: string,
  name: string,
  routine?: WithId<Routine>,
  resolveDef?: (exerciseId: string) => ExerciseDef | undefined,
  bodyWeightKg: number | null = null,
): WithId<Workout> {
  const exercises: WorkoutExercise[] = (routine?.slots ?? []).map((slot, i) => {
    const def = resolveDef?.(slot.exerciseId)
    return {
      exerciseId: slot.exerciseId,
      exerciseName: def?.name ?? slot.exerciseName,
      muscle: def?.muscle ?? 'chest',
      measurement: def?.measurement ?? 'weight_reps',
      usesBodyweight: def ? defUsesBodyweight(def) : false,
      order: i,
      slotIndex: slot.order,
      swappedFrom: null,
      restSeconds: slot.restSeconds,
      notes: null,
      sets: Array.from({ length: Math.max(1, slot.targetSets ?? 3) }, (_, j) => emptySet(j)),
    }
  })

  const workout: Workout = {
    status: 'active',
    name: routine?.name ?? name,
    routineId: routine?.id ?? null,
    startedAt: Timestamp.now(),
    completedAt: null,
    durationSeconds: null,
    dateKey: toDateKey(new Date()),
    notes: null,
    bodyWeightKg,
    exerciseIds: exercises.map((e) => e.exerciseId),
    exercises,
    totalVolumeKg: null,
    totalSets: null,
    prCount: null,
    setsByMuscle: null,
  }

  const ref = doc(workoutsCol(uid))
  const withId: WithId<Workout> = { id: ref.id, ...workout }
  setDoc(ref, withId).catch((err) => console.error('[startWorkout]', err))
  return withId
}

/** Syncs the full active doc (called by the store with debounce). */
export function saveWorkout(uid: string, workout: WithId<Workout>): Promise<void> {
  return setDoc(workoutDoc(uid, workout.id), workout)
}

export function deleteWorkout(uid: string, workoutId: string): Promise<void> {
  return deleteDoc(workoutDoc(uid, workoutId))
}

export interface FinishResult {
  workout: WithId<Workout>
  newPrsByExercise: Map<string, PrType[]>
  prCount: number
}

/**
 * Closes the session: prunes incomplete sets, computes totals and PRs, and
 * writes the workout + exerciseStats (+ routine counters) in a single batch.
 * The commit is not awaited: offline it stays queued until reconnect.
 */
export function finishWorkout(
  uid: string,
  active: WithId<Workout>,
  statsMap: Map<string, WithId<ExerciseStats>>,
): FinishResult | null {
  const exercises = pruneIncomplete(active.exercises)
  if (exercises.length === 0) return null

  const completedAt = Timestamp.now()
  const bodyWeightKg = active.bodyWeightKg ?? null
  const totals = summarizeWorkout({ exercises, bodyWeightKg })
  const newPrsByExercise = new Map<string, PrType[]>()

  const batch = writeBatch(db)
  let prCount = 0

  for (const ex of exercises) {
    const prev = statsMap.get(ex.exerciseId) ?? null
    const { newPrs, prs } = applySessionPrs(ex, prev, active.id, active.dateKey, bodyWeightKg)
    prCount += displayPrCount(newPrs)
    if (newPrs.length > 0) newPrsByExercise.set(ex.exerciseId, newPrs)

    const stats: WithId<ExerciseStats> = {
      id: ex.exerciseId,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      lastPerformance: { workoutId: active.id, dateKey: active.dateKey, sets: ex.sets },
      prs,
      totalSessions: (prev?.totalSessions ?? 0) + 1,
      updatedAt: completedAt,
    }
    batch.set(exerciseStatsDoc(uid, ex.exerciseId), stats)
  }

  const workout: WithId<Workout> = {
    ...active,
    status: 'completed',
    completedAt,
    durationSeconds: Math.max(0, completedAt.seconds - active.startedAt.seconds),
    exercises,
    exerciseIds: exercises.map((e) => e.exerciseId),
    ...totals,
    prCount,
  }
  batch.set(workoutDoc(uid, active.id), workout)

  if (active.routineId) {
    batch.update(doc(db, 'users', uid, 'routines', active.routineId), {
      lastPerformedAt: completedAt,
      timesPerformed: increment(1),
    })
  }

  batch.commit().catch((err) => console.error('[finishWorkout]', err))
  return { workout, newPrsByExercise, prCount }
}

function slotsFromWorkout(workout: Workout): RoutineSlot[] {
  return workout.exercises.map((ex, i) => ({
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName,
    order: i,
    targetSets: ex.sets.length,
    targetReps: null,
    restSeconds: ex.restSeconds,
  }))
}

/** Saves a freestyle workout as a reusable routine (offline-safe, not awaited). */
export function saveWorkoutAsRoutine(uid: string, workout: Workout, name: string): string {
  const routine: Routine = {
    name,
    order: Date.now(),
    archived: false,
    slots: slotsFromWorkout(workout),
    lastPerformedAt: Timestamp.now(),
    timesPerformed: 1,
    createdAt: Timestamp.now(),
  }
  const ref = doc(routinesCol(uid))
  setDoc(ref, { id: ref.id, ...routine }).catch((err) =>
    console.error('[saveWorkoutAsRoutine]', err),
  )
  return ref.id
}

/** After in-session exercise changes: the routine adopts the exercises performed. */
export function updateRoutineSlots(uid: string, routineId: string, workout: Workout): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'routines', routineId), {
    slots: slotsFromWorkout(workout),
  })
}

export interface RecomputeOptions {
  /** Drop this doc from the query result (a just-deleted workout can still be in cache). */
  excludeWorkoutId?: string
  /** Use this version of the doc instead of the (possibly stale) queried one. */
  overrideWorkout?: WithId<Workout>
}

/**
 * Rebuilds an exercise's exerciseStats by walking its full history.
 * Used after deleting/editing a past workout (the denormalized stats go stale).
 * Offline, getDocs falls back to the local cache (warm via the history
 * listener); a partial cache self-heals on the next recompute. Because pending
 * deletes/writes may not be visible to the query yet, callers pass the change
 * via `opts` instead of awaiting the write (which offline never settles).
 */
export async function recomputeExerciseStats(
  uid: string,
  exerciseId: string,
  opts: RecomputeOptions = {},
): Promise<void> {
  const snap = await getDocs(
    query(
      workoutsCol(uid),
      where('exerciseIds', 'array-contains', exerciseId),
      where('status', '==', 'completed'),
      orderBy('startedAt', 'asc'),
    ),
  )
  const override = opts.overrideWorkout
  const sessions = snap.docs
    .map((d) => d.data())
    .filter((w) => w.id !== opts.excludeWorkoutId && w.id !== override?.id)
  if (
    override?.status === 'completed' &&
    override.exercises.some((e) => e.exerciseId === exerciseId)
  ) {
    sessions.push(override)
    sessions.sort(
      (a, b) =>
        a.startedAt.seconds - b.startedAt.seconds || a.startedAt.nanoseconds - b.startedAt.nanoseconds,
    )
  }

  const statsRef = exerciseStatsDoc(uid, exerciseId)
  const rebuilt = rebuildStatsForExercise(sessions, exerciseId)
  if (!rebuilt) {
    deleteDoc(statsRef).catch((err) => console.error('[recomputeExerciseStats]', err))
    return
  }

  const stats: WithId<ExerciseStats> = {
    id: exerciseId,
    exerciseId,
    ...rebuilt,
    updatedAt: Timestamp.now(),
  }
  setDoc(statsRef, stats).catch((err) => console.error('[recomputeExerciseStats]', err))
}

/** Deletes a completed workout and rebuilds the stats of its exercises. */
export async function deleteCompletedWorkout(uid: string, workout: WithId<Workout>): Promise<void> {
  deleteWorkout(uid, workout.id).catch((err) => console.error('[deleteCompletedWorkout]', err))
  const unique = [...new Set(workout.exerciseIds)]
  await Promise.all(
    unique.map((exerciseId) =>
      recomputeExerciseStats(uid, exerciseId, { excludeWorkoutId: workout.id }),
    ),
  )
}

/**
 * Full repair: rebuilds every exerciseStats doc from the completed history and
 * deletes orphaned ones (e.g. records left behind by an old deletion bug).
 * Writes are chunked and not awaited (offline they stay queued).
 */
export async function recomputeAllExerciseStats(
  uid: string,
): Promise<{ rebuilt: number; removed: number }> {
  const [workoutsSnap, statsSnap] = await Promise.all([
    getDocs(query(workoutsCol(uid), where('status', '==', 'completed'), orderBy('startedAt', 'asc'))),
    getDocs(exerciseStatsCol(uid)),
  ])
  const rebuilt = rebuildAllStats(workoutsSnap.docs.map((d) => d.data()))
  const updatedAt = Timestamp.now()

  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = []
  for (const [exerciseId, stats] of rebuilt) {
    ops.push((batch) =>
      batch.set(exerciseStatsDoc(uid, exerciseId), { id: exerciseId, exerciseId, ...stats, updatedAt }),
    )
  }
  let removed = 0
  for (const d of statsSnap.docs) {
    if (!rebuilt.has(d.id)) {
      removed += 1
      ops.push((batch) => batch.delete(d.ref))
    }
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 400)) op(batch)
    batch.commit().catch((err) => console.error('[recomputeAllExerciseStats]', err))
  }
  return { rebuilt: rebuilt.size, removed }
}

/** Reference usable for one-off routine updates (editor). */
export { routineDoc }
