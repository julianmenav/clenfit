import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '@/components/ui/Sheet'
import { summarizeWorkout, pruneIncomplete } from '@/domain/workoutSummary'
import type { WithId, Workout } from '@/domain/types'
import { formatDuration } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'

export interface FinishOptions {
  saveAsRoutineName: string | null
  updateRoutine: boolean
}

/** Resumen previo al cierre: totales + guardar como rutina / actualizar rutina. */
export function FinishWorkoutSheet({
  open,
  onOpenChange,
  workout,
  onConfirm,
  busy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: WithId<Workout>
  onConfirm: (opts: FinishOptions) => void
  busy: boolean
}) {
  const { t } = useTranslation(['workout', 'common'])
  const [saveAsRoutine, setSaveAsRoutine] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [updateRoutine, setUpdateRoutine] = useState(false)

  const pruned = useMemo(() => pruneIncomplete(workout.exercises), [workout.exercises])
  const totals = useMemo(() => summarizeWorkout({ exercises: pruned }), [pruned])
  const incompleteCount =
    workout.exercises.reduce((n, ex) => n + ex.sets.filter((s) => !s.completed).length, 0)
  const hasSwaps = workout.routineId != null && workout.exercises.some((e) => e.swappedFrom)
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - workout.startedAt.seconds))

  const canFinish = pruned.length > 0 && (!saveAsRoutine || routineName.trim().length > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('workout:finishSheet.title')}>
      <div className="flex flex-col gap-4 pt-2">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('common:stats.duration')} value={formatDuration(elapsed)} />
          <Stat
            label={t('common:stats.volume')}
            value={`${formatKg(totals.totalVolumeKg)} ${t('common:units.kg')}`}
          />
          <Stat label={t('workout:sets')} value={String(totals.totalSets)} />
        </div>

        {incompleteCount > 0 && (
          <p className="rounded-card bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
            {t('workout:finishSheet.incompleteSets')}
          </p>
        )}

        {workout.routineId == null && pruned.length > 0 && (
          <label className="flex items-center gap-3 rounded-card border border-hairline p-3">
            <input
              type="checkbox"
              checked={saveAsRoutine}
              onChange={(e) => setSaveAsRoutine(e.target.checked)}
              className="size-5 accent-(--accent)"
            />
            <span className="text-sm font-medium">{t('workout:finishSheet.saveAsRoutine')}</span>
          </label>
        )}
        {saveAsRoutine && (
          <input
            type="text"
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            placeholder={t('workout:finishSheet.routineName')}
            className="h-12 rounded-card border border-hairline bg-surface-2 px-4 text-base outline-none focus:border-accent"
          />
        )}

        {hasSwaps && (
          <label className="flex items-center gap-3 rounded-card border border-hairline p-3">
            <input
              type="checkbox"
              checked={updateRoutine}
              onChange={(e) => setUpdateRoutine(e.target.checked)}
              className="size-5 accent-(--accent)"
            />
            <span className="text-sm font-medium">
              {t('workout:finishSheet.updateRoutine', { name: workout.name })}
            </span>
          </label>
        )}

        <button
          type="button"
          disabled={!canFinish || busy}
          onClick={() =>
            onConfirm({
              saveAsRoutineName: saveAsRoutine ? routineName.trim() : null,
              updateRoutine,
            })
          }
          className="h-12 rounded-card bg-accent font-semibold text-on-accent disabled:opacity-60"
        >
          {t('workout:finishSheet.confirmFinish')}
        </button>
      </div>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-surface-2 px-3 py-2.5 text-center">
      <div className="tnum text-lg font-bold">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  )
}
