import { Timestamp } from 'firebase/firestore'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  deleteWorkout,
  emptySet,
  exerciseFromDef,
  finishWorkout,
  saveWorkout,
  startWorkout,
  type FinishResult,
} from '@/data/workoutMutations'
import type {
  ExerciseDef,
  ExerciseStats,
  Routine,
  SetEntry,
  SetType,
  WithId,
  Workout,
} from '@/domain/types'

/*
 * The store is the source of truth during the session (instant response while
 * typing); Firestore receives the full doc with debounce and localStorage
 * covers an abrupt tab close. On startup, `hydrateFromRemote` adopts the
 * active doc from Firestore only if the store is empty.
 */

const SAVE_DEBOUNCE_MS = 1500
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave: { uid: string; workout: WithId<Workout> } | null = null

function scheduleSave(uid: string, workout: WithId<Workout>) {
  pendingSave = { uid, workout }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    pendingSave = null
    saveWorkout(uid, workout).catch((err) => console.error('[activeWorkout] save', err))
  }, SAVE_DEBOUNCE_MS)
}

function cancelPendingSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  pendingSave = null
}

/**
 * Fires the debounced save immediately (on visibilitychange/pagehide): the
 * write lands in Firestore's durable queue even offline, so nothing is lost
 * if the OS kills the app afterwards.
 */
export function flushPendingSave() {
  if (!pendingSave) return
  const { uid, workout } = pendingSave
  cancelPendingSave()
  saveWorkout(uid, workout).catch((err) => console.error('[activeWorkout] flush', err))
}

interface ActiveWorkoutState {
  workout: WithId<Workout> | null

  hydrateFromRemote: (remote: WithId<Workout> | null) => void
  start: (
    uid: string,
    name: string,
    routine?: WithId<Routine>,
    resolveDef?: (exerciseId: string) => ExerciseDef | undefined,
  ) => void
  addExercise: (uid: string, def: ExerciseDef) => void
  removeExercise: (uid: string, index: number) => void
  swapExercise: (uid: string, index: number, def: ExerciseDef) => void
  moveExercise: (uid: string, from: number, to: number) => void
  addSet: (uid: string, exIndex: number) => void
  removeSet: (uid: string, exIndex: number, setIndex: number) => void
  updateSet: (uid: string, exIndex: number, setIndex: number, patch: Partial<SetEntry>) => void
  cycleSetType: (uid: string, exIndex: number, setIndex: number) => void
  setNotes: (uid: string, notes: string) => void
  finish: (uid: string, statsMap: Map<string, WithId<ExerciseStats>>) => FinishResult | null
  discard: (uid: string) => void
}

const setTypeCycle: SetType[] = ['normal', 'warmup', 'dropset', 'failure']

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => {
      /** Applies a change to the active workout and schedules the sync. */
      function mutate(uid: string, fn: (w: WithId<Workout>) => WithId<Workout>) {
        const current = get().workout
        if (!current) return
        const next = fn(current)
        next.exerciseIds = next.exercises.map((e) => e.exerciseId)
        set({ workout: next })
        scheduleSave(uid, next)
      }

      return {
        workout: null,

        hydrateFromRemote: (remote) => {
          const local = get().workout
          if (!local && remote) set({ workout: remote })
          // an existing local wins: it is more recent than whatever is in Firestore
        },

        start: (uid, name, routine, resolveDef) => {
          if (get().workout) return
          set({ workout: startWorkout(uid, name, routine, resolveDef) })
        },

        addExercise: (uid, def) =>
          mutate(uid, (w) => ({
            ...w,
            exercises: [...w.exercises, exerciseFromDef(def, w.exercises.length)],
          })),

        removeExercise: (uid, index) =>
          mutate(uid, (w) => ({
            ...w,
            exercises: w.exercises
              .filter((_, i) => i !== index)
              .map((ex, i) => ({ ...ex, order: i })),
          })),

        swapExercise: (uid, index, def) =>
          mutate(uid, (w) => ({
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
                // the routine's original, if it came from one (and not re-swapped)
                swappedFrom: ex.swappedFrom ?? (w.routineId ? ex.exerciseId : null),
                sets: keepSets
                  ? ex.sets.map((s) => (s.completed ? s : { ...s }))
                  : ex.sets.filter((s) => s.completed).length > 0
                    ? ex.sets.filter((s) => s.completed)
                    : [emptySet(0), emptySet(1), emptySet(2)],
              }
            }),
          })),

        moveExercise: (uid, from, to) =>
          mutate(uid, (w) => {
            if (from === to || to < 0 || to >= w.exercises.length) return w
            const next = [...w.exercises]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return { ...w, exercises: next.map((ex, i) => ({ ...ex, order: i })) }
          }),

        addSet: (uid, exIndex) =>
          mutate(uid, (w) => ({
            ...w,
            exercises: w.exercises.map((ex, i) => {
              if (i !== exIndex) return ex
              const last = ex.sets[ex.sets.length - 1]
              const next: SetEntry = last
                ? { ...last, order: ex.sets.length, completed: false, type: 'normal' }
                : emptySet(0)
              return { ...ex, sets: [...ex.sets, next] }
            }),
          })),

        removeSet: (uid, exIndex, setIndex) =>
          mutate(uid, (w) => ({
            ...w,
            exercises: w.exercises.map((ex, i) =>
              i === exIndex
                ? {
                    ...ex,
                    sets: ex.sets
                      .filter((_, j) => j !== setIndex)
                      .map((s, j) => ({ ...s, order: j })),
                  }
                : ex,
            ),
          })),

        updateSet: (uid, exIndex, setIndex, patch) =>
          mutate(uid, (w) => ({
            ...w,
            exercises: w.exercises.map((ex, i) =>
              i === exIndex
                ? {
                    ...ex,
                    sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)),
                  }
                : ex,
            ),
          })),

        cycleSetType: (uid, exIndex, setIndex) =>
          mutate(uid, (w) => ({
            ...w,
            exercises: w.exercises.map((ex, i) =>
              i === exIndex
                ? {
                    ...ex,
                    sets: ex.sets.map((s, j) =>
                      j === setIndex
                        ? {
                            ...s,
                            type: setTypeCycle[
                              (setTypeCycle.indexOf(s.type) + 1) % setTypeCycle.length
                            ],
                          }
                        : s,
                    ),
                  }
                : ex,
            ),
          })),

        setNotes: (uid, notes) => mutate(uid, (w) => ({ ...w, notes: notes || null })),

        finish: (uid, statsMap) => {
          const workout = get().workout
          if (!workout) return null
          cancelPendingSave()
          const result = finishWorkout(uid, workout, statsMap)
          if (result) set({ workout: null })
          return result
        },

        discard: (uid) => {
          const workout = get().workout
          if (!workout) return
          cancelPendingSave()
          set({ workout: null })
          deleteWorkout(uid, workout.id).catch((err) => console.error('[discard]', err))
        },
      }
    },
    {
      name: 'clenfit:activeWorkout',
      storage: createJSONStorage(() => localStorage, {
        // Timestamp.toJSON() runs BEFORE any replacer (JSON.stringify semantics),
        // so timestamps land in storage as {type:'firestore/timestamp/1.0',...};
        // the reviver must restore real instances or Firestore writes of a
        // rehydrated workout fail schema validation.
        reviver: (_key, value) => {
          if (value === null || typeof value !== 'object') return value
          if ('__ts' in value) {
            // legacy format from a previous replacer
            return Timestamp.fromMillis((value as { __ts: number }).__ts)
          }
          const v = value as { type?: string; seconds?: number; nanoseconds?: number }
          if (v.type === 'firestore/timestamp/1.0') {
            return new Timestamp(v.seconds ?? 0, v.nanoseconds ?? 0)
          }
          return value
        },
      }),
      partialize: (state) => ({ workout: state.workout }) as ActiveWorkoutState,
    },
  ),
)
