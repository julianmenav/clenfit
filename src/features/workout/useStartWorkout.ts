import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { useUserProfile } from '@/data/hooks'
import type { Routine, WithId } from '@/domain/types'
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

  function startAndGo(routine?: WithId<Routine>) {
    if (!workout) {
      start(uid, t('free'), routine, (id) => byId.get(id), profile?.settings.bodyWeightKg ?? null)
    }
    navigate('/entrenamiento')
  }

  return { hasActive: workout != null, startAndGo }
}
