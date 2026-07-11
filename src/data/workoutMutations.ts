import {
  addDoc,
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
import { applySessionPrs, detectNewPrs, sessionCandidates, statsBaseline } from '@/domain/prs'
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
    order,
    slotIndex: opts.slotIndex ?? null,
    swappedFrom: null,
    restSeconds: opts.restSeconds ?? null,
    sets: Array.from({ length: n }, (_, i) => emptySet(i)),
  }
}

/** Creates the active doc in Firestore (empty or preloaded from a routine). */
export async function startWorkout(
  uid: string,
  name: string,
  routine?: WithId<Routine>,
  resolveDef?: (exerciseId: string) => ExerciseDef | undefined,
): Promise<WithId<Workout>> {
  const exercises: WorkoutExercise[] = (routine?.slots ?? []).map((slot, i) => {
    const def = resolveDef?.(slot.exerciseId)
    return {
      exerciseId: slot.exerciseId,
      exerciseName: def?.name ?? slot.exerciseName,
      muscle: def?.muscle ?? 'chest',
      measurement: def?.measurement ?? 'weight_reps',
      order: i,
      slotIndex: slot.order,
      swappedFrom: null,
      restSeconds: slot.restSeconds,
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
    exerciseIds: exercises.map((e) => e.exerciseId),
    exercises,
    totalVolumeKg: null,
    totalSets: null,
    prCount: null,
    setsByMuscle: null,
  }

  const ref = await addDoc(workoutsCol(uid), { id: '', ...workout })
  return { id: ref.id, ...workout }
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
 */
export async function finishWorkout(
  uid: string,
  active: WithId<Workout>,
  statsMap: Map<string, WithId<ExerciseStats>>,
): Promise<FinishResult | null> {
  const exercises = pruneIncomplete(active.exercises)
  if (exercises.length === 0) return null

  const completedAt = Timestamp.now()
  const totals = summarizeWorkout({ exercises })
  const newPrsByExercise = new Map<string, PrType[]>()

  const batch = writeBatch(db)
  let prCount = 0

  for (const ex of exercises) {
    const prev = statsMap.get(ex.exerciseId) ?? null
    const { newPrs, prs } = applySessionPrs(ex, prev, active.id, active.dateKey)
    prCount += newPrs.length
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

  await batch.commit()
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

/** Saves a freestyle workout as a reusable routine. */
export async function saveWorkoutAsRoutine(
  uid: string,
  workout: Workout,
  name: string,
): Promise<string> {
  const routine: Routine = {
    name,
    order: Date.now(),
    archived: false,
    slots: slotsFromWorkout(workout),
    lastPerformedAt: Timestamp.now(),
    timesPerformed: 1,
    createdAt: Timestamp.now(),
  }
  const ref = await addDoc(routinesCol(uid), { id: '', ...routine })
  return ref.id
}

/** After in-session exercise changes: the routine adopts the exercises performed. */
export function updateRoutineSlots(uid: string, routineId: string, workout: Workout): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'routines', routineId), {
    slots: slotsFromWorkout(workout),
  })
}

/**
 * Rebuilds an exercise's exerciseStats by walking its full history.
 * Used after deleting/editing a past workout (the denormalized stats go stale).
 */
export async function recomputeExerciseStats(uid: string, exerciseId: string): Promise<void> {
  const snap = await getDocs(
    query(
      workoutsCol(uid),
      where('exerciseIds', 'array-contains', exerciseId),
      where('status', '==', 'completed'),
      orderBy('startedAt', 'asc'),
    ),
  )
  const sessions = snap.docs.map((d) => d.data())

  const statsRef = exerciseStatsDoc(uid, exerciseId)
  if (sessions.length === 0) {
    await deleteDoc(statsRef)
    return
  }

  let prs: ExerciseStats['prs'] = {}
  let exerciseName = ''
  let last: ExerciseStats['lastPerformance'] = null

  for (const w of sessions) {
    for (const ex of w.exercises.filter((e) => e.exerciseId === exerciseId)) {
      exerciseName = ex.exerciseName
      const candidates = sessionCandidates(ex.sets)
      const newTypes = detectNewPrs(candidates, statsBaseline({ prs }))
      for (const type of newTypes) {
        prs = { ...prs, [type]: { value: candidates[type]!, workoutId: w.id, dateKey: w.dateKey } }
      }
      last = { workoutId: w.id, dateKey: w.dateKey, sets: ex.sets }
    }
  }

  const stats: WithId<ExerciseStats> = {
    id: exerciseId,
    exerciseId,
    exerciseName,
    lastPerformance: last,
    prs,
    totalSessions: sessions.length,
    updatedAt: Timestamp.now(),
  }
  await setDoc(statsRef, stats)
}

/** Deletes a completed workout and rebuilds the stats of its exercises. */
export async function deleteCompletedWorkout(uid: string, workout: WithId<Workout>): Promise<void> {
  await deleteWorkout(uid, workout.id)
  const unique = [...new Set(workout.exerciseIds)]
  await Promise.all(unique.map((exerciseId) => recomputeExerciseStats(uid, exerciseId)))
}

/** Reference usable for one-off routine updates (editor). */
export { routineDoc }
