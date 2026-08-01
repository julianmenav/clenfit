import { defUsesBodyweight } from './volume'
import {
  setTypes,
  type ExerciseDef,
  type SetEntry,
  type SetType,
  type Workout,
  type WorkoutExercise,
} from './types'

/*
 * Pure counterparts of the active-session store mutations, used by the
 * completed-workout editor over a local draft (the zustand store must never
 * hold anything but the live session).
 */

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

export function setHasData(set: SetEntry): boolean {
  return (
    set.weightKg != null ||
    set.reps != null ||
    set.durationSeconds != null ||
    set.distanceMeters != null
  )
}

function mapExercise<W extends Pick<Workout, 'exercises'>>(
  w: W,
  exIndex: number,
  fn: (ex: WorkoutExercise) => WorkoutExercise,
): W {
  return { ...w, exercises: w.exercises.map((ex, i) => (i === exIndex ? fn(ex) : ex)) }
}

export function withSetPatch<W extends Pick<Workout, 'exercises'>>(
  w: W,
  exIndex: number,
  setIndex: number,
  patch: Partial<SetEntry>,
): W {
  return mapExercise(w, exIndex, (ex) => ({
    ...ex,
    sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)),
  }))
}

/**
 * Sets the weight of one set and carries it to the following ones, so entering
 * a load once covers the whole exercise.
 *
 * Only sets that were "following along" are touched: still open (not completed)
 * and holding either no weight or exactly the value being replaced. A set the
 * user typed a different number into keeps it, and warmups are left alone
 * because they run lighter on purpose.
 */
export function withPropagatedWeight<W extends Pick<Workout, 'exercises'>>(
  w: W,
  exIndex: number,
  setIndex: number,
  weightKg: number | null,
): W {
  return mapExercise(w, exIndex, (ex) => {
    const previous = ex.sets[setIndex]?.weightKg ?? null
    return {
      ...ex,
      sets: ex.sets.map((s, j) => {
        if (j === setIndex) return { ...s, weightKg }
        if (j < setIndex) return s
        if (s.completed || s.type === 'warmup') return s
        return s.weightKg === previous ? { ...s, weightKg } : s
      }),
    }
  })
}

/** Clones the last set (like the store's addSet). */
export function withAddedSet<W extends Pick<Workout, 'exercises'>>(w: W, exIndex: number): W {
  return mapExercise(w, exIndex, (ex) => {
    const last = ex.sets[ex.sets.length - 1]
    const next: SetEntry = last
      ? { ...last, order: ex.sets.length, completed: false, type: 'normal' }
      : emptySet(0)
    return { ...ex, sets: [...ex.sets, next] }
  })
}

export function withRemovedSet<W extends Pick<Workout, 'exercises'>>(
  w: W,
  exIndex: number,
  setIndex: number,
): W {
  return mapExercise(w, exIndex, (ex) => ({
    ...ex,
    sets: ex.sets.filter((_, j) => j !== setIndex).map((s, j) => ({ ...s, order: j })),
  }))
}

const setTypeCycle: SetType[] = [...setTypes]

export function withCycledSetType<W extends Pick<Workout, 'exercises'>>(
  w: W,
  exIndex: number,
  setIndex: number,
): W {
  return mapExercise(w, exIndex, (ex) => ({
    ...ex,
    sets: ex.sets.map((s, j) =>
      j === setIndex
        ? { ...s, type: setTypeCycle[(setTypeCycle.indexOf(s.type) + 1) % setTypeCycle.length] }
        : s,
    ),
  }))
}

export function withAddedExercise<W extends Pick<Workout, 'exercises'>>(
  w: W,
  ex: WorkoutExercise,
): W {
  return { ...w, exercises: [...w.exercises, { ...ex, order: w.exercises.length }] }
}

export function withRemovedExercise<W extends Pick<Workout, 'exercises'>>(w: W, index: number): W {
  return {
    ...w,
    exercises: w.exercises.filter((_, i) => i !== index).map((ex, i) => ({ ...ex, order: i })),
  }
}

export function withMovedExercise<W extends Pick<Workout, 'exercises'>>(
  w: W,
  from: number,
  to: number,
): W {
  if (from === to || to < 0 || to >= w.exercises.length) return w
  const next = [...w.exercises]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return { ...w, exercises: next.map((ex, i) => ({ ...ex, order: i })) }
}

/** Mirrors the store's swapExercise: keeps sets when the measurement matches. */
export function withSwappedExercise<W extends Pick<Workout, 'exercises' | 'routineId'>>(
  w: W,
  index: number,
  def: ExerciseDef,
): W {
  return {
    ...w,
    exercises: w.exercises.map((ex, i) => {
      if (i !== index) return ex
      const keepSets = ex.measurement === def.measurement
      return {
        ...ex,
        exerciseId: def.id,
        exerciseName: def.name,
        muscle: def.muscle,
        measurement: def.measurement,
        usesBodyweight: defUsesBodyweight(def),
        swappedFrom: ex.swappedFrom ?? (w.routineId ? ex.exerciseId : null),
        sets: keepSets
          ? ex.sets
          : ex.sets.filter(setHasData).length > 0
            ? ex.sets.filter(setHasData).map((s, j) => ({ ...s, order: j }))
            : [emptySet(0), emptySet(1), emptySet(2)],
      }
    }),
  }
}

export function withExerciseNotes<W extends Pick<Workout, 'exercises'>>(
  w: W,
  exIndex: number,
  notes: string,
): W {
  return mapExercise(w, exIndex, (ex) => ({ ...ex, notes: notes || null }))
}

/**
 * Editor save semantics: retro-logged sets shouldn't require ticking every
 * checkmark, so sets with data become completed, dataless sets are dropped,
 * and exercises left empty disappear. Orders are reindexed.
 */
export function normalizeEditedSets(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return exercises
    .map((ex) => ({
      ...ex,
      sets: ex.sets.filter(setHasData).map((s, j) => ({ ...s, order: j, completed: true })),
    }))
    .filter((ex) => ex.sets.length > 0)
    .map((ex, i) => ({ ...ex, order: i }))
}
