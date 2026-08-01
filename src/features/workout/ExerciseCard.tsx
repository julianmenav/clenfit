import { useState } from 'react'
import {
  ArrowLeftRight,
  ArrowUpDown,
  History,
  Minus,
  Plus,
  StickyNote,
  Trash2,
  Trophy,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { KebabMenu, MenuItem } from '@/components/ui/KebabMenu'
import { ghostForSet } from '@/domain/ghosts'
import type { ExerciseStats, SetEntry, WithId, WorkoutExercise } from '@/domain/types'
import { formatKg } from '@/lib/formatSet'
import { SetHeader, SetRow } from './SetRow'

/** Card for an exercise in session: best history, sets and actions. */
export function ExerciseCard({
  exercise,
  stats,
  onPatchSet,
  onPatchWeight,
  onCycleType,
  onCompleteSet,
  onAddSet,
  onRemoveLastSet,
  onSwap,
  onRemove,
  onReorder,
  onSetNotes,
  onShowHistory,
}: {
  exercise: WorkoutExercise
  stats: WithId<ExerciseStats> | undefined
  onPatchSet: (setIndex: number, patch: Partial<SetEntry>) => void
  /** separate from onPatchSet so a weight can carry to the following sets */
  onPatchWeight?: (setIndex: number, weightKg: number | null) => void
  onCycleType: (setIndex: number) => void
  onCompleteSet: (setIndex: number) => void
  onAddSet: () => void
  onRemoveLastSet: () => void
  onSwap: () => void
  onRemove: () => void
  onReorder?: () => void
  onSetNotes: (notes: string) => void
  onShowHistory: () => void
}) {
  const { t } = useTranslation(['workout', 'common'])
  const [notesOpen, setNotesOpen] = useState(false)
  const showNotes = notesOpen || exercise.notes != null

  const best = stats?.prs.heaviestWeightKg?.value
  const bestReps = stats?.prs.mostReps?.value

  return (
    <section className="rounded-card border border-hairline bg-surface p-3">
      <header className="flex items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{exercise.exerciseName}</h2>
          {(best != null || bestReps != null) && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
              <Trophy className="size-3.5 text-status-warn" />
              {t('workout:best')}:{' '}
              {best != null ? `${formatKg(best)} ${t('common:units.kg')}` : `${bestReps} reps`}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label={t('workout:lastPerformances.title')}
          onClick={onShowHistory}
          className="flex size-9 shrink-0 items-center justify-center rounded-card text-ink-3 active:bg-surface-2"
        >
          <History className="size-5" />
        </button>

        <KebabMenu label={t('common:actions.edit')}>
          {(close) => {
            const act = (fn: () => void) => () => {
              close()
              fn()
            }
            return (
              <>
                <MenuItem
                  icon={<ArrowLeftRight className="size-4" />}
                  label={t('workout:swapExercise')}
                  onClick={act(onSwap)}
                />
                {!showNotes && (
                  <MenuItem
                    icon={<StickyNote className="size-4" />}
                    label={t('workout:exerciseNotes.add')}
                    onClick={act(() => setNotesOpen(true))}
                  />
                )}
                {onReorder && (
                  <MenuItem
                    icon={<ArrowUpDown className="size-4" />}
                    label={t('workout:reorder.menuItem')}
                    onClick={act(onReorder)}
                  />
                )}
                {exercise.sets.length > 1 && (
                  <MenuItem
                    icon={<Minus className="size-4" />}
                    label={t('workout:removeLastSet')}
                    onClick={act(onRemoveLastSet)}
                  />
                )}
                <MenuItem
                  icon={<Trash2 className="size-4" />}
                  label={t('workout:removeExercise')}
                  destructive
                  onClick={act(onRemove)}
                />
              </>
            )
          }}
        </KebabMenu>
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
            onWeight={onPatchWeight && ((v) => onPatchWeight(i, v))}
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

      {showNotes && (
        <textarea
          value={exercise.notes ?? ''}
          onChange={(e) => onSetNotes(e.target.value)}
          placeholder={t('workout:exerciseNotes.placeholder')}
          rows={2}
          className="mt-2 w-full resize-none rounded-card border border-hairline bg-surface-2 p-2.5 text-sm outline-none focus:border-accent"
        />
      )}
    </section>
  )
}
