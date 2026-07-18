import { useEffect, useState } from 'react'
import { doc, limit, onSnapshot, orderBy, query, where, type Query } from 'firebase/firestore'
import { useUser } from '@/app/AuthProvider'
import type {
  CustomExercise,
  ExerciseStats,
  Routine,
  UserProfile,
  WithId,
  Workout,
} from '@/domain/types'
import {
  customExercisesCol,
  exerciseStatsCol,
  routinesCol,
  userDoc,
  workoutsCol,
} from './converters'

/**
 * Live subscription to a query. `undefined` = loading (subsequent snapshots
 * arrive on their own; Firestore is the cache, no invalidation needed).
 * `deps` controls resubscription — the Query object's identity changes on every render.
 */
function useLiveQuery<T>(makeQuery: () => Query<T>, deps: unknown[]): T[] | undefined {
  const [data, setData] = useState<T[] | undefined>(undefined)

  useEffect(() => {
    setData(undefined)
    return onSnapshot(
      makeQuery(),
      (snap) => setData(snap.docs.map((d) => d.data())),
      (err) => console.error('[firestore]', err),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return data
}

/** Live user profile. `undefined` = loading (the doc always exists after seeding). */
export function useUserProfile(): UserProfile | undefined {
  const uid = useUser().uid
  const [profile, setProfile] = useState<UserProfile | undefined>(undefined)

  useEffect(
    () =>
      onSnapshot(
        userDoc(uid),
        // App-written doc without a converter; trusted shape
        (snap) => setProfile(snap.data() as UserProfile | undefined),
        (err) => console.error('[firestore]', err),
      ),
    [uid],
  )

  return profile
}

/**
 * The active workout (or null). `undefined` = loading.
 * Only one can exist: queried with limit(1).
 */
export function useActiveWorkout(): WithId<Workout> | null | undefined {
  const uid = useUser().uid
  const data = useLiveQuery(
    () => query(workoutsCol(uid), where('status', '==', 'active'), limit(1)),
    [uid],
  )
  return data === undefined ? undefined : (data[0] ?? null)
}

/** Completed workouts, most recent first. */
export function useCompletedWorkouts(max = 100): WithId<Workout>[] | undefined {
  const uid = useUser().uid
  return useLiveQuery(
    () =>
      query(
        workoutsCol(uid),
        where('status', '==', 'completed'),
        orderBy('startedAt', 'desc'),
        limit(max),
      ),
    [uid, max],
  )
}

/** An exercise's history: completed sessions that include it. */
export function useExerciseWorkouts(exerciseId: string, max = 60): WithId<Workout>[] | undefined {
  const uid = useUser().uid
  return useLiveQuery(
    () =>
      query(
        workoutsCol(uid),
        where('exerciseIds', 'array-contains', exerciseId),
        where('status', '==', 'completed'),
        orderBy('startedAt', 'desc'),
        limit(max),
      ),
    [uid, exerciseId, max],
  )
}

/**
 * Whether a workout doc has writes not yet acknowledged by the server.
 * Note: while online this flickers true on every local write (latency
 * compensation) — only meaningful for UI when combined with being offline.
 */
export function useWorkoutHasPendingWrites(workoutId: string | undefined): boolean {
  const uid = useUser().uid
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!workoutId) {
      setPending(false)
      return
    }
    const ref = doc(workoutsCol(uid), workoutId)
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => setPending(snap.metadata.hasPendingWrites),
      (err) => console.error('[firestore]', err),
    )
  }, [uid, workoutId])

  return pending
}

/** A specific workout. null = does not exist. */
export function useWorkout(workoutId: string): WithId<Workout> | null | undefined {
  const uid = useUser().uid
  const [workout, setWorkout] = useState<WithId<Workout> | null | undefined>(undefined)

  useEffect(() => {
    setWorkout(undefined)
    const ref = doc(workoutsCol(uid), workoutId)
    return onSnapshot(
      ref,
      (snap) => setWorkout(snap.exists() ? snap.data() : null),
      (err) => console.error('[firestore]', err),
    )
  }, [uid, workoutId])

  return workout
}

export function useRoutines(): WithId<Routine>[] | undefined {
  const uid = useUser().uid
  return useLiveQuery(
    () => query(routinesCol(uid), where('archived', '==', false), orderBy('order')),
    [uid],
  )
}

export function useCustomExercises(): WithId<CustomExercise>[] | undefined {
  const uid = useUser().uid
  return useLiveQuery(() => query(customExercisesCol(uid), orderBy('createdAt')), [uid])
}

/** Stats for all exercises with history (map keyed by exerciseId). */
export function useAllExerciseStats(): Map<string, WithId<ExerciseStats>> | undefined {
  const uid = useUser().uid
  const list = useLiveQuery(() => query(exerciseStatsCol(uid)), [uid])
  if (list === undefined) return undefined
  return new Map(list.map((s) => [s.exerciseId, s]))
}

/** Stats for a specific exercise. null = never performed. */
export function useExerciseStats(exerciseId: string): WithId<ExerciseStats> | null | undefined {
  const uid = useUser().uid
  const [stats, setStats] = useState<WithId<ExerciseStats> | null | undefined>(undefined)

  useEffect(() => {
    setStats(undefined)
    const ref = doc(exerciseStatsCol(uid), exerciseId)
    return onSnapshot(
      ref,
      (snap) => setStats(snap.exists() ? snap.data() : null),
      (err) => console.error('[firestore]', err),
    )
  }, [uid, exerciseId])

  return stats
}
