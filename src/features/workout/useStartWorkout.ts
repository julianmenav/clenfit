import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { useUserProfile } from '@/data/hooks'
import type { Routine, WithId } from '@/domain/types'
import { useFireReminders } from '@/features/reminders/useFireReminders'
import { useActiveWorkoutStore } from '@/store/activeWorkout'

/** Starts (or resumes) a session and navigates to it. */
export function useStartWorkout() {
  const uid = useUser().uid
  const navigate = useNavigate()
  const { t } = useTranslation('workout')
  const { byId } = useExerciseIndex()
  const profile = useUserProfile()
  const workout = useActiveWorkoutStore((s) => s.workout)
  const start = useActiveWorkoutStore((s) => s.start)
  const fire = useFireReminders()

  function startAndGo(routine?: WithId<Routine>) {
    if (!workout) {
      start(uid, t('free'), routine, (id) => byId.get(id), profile?.settings.bodyWeightKg ?? null)
      // resuming fires nothing: it already fired when the session started
      const started = useActiveWorkoutStore.getState().workout
      if (started) fire({ kind: 'workoutStart' }, { id: started.id, routineId: started.routineId })
    }
    navigate('/entrenamiento')
  }

  return { hasActive: workout != null, startAndGo }
}
