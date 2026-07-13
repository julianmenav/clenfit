import { useState } from 'react'
import { ArrowLeftRight, Minus, MoreVertical, Plus, Trash2, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ghostForSet } from '@/domain/ghosts'
import type { ExerciseStats, SetEntry, WithId, WorkoutExercise } from '@/domain/types'
import { formatKg } from '@/lib/formatSet'
import { SetHeader, SetRow } from './SetRow'

/** Card for an exercise in session: best history, sets and actions. */
export function ExerciseCard({
  exercise,
  stats,
  onPatchSet,
  onCycleType,
  onCompleteSet,
  onAddSet,
  onRemoveLastSet,
  onSwap,
  onRemove,
}: {
  exercise: WorkoutExercise
  stats: WithId<ExerciseStats> | undefined
  onPatchSet: (setIndex: number, patch: Partial<SetEntry>) => void
  onCycleType: (setIndex: number) => void
  onCompleteSet: (setIndex: number) => void
  onAddSet: () => void
  onRemoveLastSet: () => void
  onSwap: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation(['workout', 'common'])
  const [menuOpen, setMenuOpen] = useState(false)

  const best = stats?.prs.heaviestWeightKg?.value
  const bestReps = stats?.prs.mostReps?.value

  function menuAction(fn: () => void) {
    return () => {
      setMenuOpen(false)
      fn()
    }
  }

  return (
    <section className="rounded-card border border-hairline bg-surface p-3">
      <header className="flex items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{exercise.exerciseName}</h2>
          {(best != null || bestReps != null) && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
              <Trophy className="size-3.5 text-status-warn" />
              {t('workout:best')}:{' '}
              {best != null ? `${formatKg(best)} ${t('common:units.kg')}` : `${bestReps} reps`}
            </p>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={t('common:actions.edit')}
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex size-9 items-center justify-center rounded-card text-ink-3 active:bg-surface-2"
          >
            <MoreVertical className="size-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-card border border-hairline bg-surface-2 py-1 shadow-lg">
                <MenuItem
                  icon={<ArrowLeftRight className="size-4" />}
                  label={t('workout:swapExercise')}
                  onClick={menuAction(onSwap)}
                />
                {exercise.sets.length > 1 && (
                  <MenuItem
                    icon={<Minus className="size-4" />}
                    label={t('workout:removeLastSet')}
                    onClick={menuAction(onRemoveLastSet)}
                  />
                )}
                <MenuItem
                  icon={<Trash2 className="size-4" />}
                  label={t('workout:removeExercise')}
                  destructive
                  onClick={menuAction(onRemove)}
                />
              </div>
            </>
          )}
        </div>
      </header>

      <SetHeader measurement={exercise.measurement} />
      <div className="flex flex-col gap-1">
        {exercise.sets.map((set, i) => (
          <SetRow
            key={i}
            set={set}
            index={i}
            measurement={exercise.measurement}
            ghost={ghostForSet(exercise.sets, i, stats?.lastPerformance?.sets)}
            onPatch={(patch) => onPatchSet(i, patch)}
            onCycleType={() => onCycleType(i)}
            onComplete={() => onCompleteSet(i)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-card bg-surface-2 text-sm font-medium text-ink-2 active:scale-[0.99]"
      >
        <Plus className="size-4" />
        {t('workout:addSet')}
      </button>
    </section>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm ${
        destructive ? 'text-status-over' : 'text-ink'
      } active:bg-surface`}
    >
      {icon}
      {label}
    </button>
  )
}
