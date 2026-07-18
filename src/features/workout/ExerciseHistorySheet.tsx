import { useTranslation } from 'react-i18next'
import { Sheet } from '@/components/ui/Sheet'
import { useExerciseWorkouts } from '@/data/hooks'
import { ExerciseSessionSummary } from '@/features/exercises/ExerciseSessionSummary'

/** Bottom sheet with the last few sessions of an exercise. */
export function ExerciseHistorySheet({
  open,
  onOpenChange,
  exerciseId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: string | null
}) {
  const { t } = useTranslation(['workout'])

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('workout:lastPerformances.title')}>
      {open && exerciseId && <HistoryContent exerciseId={exerciseId} />}
    </Sheet>
  )
}

/** Mounted only while the sheet is open, so the Firestore listener is too. */
function HistoryContent({ exerciseId }: { exerciseId: string }) {
  const { t } = useTranslation(['exercises', 'common'])
  const workouts = useExerciseWorkouts(exerciseId, 5)

  if (workouts === undefined) {
    return <p className="py-6 text-center text-ink-3">{t('common:loading')}</p>
  }
  if (workouts.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline p-6 text-center text-sm text-ink-2">
        {t('exercises:detail.noHistory')}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2 pt-2">
      {workouts.map((w) => (
        <div key={w.id} className="rounded-card border border-hairline bg-surface p-3">
          <ExerciseSessionSummary workout={w} exerciseId={exerciseId} />
        </div>
      ))}
    </div>
  )
}
